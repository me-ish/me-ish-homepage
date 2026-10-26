import {readFileSync} from 'node:fs';

// Disposable legacy-profile fixtures need the real admission catalog used by
// today's source. No held owner is provisioned and no production setting changes.
export function caseAdmissionFixture() {
  const foundation=readFileSync('supabase/migrations/20261023010000_natori_case_system_hold.sql','utf8');
  const fence=readFileSync('supabase/migrations/20261023030000_natori_case_system_fence.sql','utf8');
  const start=fence.indexOf('create or replace function public.natori_case_system_admit_v1(');
  const end=fence.indexOf('end $admit$;',start);
  if(start<0||end<start)throw Error('Reviewed admission function boundary changed');
  return foundation+'\n'+fence.slice(start,end+'end $admit$;'.length)+'\n';
}
