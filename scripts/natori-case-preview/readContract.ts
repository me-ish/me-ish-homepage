import { CASE_MANAGEMENT_SQL } from "../../src/features/natori/server/caseManagementQuery";
import {CURRENT_LINK_READ_PROJECTION} from "../../src/features/natori/server/caseSnapshotFinancial";

export const CASE_WORKSPACE_MIGRATION_FILE = "20261021210100_natori_case_workspace_read.sql";

/** Canonical fixed read contract for the forward migration and isolated fixture.
 * A drift test compares the exact migration bytes with this renderer. Future SQL
 * changes require a new forward migration and pointer, never editing applied SQL.
 * No table grants, definer rights, mutation functions or dynamic SQL.
 */
export const CASE_WORKSPACE_READ_CONTRACT_SQL = `
CREATE OR REPLACE FUNCTION public.natori_case_snapshot_v1(p_project_id uuid,p_owner_id uuid)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $case_snapshot$
SELECT to_jsonb(envelope) FROM (${CASE_MANAGEMENT_SQL}) envelope
$case_snapshot$;
REVOKE ALL ON FUNCTION public.natori_case_snapshot_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.natori_case_snapshot_v1(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.natori_case_workspace_v1(p_owner_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $case_workspace$
WITH owned AS MATERIALIZED (
 SELECT p.id FROM public.natori_projects p WHERE p.user_id=p_owner_id ORDER BY p.id LIMIT 51
), bounded AS MATERIALIZED (
 SELECT id FROM owned WHERE (SELECT count(*) FROM owned)<=50
)
SELECT jsonb_build_object('complete',(SELECT count(*) FROM owned)<=50,
 'rows',COALESCE((SELECT jsonb_agg(s.snapshot ORDER BY b.id)
 FROM bounded b CROSS JOIN LATERAL public.natori_case_snapshot_v1(b.id,p_owner_id) AS s(snapshot)),'[]'::jsonb))
$case_workspace$;
REVOKE ALL ON FUNCTION public.natori_case_workspace_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.natori_case_workspace_v1(uuid) TO service_role;
`;

export function renderCaseWorkspaceMigration(): string {
  return `-- Fixed owner-scoped case reads. No table, row, RLS or default-ACL changes.
-- Canonical source: scripts/natori-case-preview/readContract.ts + caseManagementQuery.ts.
-- service_role bypasses RLS: callers MUST use the server-resolved owner and
-- validate every returned owner/id before normalization. Never accept a browser owner.
-- Apply only through a separately approved service migration; local checks use
-- synthetic dependency tables, not a successful full historical migration replay.
BEGIN;
${CASE_WORKSPACE_READ_CONTRACT_SQL.replace(CURRENT_LINK_READ_PROJECTION,"a.id::text AS attempt_id").replace("p.payment_link_status, p.payment_quote_id,", "p.payment_link_status,")}
-- Unexpected defaults or inherited browser execution rights abort atomically.
-- The function owner retains PostgreSQL's intrinsic owner rights. Explicit
-- EXECUTE grants are limited to that owner and service_role; service_role must
-- not have a delegated grant option.
DO $case_read_security$
DECLARE target oid;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.natori_case_snapshot_v1(uuid,uuid)'::regprocedure::oid,
    'public.natori_case_workspace_v1(uuid)'::regprocedure::oid
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc f WHERE f.oid=target
        AND f.provolatile='s' AND NOT f.prosecdef AND f.prokind='f'
        AND f.proconfig=ARRAY['search_path=""']::text[]
    ) OR pg_catalog.has_function_privilege('anon',target,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',target,'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('service_role',target,'EXECUTE')
      OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc f
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(f.proacl,pg_catalog.acldefault('f',f.proowner))) a
        WHERE f.oid=target AND a.privilege_type='EXECUTE'
          AND ((a.grantee<>f.proowner AND a.grantee<>'service_role'::regrole::oid)
            OR (a.grantee<>f.proowner AND a.is_grantable))
      ) THEN
      RAISE EXCEPTION 'NATORI_CASE_READ_SECURITY_CONTRACT_REQUIRED';
    END IF;
  END LOOP;
END
$case_read_security$;
COMMIT;
`;
}
