-- SEC-01/01B: only new management/draft assets; no legacy-object migration.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'SEC01_POSTGRES_REQUIRED'; END IF;
  IF to_regclass('public.natori_portfolio_content') IS NULL THEN RAISE EXCEPTION 'SEC01_PORTFOLIO_TABLE_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='natori-management-assets'
    AND (public OR file_size_limit IS DISTINCT FROM 50000000
      OR allowed_mime_types IS DISTINCT FROM ARRAY['image/webp','video/mp4']::text[])
  ) THEN
    RAISE EXCEPTION 'SEC01_EXISTING_BUCKET_CONFIGURATION_REQUIRES_REVIEW';
  END IF;
END
$guard$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('natori-management-assets','natori-management-assets',false,50000000,ARRAY['image/webp','video/mp4'])
ON CONFLICT(id) DO NOTHING;
DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='natori-management-assets'
    AND NOT public AND file_size_limit=50000000
    AND allowed_mime_types=ARRAY['image/webp','video/mp4']::text[]
  ) THEN RAISE EXCEPTION 'SEC01_BUCKET_POSTCONDITION_FAILED'; END IF;
END
$postcheck$;
CREATE POLICY sec01_private_assets_browser_deny ON storage.objects
AS RESTRICTIVE FOR ALL TO anon,authenticated
USING(bucket_id <> 'natori-management-assets')
WITH CHECK(bucket_id <> 'natori-management-assets');
CREATE TABLE public.natori_portfolio_assets(
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN('image','video')),
  path text NOT NULL UNIQUE,
  byte_size bigint NOT NULL CHECK(byte_size>0 AND byte_size<=50000000),
  ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Upload bearers name staging only. Ready videos are independent server copies.
  CHECK(
    (kind='image' AND ready AND path='portfolio/'||owner_id::text||'/'||id::text||'.webp')
    OR (kind='video' AND NOT ready AND path='portfolio-staging/'||owner_id::text||'/'||id::text||'.mp4')
    OR (kind='video' AND ready AND path ~ ('^portfolio/'||owner_id::text||'/'||id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$'))
  )
);
CREATE INDEX natori_portfolio_assets_owner_idx ON public.natori_portfolio_assets(owner_id);
ALTER TABLE public.natori_portfolio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY sec01_asset_metadata_management_only ON public.natori_portfolio_assets
AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.natori_portfolio_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.natori_portfolio_assets TO service_role;
ALTER TABLE public.natori_portfolio_content ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0 AND revision<=9007199254740990);
ALTER TABLE public.natori_portfolio_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.natori_portfolio_content FROM PUBLIC,anon,authenticated;
CREATE POLICY sec01_portfolio_management_only ON public.natori_portfolio_content
AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
-- Invalidate an editor revision even if an older deployed writer still updates the row.
CREATE FUNCTION public.sec01_portfolio_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $revision$
BEGIN NEW.revision=OLD.revision+1; RETURN NEW; END
$revision$;
REVOKE ALL ON FUNCTION public.sec01_portfolio_revision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sec01_portfolio_revision() TO service_role;
CREATE TRIGGER trg_sec01_portfolio_revision BEFORE UPDATE ON public.natori_portfolio_content
FOR EACH ROW EXECUTE FUNCTION public.sec01_portfolio_revision();
CREATE FUNCTION public.natori_save_portfolio_content(expected_revision bigint,next_content jsonb)
RETURNS TABLE(saved_revision bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $save$
DECLARE new_revision bigint;
BEGIN
  IF expected_revision<0 OR jsonb_typeof(next_content) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'SEC01_INVALID_SAVE';
  END IF;
  UPDATE public.natori_portfolio_content c SET content=next_content,revision=c.revision+1
  WHERE c.id='main' AND c.revision=expected_revision RETURNING c.revision INTO new_revision;
  IF FOUND THEN RETURN QUERY SELECT new_revision; RETURN; END IF;
  IF expected_revision=0 THEN
    INSERT INTO public.natori_portfolio_content(id,content,revision) VALUES('main',next_content,1)
    ON CONFLICT(id) DO NOTHING RETURNING revision INTO new_revision;
    IF FOUND THEN RETURN QUERY SELECT new_revision; END IF;
  END IF;
END
$save$;
REVOKE ALL ON FUNCTION public.natori_save_portfolio_content(bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.natori_save_portfolio_content(bigint,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
