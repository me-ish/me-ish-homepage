-- Exact privilege rollback for apply.sql, after deliberate review.
-- Restores the captured client RPC grants (including PUBLIC); it re-enables
-- old creation/edit operations. Keep the application stop active unless resumed.
-- Caller must SET meish.legacy_stop = 'rollback-20261009' in this session.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE r record; signature text; actual_acl text[];
BEGIN
  IF current_setting('meish.legacy_stop', true) IS DISTINCT FROM 'rollback-20261009'
     OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'LEGACY_STOP_REVIEWED_ROLLBACK_SESSION_REQUIRED';
  END IF;
  -- Refuse to remove a changed policy or restore over a changed RPC ACL.
  FOR r IN SELECT * FROM (VALUES
    ('public','entries','legacy_stop_insert','INSERT',NULL,'false'),
    ('public','entries','legacy_stop_update','UPDATE','false','false'),
    ('public','profiles','legacy_stop_insert','INSERT',NULL,'false'),
    ('public','profiles','legacy_stop_update','UPDATE','false','false'),
    ('public','portfolio_settings','legacy_stop_insert','INSERT',NULL,'false'),
    ('public','portfolio_settings','legacy_stop_update','UPDATE','false','false'),
    ('public','likes','legacy_stop_insert','INSERT',NULL,'false'),
    ('public','entry_comments','legacy_stop_insert','INSERT',NULL,'false'),
    ('storage','objects','legacy_stop_storage_insert','INSERT',NULL,'(bucket_id <> ALL (ARRAY[''artworks''::text, ''avatars''::text, ''banners''::text, ''aura-assets''::text, ''card-assets''::text, ''gallery-entry-intake''::text, ''processing-meta''::text]))'),
    ('storage','objects','legacy_stop_storage_update','UPDATE','(bucket_id <> ALL (ARRAY[''artworks''::text, ''avatars''::text, ''banners''::text, ''aura-assets''::text, ''card-assets''::text, ''gallery-entry-intake''::text, ''processing-meta''::text]))','(bucket_id <> ALL (ARRAY[''artworks''::text, ''avatars''::text, ''banners''::text, ''aura-assets''::text, ''card-assets''::text, ''gallery-entry-intake''::text, ''processing-meta''::text]))')
  ) AS expected(schema_name, table_name, policy_name, command, old_using, old_check) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies p
      WHERE p.schemaname=r.schema_name AND p.tablename=r.table_name
        AND p.policyname=r.policy_name AND p.cmd=r.command
        AND p.permissive='RESTRICTIVE'
        AND p.roles=ARRAY['anon','authenticated']::name[]
        AND p.qual IS NOT DISTINCT FROM r.old_using
        AND p.with_check IS NOT DISTINCT FROM r.old_check) THEN
      RAISE EXCEPTION 'LEGACY_STOP_ROLLBACK_POLICY_DRIFT: %.%', r.table_name,r.policy_name;
    END IF;
  END LOOP;
  FOREACH signature IN ARRAY ARRAY['public.aura_claim_first20_free(text,uuid)','public.aura_claim_meish_free(text,uuid)','public.set_entry_portfolio_hidden(bigint,boolean)','public.increment_entry_likes(bigint)','public.toggle_like(anyelement)'] LOOP
    SELECT ARRAY(SELECT a::text FROM unnest(p.proacl) a ORDER BY a::text COLLATE "C")
      INTO actual_acl FROM pg_proc p WHERE p.oid=to_regprocedure(signature)
        AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef;
    IF actual_acl IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres']::text[] THEN
      RAISE EXCEPTION 'LEGACY_STOP_ROLLBACK_RPC_ACL_DRIFT: %', signature;
    END IF;
  END LOOP;
END
$preflight$;

DROP POLICY legacy_stop_insert ON public.entries;
DROP POLICY legacy_stop_update ON public.entries;
DROP POLICY legacy_stop_insert ON public.profiles;
DROP POLICY legacy_stop_update ON public.profiles;
DROP POLICY legacy_stop_insert ON public.portfolio_settings;
DROP POLICY legacy_stop_update ON public.portfolio_settings;
DROP POLICY legacy_stop_insert ON public.likes;
DROP POLICY legacy_stop_insert ON public.entry_comments;
DROP POLICY legacy_stop_storage_insert ON storage.objects;
DROP POLICY legacy_stop_storage_update ON storage.objects;

-- Only grants present in the reviewed baseline are restored. No grant options.
GRANT EXECUTE ON FUNCTION public.aura_claim_first20_free(text,uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aura_claim_meish_free(text,uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_entry_portfolio_hidden(bigint,boolean) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_entry_likes(bigint) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_like(anyelement) TO PUBLIC, authenticated;
COMMIT;
