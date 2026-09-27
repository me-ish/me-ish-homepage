-- CONTROLLED CUTOVER ONLY. This file is deliberately outside migrations.
-- Runbook approval + compatibility deployment required. Never restore PUBLIC writes.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
DO $$
DECLARE p record;
BEGIN
  IF current_setting('natori.phase_0a_cutover', true) IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Explicit Phase 0A cutover approval required';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects') <> 17 THEN
    RAISE EXCEPTION 'Storage policy inventory changed; full catalogue review required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='gallery-entry-intake' AND NOT public
    AND file_size_limit=10485760 AND allowed_mime_types=ARRAY['image/jpeg','image/png']::text[]) THEN
    RAISE EXCEPTION 'Expand migration missing or staging bucket differs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='gallery intake requires signed service access' AND permissive='RESTRICTIVE'
    AND cmd='ALL' AND roles=ARRAY['anon','authenticated']::name[]
    AND qual='(bucket_id <> ''gallery-entry-intake''::text)'
    AND with_check='(bucket_id <> ''gallery-entry-intake''::text)') THEN
    RAISE EXCEPTION 'Staging authorization guard differs';
  END IF;
  -- Fail closed if any of the four reviewed definitions drifted; do not drop by name alone.
  FOR p IN SELECT * FROM (VALUES
    ('Allow Insert 1exduyn_0','INSERT',NULL::text,'true'),
    ('Allow public access 1exduyn_1','UPDATE','(bucket_id = ''artworks''::text)',NULL::text),
    ('Allow public access 1exduyn_2','INSERT',NULL::text,'(bucket_id = ''artworks''::text)'),
    ('Allow public access 1exduyn_3','DELETE','(bucket_id = ''artworks''::text)',NULL::text)
  ) expected(policyname,cmd,qual,with_check) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies x WHERE x.schemaname='storage' AND x.tablename='objects'
      AND x.policyname=p.policyname AND x.cmd=p.cmd AND x.permissive='PERMISSIVE'
      AND x.roles=ARRAY['public']::name[] AND x.qual IS NOT DISTINCT FROM p.qual
      AND x.with_check IS NOT DISTINCT FROM p.with_check) THEN
      RAISE EXCEPTION 'Reviewed write policy differs: %', p.policyname;
    END IF;
  END LOOP;
END $$;
DROP POLICY "Allow Insert 1exduyn_0" ON storage.objects;
DROP POLICY "Allow public access 1exduyn_1" ON storage.objects;
DROP POLICY "Allow public access 1exduyn_2" ON storage.objects;
DROP POLICY "Allow public access 1exduyn_3" ON storage.objects;
COMMIT;
