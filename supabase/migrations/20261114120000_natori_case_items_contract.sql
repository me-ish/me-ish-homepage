-- 品目の表（natori_case_items, 2026-11-05 追加）を、案件の「守りの台帳」に登録する。
-- 登録が無いと、台帳と実際の DB が食い違っていると判定され、
-- 見積の承諾・納品の受け取り・相談ページの送信・通知の送信完了などの関数が
-- natori_system_contract_changed で止まる。
-- 既存の行・表・関数は変えない。台帳に 2 行足すだけ。
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
do $contract$
declare r record; n integer;
begin
 -- 食い違いが「品目の表」と「その更新日時の関数」の 2 つだけであることを確かめる。ほかにあれば何もせず止める。
 select count(*) into n from natori_case_guard.dependencies d full join natori_case_guard.images() i using(kind,identity)
  where d.image is distinct from i.image
   and (coalesce(d.kind,i.kind),coalesce(d.identity,i.identity)) not in
    (('relation','public.natori_case_items'),('function','public.touch_natori_case_items_updated_at()'));
 if n<>0 then raise exception 'case_items_contract_unexpected_drift: %',n; end if;
 insert into natori_case_guard.dependencies
  select * from natori_case_guard.images() i
   where (i.kind,i.identity) in (('relation','public.natori_case_items'),('function','public.touch_natori_case_items_updated_at()'))
  on conflict(kind,identity) do update set image=excluded.image;
 for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root); end loop;
end $contract$;
commit;
