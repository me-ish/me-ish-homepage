-- Reviewed operation, not an automatically applied migration.
-- Deploy the matching application stop first. Existing reads, service-role
-- writes, bank/payout maintenance and every natori_* object remain unchanged.
-- Caller must SET meish.legacy_stop = 'apply-20261009' in this session.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE r record; actual_acl text[]; target_oid oid;
BEGIN
  IF current_setting('meish.legacy_stop', true) IS DISTINCT FROM 'apply-20261009'
     OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'LEGACY_STOP_REVIEWED_APPLY_SESSION_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls)
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolbypassrls OR rolsuper))
     OR pg_has_role('anon','service_role','MEMBER')
     OR pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION 'LEGACY_STOP_ROLE_BOUNDARY_DRIFT';
  END IF;
  FOR r IN SELECT unnest(ARRAY['public.entries','public.profiles','public.portfolio_settings','public.likes','public.entry_comments','public.entry_view_events','public.aura_requests','public.card_requests','public.aura_projects','storage.objects']) AS name LOOP
    target_oid := to_regclass(r.name);
    IF target_oid IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid=target_oid AND relkind='r' AND relrowsecurity
    ) THEN RAISE EXCEPTION 'LEGACY_STOP_RLS_REQUIRED: %', r.name; END IF;
  END LOOP;
  -- Existing server-only AURA/CARD request roots and viewer events stay closed.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('aura_requests','entry_view_events')
    AND cmd IN ('INSERT','ALL') AND permissive='PERMISSIVE'
    AND roles && ARRAY['public','anon','authenticated']::name[]
    AND coalesce(with_check,qual,'true') <> 'false')
     OR has_any_column_privilege('anon','public.card_requests','INSERT')
     OR has_any_column_privilege('authenticated','public.card_requests','INSERT')
     OR has_any_column_privilege('anon','public.aura_projects','INSERT')
     OR has_any_column_privilege('authenticated','public.aura_projects','INSERT') THEN
    RAISE EXCEPTION 'LEGACY_STOP_EXISTING_CREATION_BOUNDARY_DRIFT';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname IN ('public','storage')
    AND policyname IN ('legacy_stop_insert','legacy_stop_update','legacy_stop_storage_insert','legacy_stop_storage_update')) THEN
    RAISE EXCEPTION 'LEGACY_STOP_POLICY_ALREADY_EXISTS';
  END IF;
  -- Exact reviewed ACL sets: refuse drift rather than grant new capabilities.
  FOR r IN SELECT * FROM (VALUES
      ('public.aura_claim_first20_free(text,uuid)', ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
      ('public.aura_claim_meish_free(text,uuid)', ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
      ('public.set_entry_portfolio_hidden(bigint,boolean)', ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
      ('public.increment_entry_likes(bigint)', ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
      ('public.toggle_like(anyelement)', ARRAY['=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[])
  ) AS expected(signature, acl) LOOP
    target_oid := to_regprocedure(r.signature);
    IF target_oid IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_proc WHERE oid=target_oid AND prosecdef
        AND pg_get_userbyid(proowner)='postgres'
    ) THEN RAISE EXCEPTION 'LEGACY_STOP_RPC_DEFINITION_DRIFT: %', r.signature; END IF;
    SELECT ARRAY(SELECT a::text FROM unnest(p.proacl) a ORDER BY a::text COLLATE "C")
      INTO actual_acl FROM pg_proc p WHERE p.oid=target_oid;
    IF actual_acl IS DISTINCT FROM r.acl THEN
      RAISE EXCEPTION 'LEGACY_STOP_RPC_ACL_DRIFT: %', r.signature;
    END IF;
  END LOOP;
END
$preflight$;

CREATE POLICY legacy_stop_insert ON public.entries
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY legacy_stop_update ON public.entries
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY legacy_stop_insert ON public.profiles
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY legacy_stop_update ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY legacy_stop_insert ON public.portfolio_settings
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY legacy_stop_update ON public.portfolio_settings
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY legacy_stop_insert ON public.likes
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY legacy_stop_insert ON public.entry_comments
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);

-- Command-specific restrictions intentionally leave SELECT and DELETE alone.
-- Existing signed upload tokens may survive for two hours after issuance;
-- application sign/finish endpoints must already be stopped.
CREATE POLICY legacy_stop_storage_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id NOT IN ('artworks', 'avatars', 'banners', 'aura-assets', 'card-assets', 'gallery-entry-intake', 'processing-meta'));
CREATE POLICY legacy_stop_storage_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (bucket_id NOT IN ('artworks', 'avatars', 'banners', 'aura-assets', 'card-assets', 'gallery-entry-intake', 'processing-meta'))
  WITH CHECK (bucket_id NOT IN ('artworks', 'avatars', 'banners', 'aura-assets', 'card-assets', 'gallery-entry-intake', 'processing-meta'));

REVOKE EXECUTE ON FUNCTION public.aura_claim_first20_free(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aura_claim_meish_free(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_entry_portfolio_hidden(bigint,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_entry_likes(bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_like(anyelement) FROM PUBLIC, anon, authenticated;

DO $verify$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['public.aura_claim_first20_free(text,uuid)','public.aura_claim_meish_free(text,uuid)','public.set_entry_portfolio_hidden(bigint,boolean)','public.increment_entry_likes(bigint)','public.toggle_like(anyelement)'] LOOP
    IF has_function_privilege('anon',signature,'EXECUTE')
       OR has_function_privilege('authenticated',signature,'EXECUTE')
       OR NOT has_function_privilege('service_role',signature,'EXECUTE') THEN
      RAISE EXCEPTION 'LEGACY_STOP_RPC_POSTCONDITION: %', signature;
    END IF;
  END LOOP;
END
$verify$;
COMMIT;
