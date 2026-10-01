import {readFileSync,writeFileSync} from 'node:fs';
writeFileSync(process.argv[2],`alter table public.natori_projects add column if not exists payment_link_id text, add column if not exists payment_link_url text;\n`+readFileSync('supabase/migrations/20261001161401_natori_payment_link_generations.sql','utf8')+"\nNOTIFY pgrst, 'reload schema';\n");
