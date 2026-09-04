-- =========================================================
-- artists_bank_accounts RLS (owner via external_user_id)
-- =========================================================

alter table public.artists_bank_accounts enable row level security;

-- 既存のdeny全消し（存在すれば）
drop policy if exists deny_all_anon on public.artists_bank_accounts;
drop policy if exists deny_all_auth on public.artists_bank_accounts;

-- 念のため：権限（ログインユーザーのみ）
revoke all on table public.artists_bank_accounts from anon;
revoke all on table public.artists_bank_accounts from authenticated;

grant select, insert, update on table public.artists_bank_accounts to authenticated;

-- ---------------------------------------------------------
-- 本人: 自分の external_user_id に紐づくレコードだけ SELECT
-- ---------------------------------------------------------
drop policy if exists artists_bank_accounts_select_own on public.artists_bank_accounts;
create policy artists_bank_accounts_select_own
on public.artists_bank_accounts
for select
to authenticated
using (
  external_user_id in (select external_user_id from public.v_my_external_user_ids)
);

-- ---------------------------------------------------------
-- 本人: 自分の external_user_id に紐づくレコードだけ INSERT
-- （クライアント側で external_user_id を必ず送る）
-- ---------------------------------------------------------
drop policy if exists artists_bank_accounts_insert_own on public.artists_bank_accounts;
create policy artists_bank_accounts_insert_own
on public.artists_bank_accounts
for insert
to authenticated
with check (
  external_user_id in (select external_user_id from public.v_my_external_user_ids)
);

-- ---------------------------------------------------------
-- 本人: 自分の external_user_id に紐づくレコードだけ UPDATE
-- ---------------------------------------------------------
drop policy if exists artists_bank_accounts_update_own on public.artists_bank_accounts;
create policy artists_bank_accounts_update_own
on public.artists_bank_accounts
for update
to authenticated
using (
  external_user_id in (select external_user_id from public.v_my_external_user_ids)
)
with check (
  external_user_id in (select external_user_id from public.v_my_external_user_ids)
);

-- ---------------------------------------------------------
-- 管理者: 全件 ALL（必要なら）
-- ---------------------------------------------------------
drop policy if exists artists_bank_accounts_admin_all on public.artists_bank_accounts;
create policy artists_bank_accounts_admin_all
on public.artists_bank_accounts
for all
to authenticated
using (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid)
with check (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid);
