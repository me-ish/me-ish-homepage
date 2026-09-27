import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync('supabase/legacy-migrations/202607200001_natori_beta_safety.sql','utf8');
const start=source.indexOf('create or replace function public.natori_create_project_with_tasks(');
const end=source.indexOf('create or replace function public.natori_delete_project(',start);
if(start<0||end<=start)throw new Error('Reviewed RPC boundary changed');
// Exact existing RPC, not a fake that bypasses transaction/FK behavior.
writeFileSync(process.argv[2],readFileSync('scripts/natori-phase-0b/fixture.sql','utf8')+'\n'+source.slice(start,end)+"\nNOTIFY pgrst, 'reload schema';\n");
