import {readFileSync,writeFileSync} from 'node:fs';
import {reviewedIntakeParts} from '../natori-q03/fixture-prerequisites.mjs';
const read=p=>readFileSync(p,'utf8');
if(!process.argv[2])throw new Error('OUTPUT_REQUIRED');
writeFileSync(process.argv[2],[read('scripts/natori-phase-3a/fixture.sql'),
 reviewedIntakeParts().remaining,
 read('supabase/migrations/20260908124222_etorie_publication_allowed_from_validator_fix.sql'),
 read('supabase/migrations/20261001222233_natori_intake_operations.sql'),"select public.phase3a_install_completion_wait_v1();","NOTIFY pgrst, 'reload schema';"].join('\n'));
