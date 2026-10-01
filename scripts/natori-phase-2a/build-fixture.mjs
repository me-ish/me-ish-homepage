import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const terms=read('supabase/migrations/20260923062556_natori_quote_agreed_terms.sql');
const a=terms.indexOf('create function public.guard_natori_quote_terms_immutability'),b=terms.indexOf('create function public.natori_issue_quote_with_terms');
if(a<0||b<=a)throw new Error('Reviewed terms boundary changed');
writeFileSync(process.argv[2],[read('scripts/natori-phase-2a/fixture.sql'),
 read('supabase/migrations/20260801234935_etorie_quote_snapshots_retry.sql'),
 read('supabase/migrations/20260802002947_harden_quote_snapshot_numeric_validation.sql'),terms.slice(a,b),
 read('supabase/migrations/20260923122157_natori_estimate_drafts_and_issuance.sql'),
 read('supabase/migrations/20261001133920_natori_quote_issue_integrity.sql'),"NOTIFY pgrst, 'reload schema';"].join('\n'));
