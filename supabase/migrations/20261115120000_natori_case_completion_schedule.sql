-- 納品ページの保存期限が過ぎても「受け取りました」が押されなかった案件を、毎日の処理で完了にできるようにする。
--
-- 規約には「保存期限が過ぎた時点で納品完了とみなす」と書いてあるが、これまでは管理画面で手で完了にする
-- 経路（natori_case_complete_v1 の kind='deemed'）しかなく、放っておくと完了にならず、
-- 「完了から 90 日で匿名化」の 90 日も数え始められなかった。
--
-- この SQL がすること（案件の中身は変えない）:
--   1. 完了の記録 natori_case_completions の operator に、毎日の処理を表す {"kind":"schedule"} を許す
--      （kind='deemed' のときだけ。人の操作を装う値は増やさない）
--   2. 関数 natori_case_complete_v1 の入力の確認を 1 か所だけ直す
--      （'auth-user' / 'shared-key' に加えて、deemed のときだけ 'schedule' を通す）。ほかの判定は変えない
--   3. 案件の守りの台帳を更新し、全 root の確認を通す
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
do $preflight$
declare r record;
begin
 for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root);end loop;
end $preflight$;

-- 1. operator の許す値
do $constraint$
declare c record; n integer:=0;
begin
 for c in select conname from pg_constraint
  where conrelid='public.natori_case_completions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%shared-key%' loop
  execute format('alter table public.natori_case_completions drop constraint %I',c.conname);
  n:=n+1;
 end loop;
 if n<>1 then raise exception 'case_completion_schedule_constraint_count_%',n;end if;
 alter table public.natori_case_completions add constraint natori_case_completions_operator_check
  check(jsonb_typeof(operator)='object'
   and (operator->>'kind' in ('auth-user','shared-key') or (kind='deemed' and operator->>'kind'='schedule')));
end $constraint$;

-- 2. 関数の入力確認（1 か所だけ置き換える。見つからない・2 か所以上なら止める）
do $patch$
declare p record;body text;old text;
begin
 select *,pg_get_functiondef(oid) definition into p from pg_proc where oid='public.natori_case_complete_v1(uuid,uuid,jsonb)'::regprocedure;
 body:=p.prosrc;
 old:=$old0$coalesce(p_input->'operator'->>'kind','') not in ('auth-user','shared-key')$old0$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'case_completion_schedule_patch_count_0';end if;
 body:=replace(body,old,$new0$(coalesce(p_input->'operator'->>'kind','') not in ('auth-user','shared-key')
    and not (p_input->>'kind'='deemed' and p_input->'operator'->>'kind'='schedule'))$new0$);
 execute replace(p.definition,p.prosrc,body);
end $patch$;

-- 3. 台帳の更新と全 root の確認
do $finalize$
declare obj text;
begin
 insert into natori_case_guard.dependencies select * from natori_case_guard.images() on conflict(kind,identity) do update set image=excluded.image;
 for obj in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(obj);end loop;
end $finalize$;
commit;
