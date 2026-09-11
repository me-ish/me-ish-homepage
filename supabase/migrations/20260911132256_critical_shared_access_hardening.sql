begin;

-- Critical shared-project hardening.
--
-- card_requests / aura_projects are server-only base tables. Public pages,
-- owner/session flows, checkout, and webhook updates are mediated by Next.js
-- server code using supabaseAdmin().
--
-- The privileged legacy RPCs below are likewise called only from server-side
-- service-role code. Keep anon/authenticated Data API callers out of both the
-- tables and the SECURITY DEFINER functions.
do $hardening$
begin
  if to_regclass('public.card_requests') is not null then
    execute 'alter table public.card_requests enable row level security';
    execute 'revoke all privileges on table public.card_requests from public, anon, authenticated';
    execute 'grant all privileges on table public.card_requests to service_role';
  end if;

  if to_regclass('public.aura_projects') is not null then
    execute 'alter table public.aura_projects enable row level security';
    execute 'revoke all privileges on table public.aura_projects from public, anon, authenticated';
    execute 'grant all privileges on table public.aura_projects to service_role';
  end if;

  if to_regprocedure('public.admin_mark_sales_paid(uuid,uuid)') is not null then
    execute 'revoke all on function public.admin_mark_sales_paid(uuid, uuid) from public, anon, authenticated';
    execute 'grant execute on function public.admin_mark_sales_paid(uuid, uuid) to service_role';
  end if;

  if to_regprocedure('public.finalize_sale(bigint,integer,text)') is not null then
    execute 'revoke all on function public.finalize_sale(bigint, integer, text) from public, anon, authenticated';
    execute 'grant execute on function public.finalize_sale(bigint, integer, text) to service_role';
  end if;

  if to_regprocedure('public.finalize_sale(bigint,integer,text,integer)') is not null then
    execute 'revoke all on function public.finalize_sale(bigint, integer, text, integer) from public, anon, authenticated';
    execute 'grant execute on function public.finalize_sale(bigint, integer, text, integer) to service_role';
  end if;

  if to_regprocedure('public.get_auth_user_id_by_email(text)') is not null then
    execute 'revoke all on function public.get_auth_user_id_by_email(text) from public, anon, authenticated';
    execute 'grant execute on function public.get_auth_user_id_by_email(text) to service_role';
  end if;
end
$hardening$;

commit;
