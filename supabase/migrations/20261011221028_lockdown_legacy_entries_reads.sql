-- DB-01: the retired gallery's public-row policy exposed private entry columns.
-- Keep authenticated owner reads for bank maintenance; server-role certificate,
-- receipt and administrative reads retain their existing permissions.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $lockdown$
DECLARE columns_sql text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_POSTGRES_REQUIRED';
  END IF;
  -- Fresh Etorie/Natori replay intentionally contains no legacy gallery table.
  -- Skip only a missing relation; an existing but unsafe/drifted table still fails.
  IF to_regclass('public.entries') IS NULL THEN
    RAISE NOTICE 'ENTRY_READ_LOCKDOWN_LEGACY_TABLE_ABSENT';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.entries')
      AND relkind = 'r' AND relrowsecurity) THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_RLS_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.entries'::regclass
      AND attname = 'user_id' AND atttypid = 'uuid'::regtype AND NOT attisdropped)
      OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.entries'::regclass
      AND attname = 'email' AND atttypid = 'text'::regtype AND NOT attisdropped)
      OR to_regprocedure('auth.uid()') IS NULL
      OR to_regprocedure('auth.email()') IS NULL THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_IDENTITY_SCHEMA_DRIFT';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.entries', 'SELECT')
      OR NOT has_table_privilege('service_role', 'public.entries', 'SELECT')
      OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_EXISTING_ROLE_BOUNDARY_DRIFT';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entries'
      AND policyname IN ('entries_deny_anon_select', 'entries_limit_authenticated_select')) THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_POLICY_ALREADY_EXISTS';
  END IF;
  -- Traverse even private intermediate views: a public wrapper or materialized
  -- copy can expose a private definer's rows. Pure invoker chains inherit RLS.
  IF EXISTS (
    WITH RECURSIVE dependent_views(relation_id, unsafe) AS (
      SELECT 'public.entries'::regclass::oid, false
      UNION
      SELECT v.oid, parent.unsafe OR v.relkind = 'm'
        OR NOT coalesce(v.reloptions @> ARRAY['security_invoker=true'], false)
      FROM dependent_views parent
      JOIN pg_depend d ON d.refobjid = parent.relation_id
        AND d.refclassid = 'pg_class'::regclass AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_rewrite rw ON rw.oid = d.objid
      JOIN pg_class v ON v.oid = rw.ev_class
      WHERE v.relkind IN ('v', 'm') AND v.oid <> parent.relation_id
    )
    SELECT 1 FROM dependent_views d
    WHERE d.unsafe AND (
      has_any_column_privilege('anon', d.relation_id, 'SELECT')
      OR has_any_column_privilege('authenticated', d.relation_id, 'SELECT'))
  ) THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_UNSAFE_DEPENDENT_VIEW';
  END IF;
REVOKE SELECT ON TABLE public.entries FROM PUBLIC, anon;
-- A table REVOKE does not remove separately granted column privileges.
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns_sql
  FROM pg_attribute WHERE attrelid = 'public.entries'::regclass
    AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT (%s) ON TABLE public.entries FROM PUBLIC, anon', columns_sql);
-- Defense in depth if a later migration accidentally restores an anon grant.
CREATE POLICY entries_deny_anon_select ON public.entries
  AS RESTRICTIVE FOR SELECT TO anon USING (false);

-- Intersects all existing permissive SELECT/ALL policies, including the old
-- public-row allow. A linked user_id is authoritative; email fallback is only
-- for unlinked legacy records and uses verified Auth claims, not user_metadata.
CREATE POLICY entries_limit_authenticated_select ON public.entries
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      user_id = (SELECT auth.uid())
      OR (user_id IS NULL AND email = (SELECT auth.email()))
    )
  );

  IF has_any_column_privilege('anon', 'public.entries', 'SELECT') THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_ANON_PRIVILEGE_REMAINS';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.entries', 'SELECT')
      OR NOT has_table_privilege('service_role', 'public.entries', 'SELECT') THEN
    RAISE EXCEPTION 'ENTRY_READ_LOCKDOWN_OWNER_OR_SERVER_READ_LOST';
  END IF;
END
$lockdown$;
COMMIT;
