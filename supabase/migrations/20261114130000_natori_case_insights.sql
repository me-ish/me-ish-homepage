-- 案件ごとの「振り返り用の記録」。依頼の経路・見送りの理由・リピーターかどうか。
--
-- どれも選択肢の値だけで、名前やメールアドレスなど個人を指す情報は持たない。
-- そのため、依頼者情報を匿名化したあとも残して、件数の集計に使える。
-- 見積・支払い・納品・案件本体（natori_projects）の行と関数は一切変えない。
-- 読み書きはサーバー（service_role）だけ。所有者の確認はアプリ側で行う（品目の表と同じ方式）。
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);

create table public.natori_case_insights (
  project_id uuid primary key,
  source text,
  close_reason text,
  repeat_client boolean,
  updated_at timestamptz not null default now(),
  constraint natori_case_insights_project_id_fkey
    foreign key (project_id)
    references public.natori_projects(id)
    on delete cascade,
  constraint natori_case_insights_source_check
    check (source is null or source in ('x', 'pixiv', 'tsunagu', 'referral', 'other')),
  constraint natori_case_insights_close_reason_check
    check (close_reason is null or close_reason in ('budget', 'schedule', 'content', 'no_reply', 'other'))
);

alter table public.natori_case_insights enable row level security;

create policy natori_service_only
on public.natori_case_insights
for all
to anon, authenticated
using (false)
with check (false);

revoke all privileges on table public.natori_case_insights
from public, anon, authenticated, service_role;

grant select, insert, update
on table public.natori_case_insights
to service_role;

comment on table public.natori_case_insights is
  '案件ごとの振り返り用の記録（依頼の経路・見送りの理由・リピーターかどうか）。選択肢の値だけを持ち、匿名化のあとも残す。';

-- 新しい表を、案件の「守りの台帳」に登録する（登録が無いと守りの関数が止まる）。
do $contract$
declare r record; n integer;
begin
 -- 食い違いがこの表 1 つだけであることを確かめる。ほかにあれば何もせず止める。
 select count(*) into n from natori_case_guard.dependencies d full join natori_case_guard.images() i using(kind,identity)
  where d.image is distinct from i.image
   and (coalesce(d.kind,i.kind),coalesce(d.identity,i.identity)) <> ('relation','public.natori_case_insights');
 if n<>0 then raise exception 'case_insights_contract_unexpected_drift: %',n; end if;
 insert into natori_case_guard.dependencies
  select * from natori_case_guard.images() i
   where (i.kind,i.identity) = ('relation','public.natori_case_insights')
  on conflict(kind,identity) do update set image=excluded.image;
 for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root); end loop;
end $contract$;
commit;
