-- =========================================================
-- MyPage: RLS for sales / entry_processing_jobs
-- =========================================================

-- -----------------------------
-- sales: artists can SELECT own sales only
-- -----------------------------
alter table public.sales enable row level security;

-- 既存のdeny系があるなら消す（あれば）
drop policy if exists deny_all_anon on public.sales;
drop policy if exists deny_all_auth on public.sales;

revoke all on table public.sales from anon;
revoke all on table public.sales from authenticated;

-- 読み取りだけ許可（書き込みはサーバ/管理者で）
grant select on table public.sales to authenticated;

drop policy if exists sales_select_own on public.sales;
create policy sales_select_own
on public.sales
for select
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = sales.entry_id
      and (
        e.user_id = auth.uid()
        or e.email = auth.email()
      )
  )
);

-- （必要なら）管理者フルアクセス
drop policy if exists sales_admin_all on public.sales;
create policy sales_admin_all
on public.sales
for all
to authenticated
using (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid)
with check (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid);


-- -----------------------------
-- entry_processing_jobs: artists can SELECT own only
-- -----------------------------
alter table public.entry_processing_jobs enable row level security;

drop policy if exists deny_all_anon on public.entry_processing_jobs;
drop policy if exists deny_all_auth on public.entry_processing_jobs;

revoke all on table public.entry_processing_jobs from anon;
revoke all on table public.entry_processing_jobs from authenticated;

grant select on table public.entry_processing_jobs to authenticated;

drop policy if exists entry_processing_jobs_select_own on public.entry_processing_jobs;
create policy entry_processing_jobs_select_own
on public.entry_processing_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.entries e
    where e.id = entry_processing_jobs.entry_id
      and (
        e.user_id = auth.uid()
        or e.email = auth.email()
      )
  )
);

drop policy if exists entry_processing_jobs_admin_all on public.entry_processing_jobs;
create policy entry_processing_jobs_admin_all
on public.entry_processing_jobs
for all
to authenticated
using (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid)
with check (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid);
