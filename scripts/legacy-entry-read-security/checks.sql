BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM email FROM public.entries;
    RAISE EXCEPTION 'ANON_EMAIL_READ_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.entries;
    RAISE EXCEPTION 'ANON_COUNT_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM plan_payment_session_id FROM public.entries;
    RAISE EXCEPTION 'PUBLIC_COLUMN_GRANT_REMAINED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.v_my_external_user_ids;
    RAISE EXCEPTION 'ANON_INVOKER_VIEW_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.v_my_external_user_ids_wrapper;
    RAISE EXCEPTION 'ANON_INVOKER_WRAPPER_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS anonymous table, count, column and invoker-view reads denied';
END $$;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","email":"alice@example.invalid"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT array_agg(id ORDER BY id) FROM public.entries) IS DISTINCT FROM ARRAY[1,3]::bigint[] THEN
    RAISE EXCEPTION 'OWNER_AND_UNLINKED_READ_INCORRECT';
  END IF;
  IF (SELECT count(*) FROM public.entries WHERE id = 2 OR id = 5) <> 0 THEN
    RAISE EXCEPTION 'OTHER_LINKED_OWNER_VISIBLE';
  END IF;
  IF (SELECT count(*) FROM public.entries WHERE id = 1 AND external_user_id IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'BANK_LOOKUP_BY_USER_ID_BROKEN';
  END IF;
  IF (SELECT count(*) FROM public.entries WHERE user_id IS NULL AND email = auth.email()
      AND external_user_id IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'BANK_LOOKUP_BY_EMAIL_BROKEN';
  END IF;
  IF (SELECT array_agg(id ORDER BY id) FROM public.v_my_external_user_ids)
      IS DISTINCT FROM ARRAY[1,3]::bigint[] THEN
    RAISE EXCEPTION 'INVOKER_VIEW_BYPASSED_OWNERSHIP';
  END IF;
  IF (SELECT array_agg(id ORDER BY id) FROM public.v_my_external_user_ids_wrapper)
      IS DISTINCT FROM ARRAY[1,3]::bigint[] THEN
    RAISE EXCEPTION 'INVOKER_WRAPPER_BYPASSED_OWNERSHIP';
  END IF;
  UPDATE public.entries SET title = 'must not change' WHERE id = 1;
  IF FOUND THEN RAISE EXCEPTION 'LEGACY_UPDATE_STOP_LOST'; END IF;
  BEGIN
    INSERT INTO public.entries (id, email, title, confirmed, display_ready)
      VALUES (99, 'alice@example.invalid', 'must not create', true, true);
    RAISE EXCEPTION 'LEGACY_INSERT_STOP_LOST';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS owner and email fallback, ID authority, bank lookup, view and existing write stop';
END $$;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","email":"bob@example.invalid","user_metadata":{"email":"alice@example.invalid"}}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT array_agg(id ORDER BY id) FROM public.entries) IS DISTINCT FROM ARRAY[2,5]::bigint[] THEN
    RAISE EXCEPTION 'SECOND_OWNER_OR_USER_METADATA_BOUNDARY_BROKEN';
  END IF;
  RAISE NOTICE 'PASS second owner; editable user_metadata grants no extra access';
END $$;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","email":"stranger@example.invalid"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.entries) THEN RAISE EXCEPTION 'STRANGER_CAN_READ'; END IF;
  RAISE NOTICE 'PASS unrelated authenticated user sees no entry';
END $$;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claims = '{"email":"alice@example.invalid"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.entries) THEN RAISE EXCEPTION 'MISSING_AUTH_SUBJECT_CAN_READ'; END IF;
  RAISE NOTICE 'PASS email alone without authenticated subject grants no access';
END $$;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT array_agg(id ORDER BY id) FROM public.entries) IS DISTINCT FROM ARRAY[1]::bigint[] THEN
    RAISE EXCEPTION 'OWNER_WITHOUT_EMAIL_BROKEN';
  END IF;
  RAISE NOTICE 'PASS linked owner without email';
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.entries) <> 5 THEN RAISE EXCEPTION 'SERVER_READ_BROKEN'; END IF;
  IF (SELECT count(*) FROM public.entries e JOIN public.cert_links c ON c.entry_id = e.id) <> 1 THEN
    RAISE EXCEPTION 'CERTIFICATE_READ_BROKEN';
  END IF;
  IF (SELECT count(*) FROM public.entries e JOIN public.sales s ON s.entry_id = e.id) <> 1 THEN
    RAISE EXCEPTION 'RECEIPT_FINANCIAL_READ_BROKEN';
  END IF;
  IF (SELECT count(*) FROM public.v_server_entries) <> 5 THEN RAISE EXCEPTION 'PRIVATE_SERVER_VIEW_BROKEN'; END IF;
  RAISE NOTICE 'PASS service-role certificate, receipt, financial and admin reads';
END $$;
ROLLBACK;

-- Deliberately restore broad grants in this rolled-back fixture transaction.
BEGIN;
GRANT SELECT ON public.entries TO PUBLIC, anon;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.entries) THEN RAISE EXCEPTION 'ANON_RLS_DEFENSE_BROKEN'; END IF;
  RAISE NOTICE 'PASS restrictive anonymous policy survives accidental broad grant';
END $$;
ROLLBACK;

DO $$ BEGIN
  IF has_any_column_privilege('anon', 'public.entries', 'SELECT') THEN
    RAISE EXCEPTION 'ANON_EFFECTIVE_COLUMN_PRIVILEGE_REMAINS';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entries'
      AND policyname IN ('entries_deny_anon_select', 'entries_limit_authenticated_select')
      AND permissive = 'RESTRICTIVE' AND cmd = 'SELECT') <> 2 THEN
    RAISE EXCEPTION 'READ_POLICIES_INCORRECT';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.entries e)
      IS DISTINCT FROM (SELECT entries FROM entry_read_test.before_state) THEN
    RAISE EXCEPTION 'BUSINESS_ROWS_CHANGED';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.natori_projects e)
      IS DISTINCT FROM (SELECT projects FROM entry_read_test.before_state)
    OR (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.natori_talk_roughs e)
      IS DISTINCT FROM (SELECT roughs FROM entry_read_test.before_state)
    OR (SELECT jsonb_agg(to_jsonb(e) ORDER BY entry_id) FROM public.cert_links e)
      IS DISTINCT FROM (SELECT certificates FROM entry_read_test.before_state)
    OR (SELECT jsonb_agg(to_jsonb(e) ORDER BY entry_id) FROM public.sales e)
      IS DISTINCT FROM (SELECT sales FROM entry_read_test.before_state)
    OR (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.artists_bank_accounts e)
      IS DISTINCT FROM (SELECT banks FROM entry_read_test.before_state)
    OR (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM storage.buckets e)
      IS DISTINCT FROM (SELECT buckets FROM entry_read_test.before_state)
    OR (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM storage.objects e)
      IS DISTINCT FROM (SELECT objects FROM entry_read_test.before_state) THEN
    RAISE EXCEPTION 'PROTECTED_ROWS_CHANGED';
  END IF;
  IF (SELECT jsonb_agg(jsonb_build_object('name', c.oid::regclass::text, 'acl', c.relacl::text,
      'rls', c.relrowsecurity) ORDER BY c.oid::regclass::text)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'v')
        AND c.oid <> 'public.entries'::regclass)
      IS DISTINCT FROM (SELECT protected_catalog FROM entry_read_test.before_state) THEN
    RAISE EXCEPTION 'PROTECTED_CATALOG_CHANGED';
  END IF;
  RAISE NOTICE 'PASS effective ACL, exact business rows and protected catalogs unchanged';
END $$;
