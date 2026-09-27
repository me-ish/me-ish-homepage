SELECT jsonb_build_object(
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname) p),
 'buckets',(SELECT jsonb_agg(to_jsonb(b)) FROM (SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id) b),
 'grants',(SELECT jsonb_agg(jsonb_build_object('role',r,'schema_usage',has_schema_privilege(r,'storage','USAGE'),'select',has_table_privilege(r,'storage.objects','SELECT'),'insert',has_table_privilege(r,'storage.objects','INSERT'),'update',has_table_privilege(r,'storage.objects','UPDATE'),'delete',has_table_privilege(r,'storage.objects','DELETE'))) FROM unnest(ARRAY['anon','authenticated','service_role']) r),
 'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass));
