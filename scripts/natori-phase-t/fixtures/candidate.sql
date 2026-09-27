-- TEST CANDIDATE ONLY. Not an approved production migration.
DO $$ BEGIN
  IF current_setting('phase_t.sandbox', true) IS DISTINCT FROM 'ephemeral' THEN
    RAISE EXCEPTION 'Phase T sandbox required';
  END IF;
END $$;
BEGIN;
DROP POLICY "Allow Insert 1exduyn_0" ON storage.objects;
DROP POLICY "Allow public access 1exduyn_1" ON storage.objects;
DROP POLICY "Allow public access 1exduyn_2" ON storage.objects;
DROP POLICY "Allow public access 1exduyn_3" ON storage.objects;
-- Public SELECT and all existing avatar/banner owner policies remain.
-- artworks and private natori writes now require service or signed upload.
-- The existing anonymous gallery entry writer will need a separate 0A adapter.
COMMIT;
