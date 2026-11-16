-- サイトのフォームから来た案件でも、サイトの外で渡して「受け取ってもらった」と記録したものは、
-- 管理画面から完了にできるようにする。
--
-- これまで: 完了にする道は ①お客さんが納品ページで受け取る ②納品ページの期限切れ（deemed）
-- ③サイトの外で受けた案件を手で完了（external）の 3 つだけで、③は「フォーム経由・サイトの案件と
-- 記録した案件」を対象外にしていた。そのため、フォーム経由で受けて納品ページを使わずに渡した案件は
-- どの道にも当てはまらず、完了にも実績にもならなかった。
--
-- この SQL がすること（案件の中身は変えない）:
--   1. 関数 natori_case_complete_v1 の kind='external' の判定を 1 か所だけ直す。
--      フォーム経由・サイトの案件でも、作業記録に「サイトの外で受け取ってもらった」(manual_receipt) が
--      あれば通す。納品ページを出した案件・納品メールを送った案件はこれまでどおり対象外。
--   2. 案件の守りの台帳を更新し、全 root の確認を通す
-- 本番の関数本文は改行が CRLF なので、置き換えは 1 行の中に収まる文字列だけで行う。
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
do $preflight$
declare r record;
begin
 for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root);end loop;
end $preflight$;

-- 1. external の判定（それぞれ 1 か所だけ置き換える。見つからない・2 か所以上なら止める）
do $patch$
declare p record;body text;old text;
begin
 select *,pg_get_functiondef(oid) definition into p from pg_proc where oid='public.natori_case_complete_v1(uuid,uuid,jsonb)'::regprocedure;
 body:=p.prosrc;
 old:=$old0$or p.delivered_mail_at is not null or p.request_data is not null$old0$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'case_completion_handover_patch_count_0';end if;
 body:=replace(body,old,$new0$or p.delivered_mail_at is not null or (not exists(select 1 from public.natori_case_work_records where project_id=p.id and kind='manual_receipt') and (p.request_data is not null$new0$);
 old:=$old1$and data->>'origin'='internal') then$old1$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'case_completion_handover_patch_count_1';end if;
 body:=replace(body,old,$new1$and data->>'origin'='internal'))) then$new1$);
 execute replace(p.definition,p.prosrc,body);
end $patch$;

-- 2. 台帳の更新と全 root の確認
do $finalize$
declare obj text;
begin
 insert into natori_case_guard.dependencies select * from natori_case_guard.images() on conflict(kind,identity) do update set image=excluded.image;
 for obj in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(obj);end loop;
end $finalize$;
commit;
