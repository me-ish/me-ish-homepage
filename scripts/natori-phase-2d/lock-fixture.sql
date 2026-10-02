-- Installed only by the sealed ephemeral fixture builder, never by a product migration.
do $$ begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then
  raise exception 'Sandbox required';
 end if;
end $$;

create function public.phase2d_hold_then_complete_v1(
 p_owner uuid,p_project uuid,p_event text,p_token uuid,p_generation integer,p_seconds double precision,p_legacy boolean)
returns table(result text,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
begin
 if p_seconds<0.1 or p_seconds>5 or p_legacy is null then raise exception 'fixture_hold_invalid'; end if;
 if not exists(select 1 from public.natori_projects where id=p_project and user_id=p_owner
   and client_email='client@phase2d.invalid' and title='Refund fixture')
   or not exists(select 1 from public.natori_stripe_event_inbox where account_scope='platform' and livemode=false
     and event_id=p_event and owner_id=p_owner and project_id=p_project
     and event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')) then
  raise exception 'synthetic_fixture_required';
 end if;
 -- Mirror the current v2 order; legacy intentionally takes only the project lock.
 if not p_legacy then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('natori-financial/v2/platform/false',0));
 end if;
 perform id from public.natori_projects where id=p_project and user_id=p_owner for update;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600043));
 perform pg_catalog.pg_sleep(p_seconds);
 if p_legacy then
  return query select * from public.natori_stripe_event_complete_v1(p_owner,'platform',false,p_event,p_token,p_generation);
 else
  return query select * from public.natori_stripe_event_complete_v2(p_owner,'platform',false,p_event,p_token,p_generation);
 end if;
end;
$$;

create function public.phase2d_project_is_held_v1(p_project uuid) returns boolean
language sql security invoker set search_path='' as $$
 select not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600043));
$$;

create function public.phase2d_financial_activity_v1(p_waiting boolean) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from pg_catalog.pg_locks l
   where l.locktype='advisory' and l.objsubid=1 and l.granted=(not p_waiting)
     and l.database=(select oid from pg_catalog.pg_database where datname=pg_catalog.current_database())
     and l.classid::bigint=((pg_catalog.hashtextextended('natori-financial/v2/platform/false',0)>>32)&4294967295)
     and l.objid::bigint=(pg_catalog.hashtextextended('natori-financial/v2/platform/false',0)&4294967295));
$$;

create function public.phase2d_payment_is_available_v1(p_owner uuid,p_project uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.natori_projects where id=p_project and user_id=p_owner
   and client_email='client@phase2d.invalid' and title='Refund fixture') then
  raise exception 'synthetic_fixture_required';
 end if;
 perform t.id from public.natori_payment_transactions t where t.project_id=p_project and t.status='received'
   order by t.id for update nowait;
 return true;
exception when lock_not_available then return false;
end;
$$;

revoke all on function public.phase2d_hold_then_complete_v1(uuid,uuid,text,uuid,integer,double precision,boolean),
 public.phase2d_project_is_held_v1(uuid),public.phase2d_financial_activity_v1(boolean),
 public.phase2d_payment_is_available_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.phase2d_hold_then_complete_v1(uuid,uuid,text,uuid,integer,double precision,boolean),
 public.phase2d_project_is_held_v1(uuid),public.phase2d_financial_activity_v1(boolean),
 public.phase2d_payment_is_available_v1(uuid,uuid) to service_role;
