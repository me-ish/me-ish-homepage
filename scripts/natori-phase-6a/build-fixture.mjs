import {readFileSync,writeFileSync} from 'node:fs';
const migration='supabase/migrations/20261001223805_natori_task_integrity.sql';
const aliasPreflight=readFileSync('scripts/natori-phase-6a/alias-preflight.sql','utf8');
const guard=`do $$ begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
end $$;
`;
writeFileSync(process.argv[2],guard+readFileSync(migration,'utf8')+'\n'+aliasPreflight+`
-- Synthetic-only deterministic transaction controls, never product SQL.
create function public.phase6a_update_and_hold_v1(p_owner uuid,p_project uuid,p_task_key text,p_done boolean,p_seconds double precision) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare outcome jsonb;
begin
 if p_seconds<0.1 or p_seconds>3 then raise exception 'fixture_hold_invalid'; end if;
 perform id from public.natori_projects where id=p_project and user_id=p_owner and client_email='client@phase6a.invalid' and title='Task fixture' for update;
 if not found then raise exception 'synthetic_fixture_required'; end if;
 outcome:=public.natori_update_task_v1(p_owner,p_project,p_task_key,p_done);
 if outcome->>'result'<>'applied' then raise exception 'fixture_task_not_applied'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600061));
 perform pg_catalog.pg_sleep(p_seconds);
 return outcome;
end; $$;
create function public.phase6a_project_is_held_v1(p_project uuid) returns boolean
language sql security invoker set search_path='' as $$
 select not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600061))
$$;
revoke all on function public.phase6a_update_and_hold_v1(uuid,uuid,text,boolean,double precision),public.phase6a_project_is_held_v1(uuid) from public,anon,authenticated;
grant execute on function public.phase6a_update_and_hold_v1(uuid,uuid,text,boolean,double precision),public.phase6a_project_is_held_v1(uuid) to service_role;
NOTIFY pgrst, 'reload schema';
`);
