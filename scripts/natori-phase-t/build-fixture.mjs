import { readFileSync, writeFileSync } from 'node:fs';
const source = JSON.parse(readFileSync(new URL('./fixtures/catalog.json', import.meta.url)));
const quote = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const ident = (s) => '"' + s.replaceAll('"', '""') + '"';
const sql = [
  `DO $$ BEGIN IF current_setting('phase_t.sandbox', true) IS DISTINCT FROM 'ephemeral' THEN RAISE EXCEPTION 'Phase T sandbox required'; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects) OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects') THEN RAISE EXCEPTION 'Fresh sandbox required'; END IF; END $$;`,
  'BEGIN;',
  'GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;',
  'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;',
];
for (const b of source.buckets) {
  const types = b.allowed_mime_types ? `ARRAY[${b.allowed_mime_types.map(quote).join(',')}]::text[]` : 'NULL';
  sql.push(`INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES (${quote(b.id)},${quote(b.id)},${b.public},${b.file_size_limit ?? 'NULL'},${types});`);
}
// Reviewed catalogue expressions are fixture SQL, never external runtime input.
for (const p of source.policies) {
  sql.push(`CREATE POLICY ${ident(p.policyname)} ON storage.objects AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r => r === 'public' ? 'PUBLIC' : ident(r)).join(', ')}${p.qual ? ` USING (${p.qual})` : ''}${p.with_check ? ` WITH CHECK (${p.with_check})` : ''};`);
}
sql.push('COMMIT;');
writeFileSync(process.argv[2], sql.join('\n') + '\n', { mode: 0o600 });
