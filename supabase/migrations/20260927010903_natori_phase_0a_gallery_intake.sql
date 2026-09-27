-- EXPAND ONLY: deploy before the gallery upload adapter. No existing bucket/object changes.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gallery-entry-intake', 'gallery-entry-intake', false, 10485760, ARRAY['image/jpeg','image/png']);
-- Restrictive policy closes this new bucket even while the legacy global INSERT remains.
-- Signed uploads/service_role bypass RLS; no client receives a service credential.
CREATE POLICY "gallery intake requires signed service access"
ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (bucket_id <> 'gallery-entry-intake')
WITH CHECK (bucket_id <> 'gallery-entry-intake');
COMMIT;
