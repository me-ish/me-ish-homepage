import {readFileSync,writeFileSync} from 'node:fs';
const baseline=readFileSync('supabase/migrations/20260723111730_etorie_baseline.sql','utf8');
const start=baseline.indexOf('create table public.natori_order_mail_logs ('),end=baseline.indexOf('create table public.natori_inquiry_reference_files',start);
if(start<0||end<=start)throw new Error('Reviewed legacy mail fixture boundary changed');
const mail=baseline.slice(start,end)+`alter table public.natori_order_mail_logs enable row level security;
revoke all on public.natori_order_mail_logs from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_order_mail_logs to service_role;
grant usage,select on sequence public.natori_order_mail_logs_id_seq to service_role;
`;
writeFileSync(process.argv[2],`alter table public.natori_projects add column if not exists payment_link_id text, add column if not exists payment_link_url text;
`+mail+readFileSync('supabase/migrations/20261001161401_natori_payment_link_generations.sql','utf8')+`
-- Fixture-only deterministic wait control, never part of the product migration.
create function public.phase2c_hold_project_v1(p_project uuid,p_seconds double precision) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_seconds<0.1 or p_seconds>3 then raise exception 'fixture_hold_invalid'; end if;
 perform id from public.natori_projects where id=p_project and client_email='client@phase2c.invalid' and title='Payment fixture' for update;
 if not found then raise exception 'synthetic_fixture_required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600042));
 perform pg_catalog.pg_sleep(p_seconds);
 return true;
end; $$;
create function public.phase2c_project_is_held_v1(p_project uuid) returns boolean
language sql security invoker set search_path='' as $$
 select not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600042))
$$;
revoke all on function public.phase2c_hold_project_v1(uuid,double precision),public.phase2c_project_is_held_v1(uuid) from public,anon,authenticated;
grant execute on function public.phase2c_hold_project_v1(uuid,double precision),public.phase2c_project_is_held_v1(uuid) to service_role;
`+"\nNOTIFY pgrst, 'reload schema';\n");
