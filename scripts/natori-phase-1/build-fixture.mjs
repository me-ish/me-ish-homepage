import { readFileSync, writeFileSync } from 'node:fs';
// Runs only after the reviewed Phase N fixture/tests. No full migration history or production seed.
const sql = [readFileSync('scripts/natori-phase-1/fixture.sql', 'utf8'),
  readFileSync('supabase/migrations/20260930101753_natori_delivery_integrity.sql', 'utf8')];
writeFileSync(process.argv[2], sql.join('\n') + "\nNOTIFY pgrst, 'reload schema';\n");
