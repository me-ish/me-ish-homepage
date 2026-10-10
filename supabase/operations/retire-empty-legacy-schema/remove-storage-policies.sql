-- Run only AFTER the approved seven empty buckets are deleted through Storage API.
-- Never DELETE FROM storage.buckets / storage.objects. Preserve Natori buckets.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $guard$
DECLARE actual jsonb;
BEGIN
  IF current_setting('meish.legacy_storage_cleanup', true) IS DISTINCT FROM 'reviewed-20261010' THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_REVIEWED_SESSION_REQUIRED';
  END IF;
  IF EXISTS (SELECT FROM storage.buckets WHERE id=ANY(ARRAY['artworks','avatars','banners','aura-assets','card-assets','gallery-entry-intake','processing-meta'])) OR
     EXISTS (SELECT FROM storage.objects WHERE bucket_id=ANY(ARRAY['artworks','avatars','banners','aura-assets','card-assets','gallery-entry-intake','processing-meta'])) THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_BUCKETS_MUST_ALREADY_BE_ABSENT';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Allow public access 1exduyn_0') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"SELECT","qual":"(bucket_id = 'artworks'::text)","roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Allow public access 1exduyn_0","schemaname":"storage","with_check":null}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'Allow public access 1exduyn_0';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Allow public read access sudlkv_0') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"SELECT","qual":"(bucket_id = 'processing-meta'::text)","roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Allow public read access sudlkv_0","schemaname":"storage","with_check":null}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'Allow public read access sudlkv_0';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='delete own avatar') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"DELETE","qual":"((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"delete own avatar","schemaname":"storage","with_check":null}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'delete own avatar';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='delete own banner') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"DELETE","qual":"((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"delete own banner","schemaname":"storage","with_check":null}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'delete own banner';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='gallery intake requires signed service access') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"ALL","qual":"(bucket_id <> 'gallery-entry-intake'::text)","roles":["anon","authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"gallery intake requires signed service access","schemaname":"storage","with_check":"(bucket_id <> 'gallery-entry-intake'::text)"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'gallery intake requires signed service access';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='legacy_stop_storage_insert') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"INSERT","qual":null,"roles":["anon","authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"legacy_stop_storage_insert","schemaname":"storage","with_check":"(bucket_id <> ALL (ARRAY['artworks'::text, 'avatars'::text, 'banners'::text, 'aura-assets'::text, 'card-assets'::text, 'gallery-entry-intake'::text, 'processing-meta'::text]))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'legacy_stop_storage_insert';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='legacy_stop_storage_update') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"UPDATE","qual":"(bucket_id <> ALL (ARRAY['artworks'::text, 'avatars'::text, 'banners'::text, 'aura-assets'::text, 'card-assets'::text, 'gallery-entry-intake'::text, 'processing-meta'::text]))","roles":["anon","authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"legacy_stop_storage_update","schemaname":"storage","with_check":"(bucket_id <> ALL (ARRAY['artworks'::text, 'avatars'::text, 'banners'::text, 'aura-assets'::text, 'card-assets'::text, 'gallery-entry-intake'::text, 'processing-meta'::text]))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'legacy_stop_storage_update';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='public read avatars & banners') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"SELECT","qual":"(bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text]))","roles":["anon","authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"public read avatars & banners","schemaname":"storage","with_check":null}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'public read avatars & banners';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='update own avatar') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"UPDATE","qual":"((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"update own avatar","schemaname":"storage","with_check":"((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'update own avatar';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='update own banner') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"UPDATE","qual":"((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"update own banner","schemaname":"storage","with_check":"((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'update own banner';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='upload own avatar') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"upload own avatar","schemaname":"storage","with_check":"((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'upload own avatar';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='upload own banner') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"upload own banner","schemaname":"storage","with_check":"((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'upload own banner';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='user can delete own avatars & banners') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"DELETE","qual":"((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"user can delete own avatars & banners","schemaname":"storage","with_check":null}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'user can delete own avatars & banners';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='user can update own avatars & banners') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"UPDATE","qual":"((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"user can update own avatars & banners","schemaname":"storage","with_check":"((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'user can update own avatars & banners';
  END IF;
  SELECT to_jsonb(q) INTO actual FROM (SELECT schemaname,tablename,policyname,permissive,
    ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,cmd,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='user can upload own avatars & banners') q;
  IF actual IS DISTINCT FROM $expected${"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"user can upload own avatars & banners","schemaname":"storage","with_check":"((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))"}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_STORAGE_POLICY_DRIFT: %', 'user can upload own avatars & banners';
  END IF;
END;
$guard$;
DROP POLICY "Allow public access 1exduyn_0" ON storage.objects;
DROP POLICY "Allow public read access sudlkv_0" ON storage.objects;
DROP POLICY "delete own avatar" ON storage.objects;
DROP POLICY "delete own banner" ON storage.objects;
DROP POLICY "gallery intake requires signed service access" ON storage.objects;
DROP POLICY "legacy_stop_storage_insert" ON storage.objects;
DROP POLICY "legacy_stop_storage_update" ON storage.objects;
DROP POLICY "public read avatars & banners" ON storage.objects;
DROP POLICY "update own avatar" ON storage.objects;
DROP POLICY "update own banner" ON storage.objects;
DROP POLICY "upload own avatar" ON storage.objects;
DROP POLICY "upload own banner" ON storage.objects;
DROP POLICY "user can delete own avatars & banners" ON storage.objects;
DROP POLICY "user can update own avatars & banners" ON storage.objects;
DROP POLICY "user can upload own avatars & banners" ON storage.objects;
COMMIT;
