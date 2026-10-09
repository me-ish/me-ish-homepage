-- Canonical structural catalog only; OIDs and application row data excluded.
-- ACL arrays are sorted, retaining NULL versus explicit ACL and grantor names.
SELECT jsonb_build_object(
  'relations', (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.schema, q.name) FROM (
    SELECT n.nspname AS schema, c.relname AS name, c.relkind, r.rolname AS owner,
      c.relrowsecurity, c.relforcerowsecurity,
      CASE WHEN c.relacl IS NULL THEN NULL ELSE
        ARRAY(SELECT a::text FROM unnest(c.relacl) a ORDER BY a::text) END AS acl,
      (SELECT jsonb_agg(jsonb_build_object('name', a.attname,
        'type', format_type(a.atttypid, a.atttypmod), 'notnull', a.attnotnull,
        'default', (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d WHERE d.adrelid = c.oid AND d.adnum = a.attnum),
        'acl', CASE WHEN a.attacl IS NULL THEN NULL ELSE
          ARRAY(SELECT v::text FROM unnest(a.attacl) v ORDER BY v::text) END)
        ORDER BY a.attnum)
       FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
      (SELECT jsonb_agg(jsonb_build_object('name', k.conname, 'definition', pg_get_constraintdef(k.oid)) ORDER BY k.conname)
        FROM pg_constraint k WHERE k.conrelid = c.oid) AS constraints,
      (SELECT jsonb_agg(jsonb_build_object('name', t.tgname, 'definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled) ORDER BY t.tgname)
        FROM pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) AS triggers,
      CASE WHEN c.relkind = 'v' THEN pg_get_viewdef(c.oid) ELSE NULL END AS view_definition
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'v', 'p')
  ) q),
  'indexes', (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.schemaname, q.tablename, q.indexname)
    FROM (SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname IN ('public', 'storage')) q),
  'policies', (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.schemaname, q.tablename, q.policyname)
    FROM (SELECT schemaname, tablename, policyname, permissive,
      ARRAY(SELECT r FROM unnest(roles) r ORDER BY r) AS roles,
      cmd, qual, with_check FROM pg_policies WHERE schemaname IN ('public', 'storage')) q),
  'functions', (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.signature) FROM (
    SELECT n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS signature,
      r.rolname AS owner, pg_get_functiondef(p.oid) AS definition,
      CASE WHEN p.proacl IS NULL THEN NULL ELSE
        ARRAY(SELECT a::text FROM unnest(p.proacl) a ORDER BY a::text) END AS acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  ) q),
  'roles', (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.rolname) FROM (
    SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
    FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
  ) q),
  'memberships', (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.role, q.member), '[]'::jsonb) FROM (
    SELECT r.rolname AS role, m.rolname AS member, a.admin_option, a.inherit_option, a.set_option
    FROM pg_auth_members a JOIN pg_roles r ON r.oid = a.roleid JOIN pg_roles m ON m.oid = a.member
    WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
      OR m.rolname IN ('anon', 'authenticated', 'service_role')
  ) q)
);
