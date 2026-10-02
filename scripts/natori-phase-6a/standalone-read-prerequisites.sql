-- Isolated standalone0B reader prerequisites only; does not enable PhaseN cases.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('phase_t.sandbox',true) IS DISTINCT FROM 'ephemeral' THEN
    RAISE EXCEPTION 'ephemeral sandbox required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute AS a
      WHERE a.attrelid='public.natori_projects'::regclass
        AND a.attname IN ('delivered_mail_at','delivery_accepted_at') AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'standalone0B prerequisites must be absent before their single installation';
  END IF;
END
$guard$;
ALTER TABLE public.natori_projects
  ADD COLUMN delivered_mail_at timestamptz,
  ADD COLUMN delivery_accepted_at timestamptz;
COMMIT;
