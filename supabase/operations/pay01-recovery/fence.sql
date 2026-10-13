-- PROPOSAL ONLY. Additional tracked migration name: natori_pay01_recovery_fence.
-- Separate approval/payload from the original PAY-01. No automatic retries.
-- The only writes are the two SECURITY DEFINER changes already in original PAY-01.
BEGIN;
DO $fence$
DECLARE item record; proc_oid oid; guard_oid oid;
BEGIN
  IF pg_catalog.pg_is_in_recovery()
    OR current_setting('transaction_isolation') <> 'read committed'
    OR NOT pg_has_role(current_user,'pg_read_all_stats','USAGE')
    OR current_setting('max_prepared_transactions')::integer <> 0
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_prepared_xacts)
    OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name IN ('natori_pay01_completion_evidence','natori_pay01_recovery_fence')
        OR version='20261012064005') THEN
    RAISE EXCEPTION 'PAY01_FENCE_STATE_REQUIRES_SEPARATE_REVIEW';
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)',
      '961f11c3c1b6d06ff8a6a797ca72f5a9'),
    ('public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz)',
      'e9ae3bbe50e0772c7c07355f234b053c')) expected(signature,body_md5)
  LOOP
    proc_oid:=to_regprocedure(item.signature);
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
      WHERE p.oid=proc_oid AND md5(p.prosrc)=item.body_md5
        AND pg_get_userbyid(p.proowner)='postgres' AND p.prokind='f'
        AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
        AND NOT p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
        AND p.provolatile='v' AND p.proparallel='u'
        AND p.proconfig=ARRAY['search_path=""']::text[])
      OR NOT has_function_privilege('service_role',proc_oid,'EXECUTE')
      OR has_function_privilege('anon',proc_oid,'EXECUTE')
      OR has_function_privilege('authenticated',proc_oid,'EXECUTE')
      OR (SELECT count(*)<>2 OR bool_or(a.privilege_type<>'EXECUTE'
        OR a.is_grantable OR a.grantor<>(SELECT proowner FROM pg_catalog.pg_proc WHERE oid=proc_oid)
        OR a.grantee NOT IN ('postgres'::regrole::oid,'service_role'::regrole::oid))
        FROM pg_catalog.pg_proc p,
          LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE p.oid=proc_oid) THEN
      RAISE EXCEPTION 'PAY01_FENCE_RPC_DRIFT';
    END IF;
  END LOOP;
  guard_oid:=to_regprocedure('public.natori_delivery_project_guard_v1()');
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=guard_oid
      AND md5(p.prosrc)='cc9ffe504e8856c3da331ac0b1e819be'
      AND pg_get_userbyid(p.proowner)='postgres' AND NOT p.prosecdef
      AND p.prokind='f' AND p.provolatile='v' AND p.proparallel='u'
      AND p.proconfig=ARRAY['search_path=""']::text[])
    OR has_function_privilege('anon',guard_oid,'EXECUTE')
    OR has_function_privilege('authenticated',guard_oid,'EXECUTE')
    OR has_function_privilege('service_role',guard_oid,'EXECUTE')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE
      tgrelid=to_regclass('public.natori_projects') AND tgname='natori_delivery_project_guard'
      AND tgfoid=guard_oid AND tgtype=19 AND tgenabled='O' AND NOT tgisinternal)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE
      tgrelid=to_regclass('public.natori_delivery_releases') AND tgname='natori_delivery_release_guard'
      AND tgfoid=to_regprocedure('public.natori_delivery_release_guard_v1()')
      AND tgtype=27 AND tgenabled='O' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'PAY01_FENCE_PROJECT_GUARD_DRIFT';
  END IF;
END;
$fence$;

ALTER FUNCTION public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) SECURITY DEFINER;
ALTER FUNCTION public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz) SECURITY DEFINER;
COMMIT;
