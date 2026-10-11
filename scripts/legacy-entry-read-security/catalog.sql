SELECT jsonb_build_object(
  'entry_acl', (SELECT relacl::text FROM pg_class WHERE oid = 'public.entries'::regclass),
  'entry_rls', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.entries'::regclass),
  'column_acls', (SELECT jsonb_agg(jsonb_build_object('name', attname, 'acl', attacl::text)
    ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.entries'::regclass
    AND attnum > 0 AND NOT attisdropped),
  'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname)
    FROM pg_policies p WHERE schemaname = 'public' AND tablename = 'entries'),
  'rows', (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.entries e)
);
