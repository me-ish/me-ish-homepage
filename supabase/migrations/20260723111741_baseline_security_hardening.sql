-- Security corrections that are inseparable from the Etorie baseline release
-- state but are kept in a separate migration for review and Pattern C diffs.
--
-- Required order:
--   20260723111730_etorie_baseline.sql
--   20260723111741_baseline_security_hardening.sql

begin;

/* --------------------------------------------------------------------------
   Storage

   Remove only the bucket-agnostic public INSERT policy. Existing bucket/path
   scoped policies for artworks, avatars, and banners are intentionally kept.
   Natori private buckets have no direct anon/authenticated INSERT policy.
---------------------------------------------------------------------------- */

drop policy if exists "Allow Insert 1exduyn_0" on storage.objects;

/* --------------------------------------------------------------------------
   Stripe webhook idempotency ledger
---------------------------------------------------------------------------- */

revoke all privileges on table public.processed_stripe_events
  from public, anon, authenticated;
grant select, insert, delete on table public.processed_stripe_events
  to service_role;
alter table public.processed_stripe_events enable row level security;

/* --------------------------------------------------------------------------
   Project deletion API

   Preserve the existing function name and identity arguments for backwards
   compatibility, but make deletion a restorable, owner-checked operation.
   Calling it again for the same archived project succeeds without changing
   the original deleted_at timestamp.
---------------------------------------------------------------------------- */

create or replace function public.natori_delete_project(
  p_user_id uuid,
  p_project_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_project_id uuid;
begin
  select id into v_project_id
  from public.natori_projects
  where id = p_project_id
    and user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  update public.natori_projects
  set deleted_at = coalesce(deleted_at, now())
  where id = v_project_id;

  return true;
end;
$$;

revoke all on function public.natori_delete_project(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.natori_delete_project(uuid, uuid)
  to service_role;

comment on function public.natori_delete_project(uuid, uuid) is
  'Backwards-compatible project archive RPC. Performs owner-checked, idempotent soft delete only.';

/* --------------------------------------------------------------------------
   Shared Card/AURA tables

   Code inventory shows all base-table access uses supabaseAdmin() in server
   routes or Server Components. HttpOnly session cookies are checked before
   owner edits. Published pages are also projected by server code. Therefore
   the base tables do not require direct anon/authenticated Data API access.

   The Etorie baseline is intentionally Natori-scoped, so these guards make the
   migration usable in both an empty Pattern B database and a full Pattern C
   current-state clone. A missing table is not considered verified; the helper
   runbooks record that case as not_applicable_to_natori_only_pattern_b.
---------------------------------------------------------------------------- */

do $hardening$
begin
  if to_regclass('public.card_requests') is not null then
    execute 'alter table public.card_requests enable row level security';
    execute 'revoke all privileges on table public.card_requests from public, anon, authenticated';
    execute 'grant all privileges on table public.card_requests to service_role';
    execute $comment$
      comment on table public.card_requests is
      'Server-only base table. Public card reads and token-authenticated edits are mediated by application routes.'
    $comment$;
  end if;

  if to_regclass('public.aura_projects') is not null then
    execute 'alter table public.aura_projects enable row level security';
    execute 'revoke all privileges on table public.aura_projects from public, anon, authenticated';
    execute 'grant all privileges on table public.aura_projects to service_role';
    execute $comment$
      comment on table public.aura_projects is
      'Server-only base table. Public portfolio reads and session-token edits are mediated by application routes.'
    $comment$;
  end if;
end
$hardening$;

commit;
