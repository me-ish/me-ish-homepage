import { readFileSync, writeFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const section = (source, start, end) => {
  const a=source.indexOf(start),b=source.indexOf(end,a);
  if(a<0||b<=a) throw new Error('Reviewed RPC boundary changed');
  return source.slice(a,b);
};
const activity=read('supabase/migrations/20260804112000_natori_project_activity.sql');
// No complete migration history, production seed, linked project or .temp is used.
const sql=[read('scripts/natori-phase-0b/fixture.sql'),read('scripts/natori-phase-n/fixture.sql'),
  read('scripts/natori-phase-n/accept-quote-catalog.sql'),
  read('supabase/migrations/20260806120330_natori_accept_delivery_rpc.sql'),
  section(activity,'create table public.natori_project_activity (','create function public.record_natori_quote_issued_activity()'),
  section(activity,'create function public.record_natori_delivery_activity()','commit;'),
  read('supabase/migrations/20260927073530_natori_acceptance_notifications.sql'),
  read('scripts/natori-phase-n/faults.sql'),
  "NOTIFY pgrst, 'reload schema';"].join('\n');
writeFileSync(process.argv[2],sql);
