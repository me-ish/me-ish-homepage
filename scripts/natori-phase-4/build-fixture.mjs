import { readFileSync, writeFileSync } from 'node:fs';
// Install the legacy consultation definitions and their current operation schema in the isolated Phase N fixture.
// No production seed, linked project, business rows or full migration history.
const paths = [
  'supabase/migrations/20260923033156_natori_consultation_messages.sql',
  'supabase/migrations/20260923033205_natori_consultation_files.sql',
  'supabase/migrations/20260923033212_natori_consultation_link_renewal.sql',
  'supabase/migrations/20260927102757_natori_consultation_overview.sql',
  'supabase/migrations/20261001225106_natori_consultation_operations.sql',
];
writeFileSync(process.argv[2], paths.map(path => readFileSync(path, 'utf8')).join('\n') + "\nNOTIFY pgrst, 'reload schema';\n");
