begin;
alter table public.natori_consultation_access add column renewed_at timestamptz;
grant update on public.natori_consultation_access to service_role;
commit;
