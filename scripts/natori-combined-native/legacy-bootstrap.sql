-- Synthetic native-only identity/retired-entry prerequisites, not a schema dump.
-- The Natori foundation comes from the unchanged named migrations and platform fixture.
create function auth.email() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email',true),'')
$$;
grant execute on function auth.email() to anon,authenticated,service_role;
create table public.entries(
  id bigint primary key,user_id uuid,email text not null,
  title text not null,confirmed boolean not null,display_ready boolean not null,
  reject_reason text,plan_payment_session_id text
);
alter table public.entries enable row level security;
grant select,insert,update,delete on public.entries to anon,authenticated,service_role;
-- Exercise the migration's separate column and inherited PUBLIC revoke as well.
grant select(email,reject_reason) on public.entries to anon;
grant select(plan_payment_session_id) on public.entries to public;
create policy combined_fixture_legacy_public_rows on public.entries for select to public
  using(confirmed and display_ready);
create policy combined_fixture_legacy_owner on public.entries for select to authenticated
  using(user_id=auth.uid());
create policy combined_fixture_legacy_email on public.entries for select to authenticated
  using(email=auth.email());
insert into public.entries values
  (1,'00000000-0000-4000-8000-000000000001','owner@combined.invalid','Owner linked',true,true,'synthetic','synthetic-session'),
  (2,'00000000-0000-4000-8000-000000000002','other@combined.invalid','Other linked',true,true,'synthetic','synthetic-session'),
  (3,null,'owner@combined.invalid','Owner unlinked',true,true,'synthetic','synthetic-session'),
  (4,'00000000-0000-4000-8000-000000000002','owner@combined.invalid','Linked owner authoritative',true,true,'synthetic','synthetic-session');
-- Deliberately broad native fixture policy: prove SEC01's restrictive policy
-- intersects it without changing existing unrelated Storage grants or rows.
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
create policy combined_fixture_storage_allow on storage.objects for all to anon,authenticated
  using(true) with check(true);
