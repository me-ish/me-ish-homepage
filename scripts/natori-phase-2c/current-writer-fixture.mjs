import {readFileSync} from 'node:fs';

// The disposable Phase 2C profile must exercise the writer used by today's
// service, including its real outbound fence. Never replace that fence with an
// unconditional fixture permission or apply these excerpts to a linked DB.
export function currentPaymentWriterFixture() {
 const read=p=>readFileSync(p,'utf8');
 const section=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  if(a<0||b<=a)throw Error('Reviewed current payment fixture boundary changed');
  return source.slice(a,b);
 };
 const workspace=read('supabase/migrations/20261021032000_natori_case_payment_workspace.sql');
 const reconciliation=read('supabase/migrations/20261021180000_natori_case_reconciliation.sql');
 return [
  section(workspace,'alter table public.natori_payment_link_operations','-- One MVCC snapshot.'),
  section(reconciliation,'begin;','-- Hash canonical records,'),
  section(reconciliation,'create function public.natori_case_outbound_blocked_v1(','-- Current canonical identity,'),
  section(reconciliation,'create or replace function public.natori_payment_links_v1(','create or replace function public.natori_case_payment_snapshot_v1('),
  'revoke all on function public.natori_case_outbound_blocked_v1(uuid,uuid,uuid) from public,anon,authenticated;',
  'grant execute on function public.natori_case_outbound_blocked_v1(uuid,uuid,uuid) to service_role;',
  'commit;',
 ].join('\n');
}
