-- PROPOSAL ONLY. New READ COMMITTED observation after a confirmed fence commit.
-- No query text, PID/session identity, customer row, application RPC or DDL.
-- Root must require decision=ready and every readiness flag true, then send the
-- reviewed recovery payload once. An uncertain additional call is never resent.
BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
-- Separate first statement: dynamic activity is checked before the later
-- catalog SELECT acquires its own READ COMMITTED statement snapshot.
DO $quiescence$
DECLARE opened bigint; unknown_activity bigint; prepared bigint;
BEGIN
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  SELECT count(*) FILTER (WHERE xact_start IS NOT NULL),
    count(*) FILTER (WHERE backend_type IS NULL
      OR (backend_type='client backend' AND (state IS NULL OR state='disabled')))
    INTO opened,unknown_activity
    FROM pg_catalog.pg_stat_activity WHERE pid<>pg_backend_pid();
  SELECT count(*) INTO prepared FROM pg_catalog.pg_prepared_xacts;
  IF pg_catalog.pg_is_in_recovery()
    OR current_setting('transaction_isolation')<>'read committed'
    OR current_setting('transaction_read_only')<>'on'
    OR NOT pg_has_role(current_user,'pg_read_all_stats','USAGE')
    OR current_setting('track_activities')<>'on'
    OR current_setting('max_prepared_transactions')::integer<>0
    OR opened<>0 OR unknown_activity<>0 OR prepared<>0 THEN
    RAISE EXCEPTION 'PAY01_RECOVERY_NOT_QUIESCENT' USING ERRCODE='55000',
      DETAIL=jsonb_build_object('other_open_xact_count',opened,'unknown_count',unknown_activity,
        'prepared_count',prepared,'complete_stats_visibility',pg_has_role(current_user,'pg_read_all_stats','USAGE'),
        'track_activities',current_setting('track_activities'))::text;
  END IF;
END;
$quiescence$;
-- Separate second statement: no dynamic activity reads below. The zero counts
-- attest the gate above; errors stop the SQL and never return a ready result.
WITH expected(signature,body_md5) AS (VALUES
 ('public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)',
   '961f11c3c1b6d06ff8a6a797ca72f5a9'),
 ('public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz)',
   'e9ae3bbe50e0772c7c07355f234b053c')),
functions AS (SELECT e.signature,md5(p.prosrc) AS body_md5,p.prosecdef,
  p.oid IS NOT NULL AND md5(p.prosrc)=e.body_md5
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prokind='f'
    AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    AND NOT p.proisstrict AND NOT p.proleakproof
    AND p.provolatile='v' AND p.proparallel='u'
    AND p.proconfig=ARRAY['search_path=""']::text[]
    AND has_function_privilege('service_role',p.oid,'EXECUTE')
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND (SELECT count(*)=2 AND bool_and(a.privilege_type='EXECUTE'
      AND NOT a.is_grantable AND a.grantor=p.proowner
      AND a.grantee IN ('postgres'::regrole::oid,'service_role'::regrole::oid))
      FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)
    AS contract_pass
  FROM expected e LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure(e.signature)),
guard AS (SELECT md5(p.prosrc) AS body_md5,t.tgtype,t.tgenabled,
  pg_get_userbyid(p.proowner)='postgres' AND NOT p.prosecdef
    AND p.prokind='f' AND p.provolatile='v' AND p.proparallel='u'
    AND p.proconfig=ARRAY['search_path=""']::text[]
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
    AND t.oid IS NOT NULL AND t.tgfoid=p.oid AND t.tgenabled='O' AND NOT t.tgisinternal
    AS contract_pass
  FROM pg_catalog.pg_proc p LEFT JOIN pg_catalog.pg_trigger t
    ON t.tgrelid=to_regclass('public.natori_projects') AND t.tgname='natori_delivery_project_guard'
  WHERE p.oid=to_regprocedure('public.natori_delivery_project_guard_v1()')),
state AS (SELECT
  clock_timestamp() AS checked_at,
  NOT pg_catalog.pg_is_in_recovery() AS primary_pass,
  current_setting('transaction_isolation')='read committed'
    AND current_setting('transaction_read_only')='on' AS fresh_snapshot_pass,
  pg_has_role(current_user,'pg_read_all_stats','USAGE') AS complete_stats_visibility_pass,
  current_setting('track_activities')='on' AS activity_tracking_pass,
  current_setting('max_prepared_transactions')::integer=0 AS prepared_disabled_pass,
  0::bigint AS prepared_count,
  0::bigint AS other_open_xact_count,
  0::bigint AS unknown_count,
  (SELECT count(*) FROM supabase_migrations.schema_migrations
    WHERE name='natori_pay01_completion_evidence' OR version='20261012064005') AS pay_history_count,
  (SELECT count(*) FROM supabase_migrations.schema_migrations
    WHERE name='natori_pay01_recovery_fence') AS fence_history_count,
  (SELECT count(*)=2 AND bool_and(contract_pass AND prosecdef) FROM functions) AS rpc_fenced_contract_pass,
  (SELECT count(*)=1 AND bool_and(contract_pass AND body_md5='cc9ffe504e8856c3da331ac0b1e819be'
    AND tgtype=19) FROM guard) AS old_guard_contract_pass,
  (SELECT count(*)=1 AND bool_and(contract_pass AND body_md5='5669d0837ba50a7f5a31de9b08208d22'
    AND tgtype=23) FROM guard) AS final_guard_contract_pass,
  EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE
    tgrelid=to_regclass('public.natori_delivery_releases') AND tgname='natori_delivery_release_guard'
    AND tgfoid=to_regprocedure('public.natori_delivery_release_guard_v1()')
    AND tgtype=27 AND tgenabled='O' AND NOT tgisinternal) AS release_guard_pass,
  has_table_privilege('service_role','public.natori_delivery_releases','SELECT')
    AND NOT has_any_column_privilege('service_role','public.natori_delivery_releases','INSERT,UPDATE')
    AND NOT has_table_privilege('service_role','public.natori_delivery_releases','DELETE') AS final_release_acl_pass,
  NOT has_any_column_privilege('anon','public.natori_delivery_releases','SELECT,INSERT,UPDATE')
    AND NOT has_any_column_privilege('authenticated','public.natori_delivery_releases','SELECT,INSERT,UPDATE')
    AND NOT has_table_privilege('anon','public.natori_delivery_releases','DELETE,TRUNCATE,TRIGGER')
    AND NOT has_table_privilege('authenticated','public.natori_delivery_releases','DELETE,TRUNCATE,TRIGGER') AS release_browser_denied_pass),
decision AS (SELECT *,CASE
  WHEN pay_history_count=1 AND rpc_fenced_contract_pass IS TRUE
    AND final_guard_contract_pass IS TRUE AND release_guard_pass IS TRUE
    AND final_release_acl_pass IS TRUE AND release_browser_denied_pass IS TRUE THEN 'skip-pay-already-complete'
  WHEN pay_history_count=0 AND fence_history_count=1
    AND primary_pass IS TRUE AND fresh_snapshot_pass IS TRUE
    AND complete_stats_visibility_pass IS TRUE AND activity_tracking_pass IS TRUE AND prepared_disabled_pass IS TRUE
    AND prepared_count=0 AND other_open_xact_count=0 AND unknown_count=0
    AND rpc_fenced_contract_pass IS TRUE AND old_guard_contract_pass IS TRUE
    AND release_guard_pass IS TRUE AND release_browser_denied_pass IS TRUE THEN 'ready'
  ELSE 'stop-no-recovery'
  END AS decision FROM state)
SELECT jsonb_build_object('scope','catalog-and-prior-quiescence-gate-only','decision',d.decision,
 'checked_at',d.checked_at,'primary_pass',d.primary_pass,'fresh_snapshot_pass',d.fresh_snapshot_pass,
 'complete_stats_visibility_pass',d.complete_stats_visibility_pass,'prepared_disabled_pass',d.prepared_disabled_pass,
 'activity_tracking_pass',d.activity_tracking_pass,
 'prepared_count',d.prepared_count,'other_open_xact_count',d.other_open_xact_count,'unknown_count',d.unknown_count,
 'pay_history_count',d.pay_history_count,'fence_history_count',d.fence_history_count,
 'readiness',jsonb_build_object('rpc_fenced_contract_pass',d.rpc_fenced_contract_pass,
   'old_guard_contract_pass',d.old_guard_contract_pass,'release_guard_pass',d.release_guard_pass,
   'release_browser_denied_pass',d.release_browser_denied_pass,
   'quiescence_pass',d.other_open_xact_count=0 AND d.unknown_count=0 AND d.prepared_count=0),
 'already_complete',jsonb_build_object('final_guard_contract_pass',d.final_guard_contract_pass,
   'final_release_acl_pass',d.final_release_acl_pass),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',signature,'body_md5',body_md5,
   'definer',prosecdef,'contract_pass',contract_pass) ORDER BY signature) FROM functions),
 'guard',(SELECT jsonb_agg(jsonb_build_object('body_md5',body_md5,'type',tgtype,
   'enabled',tgenabled,'contract_pass',contract_pass)) FROM guard)) AS pay01_recovery_observation
FROM decision d;
COMMIT;
