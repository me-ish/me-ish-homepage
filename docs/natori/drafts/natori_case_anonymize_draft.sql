-- 【案・未適用】完了した案件の依頼者情報を匿名化する。
--
-- 決まっていること（keisuke さん 2026-11-14）:
--   ・完了（または終了）から 90 日で匿名化する
--   ・名前は受付番号（「依頼者 #1A2B3C4D」）に置き換える
--   ・見積メールと支払い案内メールの控え（宛名・金額・日付・本文）は 7 年残す。メールアドレスは消す
--   ・金額・入金・返金・日付・見積の条件・品目・公開条件は残す
--
-- この SQL がすること:
--   1. 記録の表 natori_case_anonymizations（いつ・誰が・どの受付番号にしたか、消すファイルの一覧）
--   2. 書き換え禁止の 3 つの仕組みに「匿名化の関数の中だけ」の例外を足す
--        通知の控え（snapshot / payload）・納品記録の写し（snapshot）・見積（宛先アドレスと依頼文の写しだけ）
--   3. 関数 natori_case_anonymize_v1（1 案件を 1 回の処理で匿名化。途中で失敗したら全部元に戻る）
--   4. 案件の守りの台帳を更新し、全 root の確認を通す
-- ファイル本体（相談の添付・参考画像・納品データ）は SQL では消さない。関数が返す一覧をアプリが
-- Storage の API で消し、終わったら storage_purged_at を入れる。
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
do $preflight$
declare r record;
begin
 for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root);end loop;
end $preflight$;

create table public.natori_case_anonymizations(
 project_id uuid primary key references public.natori_projects(id),
 owner_id uuid not null references auth.users(id),
 label text not null check(label ~ '^依頼者 #[0-9A-F]{8}$'),
 kind text not null check(kind in ('scheduled','manual')),
 operator jsonb not null check(jsonb_typeof(operator)='object' and operator->>'kind' in ('auth-user','shared-key','schedule')),
 storage_objects jsonb not null default '[]'::jsonb check(jsonb_typeof(storage_objects)='array'),
 storage_purged_at timestamptz,
 anonymized_at timestamptz not null default clock_timestamp()
);
alter table public.natori_case_anonymizations enable row level security;
revoke all on table public.natori_case_anonymizations from public,anon,authenticated,service_role;
grant select on table public.natori_case_anonymizations to service_role;
grant update(storage_purged_at) on table public.natori_case_anonymizations to service_role;

-- 依頼フォームの回答のうち、自由記入だけを空にする。選択式の回答（種類・用途・予算・納期・公開条件）は残す。
create function natori_case_guard.scrub_request_v1(j jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare r jsonb:=j; k text;
begin
 if j is null or jsonb_typeof(j)<>'object' then return j; end if;
 foreach k in array array['characterFeatures','expressionMood','composition','colorDirection','referenceNotes'] loop
  if r ? k then r:=jsonb_set(r,array[k],'""'::jsonb); end if;
 end loop;
 if r ? 'message' then r:=jsonb_set(r,'{message}',to_jsonb('（匿名化済み）'::text)); end if;
 if jsonb_typeof(r->'deadline')='object' and r->'deadline' ? 'note' then r:=jsonb_set(r,'{deadline,note}','""'::jsonb); end if;
 if jsonb_typeof(r->'legacySource')='object' then
  r:=jsonb_set(r,'{legacySource}',(r->'legacySource')||'{"referenceUrlsText":"","details":"","message":""}'::jsonb);
 end if;
 return r;
end $$;
revoke all on function natori_case_guard.scrub_request_v1(jsonb) from public,anon,authenticated,service_role;

-- 書き換え禁止の 3 つに、匿名化の関数の中だけの例外を足す。ほかの書き手（service_role を含む）には今まで通り。
do $patch$
declare t record; p record; body text; inject text;
begin
 for t in select * from (values
   ('public.natori_notification_immutable_v1()','snapshot,payload'),
   ('public.natori_delivery_release_guard_v1()','snapshot'),
   ('public.guard_natori_quote_snapshot_immutability()','to_email,request_snapshot')) v(fn,cols) loop
  select *,pg_get_functiondef(oid) definition into p from pg_proc where oid=t.fn::regprocedure;
  if p.prosrc like '%natori_case_anonymize_v1%' then raise exception 'case_anonymize_already_patched: %',t.fn; end if;
  inject:=format($i$
 if tg_op='UPDATE' and exists(select 1 from natori_case_guard.frames f where f.pid=pg_backend_pid() and f.tx=txid_current()
   and f.root='natori_case_anonymize_v1' and f.project_id=old.project_id)
  and to_jsonb(new)-%1$L::text[]=to_jsonb(old)-%1$L::text[] then return new; end if;
$i$,string_to_array(t.cols,','));
  body:=regexp_replace(p.prosrc,'(\n\s*begin[ \t]*\n)',E'\\1'||replace(inject,'\','\\'));
  if body=p.prosrc then raise exception 'case_anonymize_patch_failed: %',t.fn; end if;
  execute replace(p.definition,p.prosrc,body);
 end loop;
end $patch$;

create function public.natori_case_anonymize_v1(p_owner uuid,p_project uuid,p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p public.natori_projects%rowtype; v_kind text; v_label text; v_title text; v_files jsonb; frame bigint;
 v_days constant integer:=90;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'natori_system_isolation' using errcode='40001';end if;
 perform natori_case_guard.shared_lock();
 perform natori_case_guard.check_contract('natori_case_anonymize_v1');
 if p_owner is null or p_project is null or jsonb_typeof(p_input)<>'object'
  or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('kind','operator'))
  or coalesce(p_input->>'kind','') not in ('scheduled','manual')
  or coalesce(p_input->'operator'->>'kind','') not in ('auth-user','shared-key','schedule')
  or ((p_input->>'kind'='scheduled')<>(p_input->'operator'->>'kind'='schedule'))
  then return jsonb_build_object('result','invalid'); end if;
 v_kind:=p_input->>'kind';
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('result','not-found'); end if;
 if exists(select 1 from public.natori_case_anonymizations a where a.project_id=p.id) then
  return (select jsonb_build_object('result','already','label',a.label,'storage',a.storage_objects,'storagePurged',a.storage_purged_at is not null)
   from public.natori_case_anonymizations a where a.project_id=p.id); end if;
 -- 終わった案件だけ。進行中の案件は、先に「完了」か「終了」にする。
 if p.status not in ('completed','closed') then return jsonb_build_object('result','not-eligible'); end if;
 if v_kind='scheduled' and coalesce(p.completed_at,p.updated_at)>clock_timestamp()-make_interval(days=>v_days) then
  return jsonb_build_object('result','too-early'); end if;
 -- 送信の途中・結果不明の通知が残っている間は触らない。
 if exists(select 1 from public.natori_notification_jobs j where j.project_id=p.id and j.status in ('pending','sending','unknown')) then
  return jsonb_build_object('result','busy'); end if;

 v_label:='依頼者 #'||upper(substr(encode(sha256(convert_to(p.id::text,'UTF8')),'hex'),1,8));
 v_title:=case when length(btrim(p.client_name))>0 then replace(p.title,p.client_name,v_label) else p.title end;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',x.bucket,'path',x.path) order by x.bucket,x.path),'[]'::jsonb) into v_files from (
  select 'natori-consultations' bucket,storage_path path from public.natori_consultation_files where project_id=p.id
  union select 'natori-consultations',storage_path from public.natori_consultation_uploads where project_id=p.id
  union select 'natori-inquiry-refs',storage_path from public.natori_inquiry_reference_files where project_id=p.id
  union select 'natori-deliveries',storage_path from public.natori_delivery_files where project_id=p.id) x;

 insert into natori_case_guard.frames(pid,tx,root,owner_id,project_id,fact)
  values(pg_backend_pid(),txid_current(),'natori_case_anonymize_v1',p.user_id,p.id,false) returning depth into frame;
 begin
  -- 案件本体
  update public.natori_projects set client_name=v_label,client_email=null,title=v_title,note=null,
   request_data=natori_case_guard.scrub_request_v1(request_data) where id=p.id;
  -- 見積：宛名・件名・本文・金額・条件は残す。宛先アドレスと依頼文の写しだけ消す。
  update public.natori_quotes set to_email='',request_snapshot=natori_case_guard.scrub_request_v1(request_snapshot) where project_id=p.id;
  -- 送信記録：見積と支払い案内は本文を残し、宛先だけ消す。ほか（ラフ・納品）は本文も消す。
  update public.natori_order_mail_logs set to_email='',link_url=null,
   subject=case when kind in ('estimate','payment') then subject else '（匿名化済み）' end,
   body_snapshot=case when kind in ('estimate','payment') then body_snapshot else '' end where project_id=p.id;
  -- 通知の控え
  update public.natori_notification_jobs j set
   snapshot=case when jsonb_typeof(j.snapshot)='object' then (j.snapshot-'clientEmail'-'requestData'-'referenceLinkUrls')
     ||case when j.snapshot ? 'clientName' then jsonb_build_object('clientName',v_label) else '{}'::jsonb end
     ||case when j.snapshot ? 'title' then jsonb_build_object('title',v_title) else '{}'::jsonb end else j.snapshot end,
   payload=case when jsonb_typeof(j.payload)<>'object' then j.payload
     when j.payload ? 'ciphertext' then j.payload||jsonb_build_object('ciphertext','','iv','','tag','','purged',true)
     when j.purpose in ('quote_issue_client','payment_link_client') then (j.payload-'to')||jsonb_build_object('anonymized',true)
     else (j.payload-'to'-'text'-'subject'-'reply_to'-'headers')||jsonb_build_object('anonymized',true) end
   where j.project_id=p.id;
  -- 納品記録の写し
  update public.natori_delivery_releases r set snapshot=(r.snapshot-'clientEmail')
    ||case when r.snapshot ? 'clientName' then jsonb_build_object('clientName',v_label) else '{}'::jsonb end
    ||case when r.snapshot ? 'title' then jsonb_build_object('title',v_title) else '{}'::jsonb end
   where r.project_id=p.id and jsonb_typeof(r.snapshot)='object';
  -- 相談ページ：本文とファイル名。行は残す（ラフに OK が出た日時などがここを指しているため）。
  update public.natori_consultation_messages set body='（匿名化済み）' where project_id=p.id;
  update public.natori_consultation_operations o set body='',manifest='[]'::jsonb,
   notice_payload=case when jsonb_typeof(o.notice_payload)='object' and o.notice_payload ? 'ciphertext'
     then o.notice_payload||jsonb_build_object('ciphertext','','iv','','tag','','purged',true) else o.notice_payload end
   where o.project_id=p.id;
  update public.natori_consultation_files set file_name='file' where project_id=p.id;
  update public.natori_consultation_uploads set file_name='file' where project_id=p.id;
  -- もう要らないもの
  delete from public.natori_project_reference_links where project_id=p.id;
  delete from public.natori_estimate_drafts where project_id=p.id;
  delete from public.natori_consultation_access where project_id=p.id;
  delete from public.natori_quote_access a using public.natori_quotes q where a.quote_id=q.id and q.project_id=p.id;
  delete from public.natori_delivery_access a using public.natori_delivery_releases r where a.release_id=r.id and r.project_id=p.id;
  update public.natori_case_items set note=null where project_id=p.id and note is not null;
  -- 本番にだけある操作記録の表（名前とアドレスの写しを持つ）
  if to_regclass('public.natori_case_current_operations') is not null then
   execute $q$update public.natori_case_current_operations set expected=(expected-'email')
     ||case when expected ? 'clientName' then jsonb_build_object('clientName',$2) else '{}'::jsonb end
     ||case when expected ? 'title' then jsonb_build_object('title',$3) else '{}'::jsonb end
    where project_id=$1 and jsonb_typeof(expected)='object'$q$ using p.id,v_label,v_title;
  end if;
  insert into public.natori_case_anonymizations(project_id,owner_id,label,kind,operator,storage_objects)
   values(p.id,p_owner,v_label,v_kind,p_input->'operator',v_files);
 exception when others then
  delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;raise;
 end;
 delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
 return jsonb_build_object('result','applied','label',v_label,'storage',v_files,'storagePurged',false);
end $$;
revoke all on function public.natori_case_anonymize_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_anonymize_v1(uuid,uuid,jsonb) to service_role;

do $finalize$
declare obj text;
begin
 execute 'create trigger natori_000_system_lock before insert or update or delete or truncate on public.natori_case_anonymizations for each statement execute function natori_case_guard.statement_guard()';
 execute 'create trigger zzzz_natori_system_row before insert or update or delete on public.natori_case_anonymizations for each row execute function natori_case_guard.row_guard()';
 insert into natori_case_guard.permissions values('natori_case_anonymize_v1','schema','public','USAGE'),
  ('natori_case_anonymize_v1','function','public.natori_case_anonymize_v1(uuid,uuid,jsonb)'::regprocedure::oid::text,'EXECUTE');
 insert into natori_case_guard.dependencies select * from natori_case_guard.images() on conflict(kind,identity) do update set image=excluded.image;
 for obj in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(obj);end loop;
end $finalize$;
commit;
