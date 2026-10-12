BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.entries WHERE email <> '') <> 5 THEN
    RAISE EXCEPTION 'BASELINE_ANON_EMAIL_READ_NOT_REPRODUCED';
  END IF;
  RAISE NOTICE 'PASS baseline reproduces anonymous private-column access';
END $$;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","email":"alice@example.invalid"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.entries WHERE id = 2 AND email <> '') <> 1 THEN
    RAISE EXCEPTION 'BASELINE_OTHER_OWNER_EMAIL_READ_NOT_REPRODUCED';
  END IF;
  RAISE NOTICE 'PASS baseline reproduces other-owner access';
END $$;
ROLLBACK;
