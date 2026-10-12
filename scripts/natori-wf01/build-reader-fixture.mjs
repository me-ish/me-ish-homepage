import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';
export const prerequisitePaths = [
  'supabase/migrations/20260923033156_natori_consultation_messages.sql',
  'supabase/migrations/20260923033205_natori_consultation_files.sql',
  'supabase/migrations/20260923033212_natori_consultation_link_renewal.sql',
  'supabase/migrations/20260927102757_natori_consultation_overview.sql',
  'supabase/migrations/20261001225106_natori_consultation_operations.sql',
  'supabase/migrations/20261011140000_natori_talk_roughs.sql',
  'supabase/migrations/20261012085748_natori_rough_ok_followup.sql',
];
const standalonePaths = [
  'scripts/natori-phase-n/fixture.sql',
  'scripts/natori-phase-n/accept-quote-catalog.sql',
  'supabase/migrations/20260806120330_natori_accept_delivery_rpc.sql',
  'supabase/migrations/20260927073530_natori_acceptance_notifications.sql',
];
const guard = `do $$begin if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'WF01 ephemeral fixture required';end if;end$$;\n`;
const present = `do $$begin if to_regclass('public.natori_rough_ok_events') is null or to_regclass('public.natori_rough_ok_acknowledgements') is null or to_regprocedure('public.natori_consultation_overview_v2(uuid,uuid[])') is null then raise exception 'WF01 reader prerequisite missing';end if;end$$;\n`;
export function buildReaderFixture(mode, root=process.cwd()) {
  if(!['initial','standalone-0b','verify-existing','late-phase3b'].includes(mode))throw Error('WF01_FIXTURE_MODE_REJECTED');
  const read = path => {
    const absolute=realpathSync(resolve(root,path)),child=relative(realpathSync(root),absolute);
    if(child.startsWith('..')||isAbsolute(child))throw Error('WF01_FIXTURE_SOURCE_REJECTED');
    return readFileSync(absolute,'utf8');
  };
  if(mode==='verify-existing')return {sql:guard+present,paths:[]};
  if(mode==='late-phase3b')return {sql:guard+present+`
-- Prior native Phase2/3 fixtures install exact older CHECK predicates. Restore
-- only required current reader purposes while preserving their installed set.
do $$declare definition text;begin
 select pg_get_expr(conbin,conrelid) into strict definition from pg_constraint where conrelid='public.natori_notification_jobs'::regclass and conname='natori_notification_jobs_purpose_check' and contype='c' and convalidated;
 execute 'alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check';
 execute 'alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check check (('||definition||') or purpose in (''consultation_staff'',''consultation_client'',''rough_ok_artist''))';
end$$;
`,paths:[]};
  const paths=mode==='standalone-0b'?[...standalonePaths,...prerequisitePaths]:prerequisitePaths;
  return {sql:guard+`do $$begin if to_regclass('public.natori_consultation_messages') is not null or to_regprocedure('public.natori_consultation_overview_v2(uuid,uuid[])') is not null then raise exception 'WF01 reader prerequisite must install once';end if;end$$;\n`+paths.map(read).join('\n')+'\n'+present+"notify pgrst,'reload schema';\n",paths};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const [, , output, mode, evidence]=process.argv;
 if(!output||!evidence)throw Error('WF01_FIXTURE_OUTPUT_AND_EVIDENCE_REQUIRED');
 const built=buildReaderFixture(mode);
 writeFileSync(output,built.sql);
 const paths=[...built.paths,'scripts/natori-wf01/build-reader-fixture.mjs'];
 writeFileSync(evidence,JSON.stringify({mode,sha256:Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))},null,2)+'\n');
}
