import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8'),baseline=read('supabase/migrations/20260723111730_etorie_baseline.sql');
const start=baseline.indexOf('create function public.natori_record_stripe_payment('),end=baseline.indexOf('create function public.natori_issue_quote(',start);
if(start<0||end<=start)throw new Error('Reviewed payment boundary changed');
writeFileSync(process.argv[2],[read('scripts/natori-phase-2b/fixture.sql'),baseline.slice(start,end),
 'revoke all on function public.natori_record_stripe_payment(uuid,text,integer,uuid) from public,anon,authenticated;',
 'grant execute on function public.natori_record_stripe_payment(uuid,text,integer,uuid) to service_role;',
 read('supabase/migrations/20261001150445_natori_payment_event_inbox.sql'),"NOTIFY pgrst, 'reload schema';"].join('\n'));
