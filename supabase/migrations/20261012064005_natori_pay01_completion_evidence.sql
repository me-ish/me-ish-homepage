-- PAY-01: publication and first completion require persisted dedicated-RPC evidence.
-- No historical row, accepted timestamp, manual completion or payment is rewritten.
begin;

-- Fail closed if the reviewed delivery integrity prerequisite is absent/disabled.
do $$ begin
  if to_regprocedure('public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamp with time zone,text,timestamp with time zone,jsonb)') is null
    or to_regprocedure('public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamp with time zone)') is null
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.natori_projects'::regclass
      and tgname='natori_delivery_project_guard' and tgenabled='O' and not tgisinternal
      and tgfoid='public.natori_delivery_project_guard_v1()'::regprocedure)
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.natori_delivery_releases'::regclass
      and tgname='natori_delivery_release_guard' and tgenabled='O' and not tgisinternal
      and tgfoid='public.natori_delivery_release_guard_v1()'::regprocedure)
    or not exists (select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles o on o.oid=f.proowner
      where f.oid='public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)'::regprocedure
      and md5(f.prosrc)='961f11c3c1b6d06ff8a6a797ca72f5a9' and f.prolang=(select oid from pg_catalog.pg_language where lanname='plpgsql')
      and not f.prosecdef and f.prokind='f' and o.rolname='postgres'
      and f.proconfig=array['search_path=""']::text[])
    or not exists (select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles o on o.oid=f.proowner
      where f.oid='public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz)'::regprocedure
      and md5(f.prosrc)='e9ae3bbe50e0772c7c07355f234b053c' and f.prolang=(select oid from pg_catalog.pg_language where lanname='plpgsql')
      and not f.prosecdef and f.prokind='f' and o.rolname='postgres'
      and f.proconfig=array['search_path=""']::text[]) then
    raise exception 'PAY01_DELIVERY_INTEGRITY_PREREQUISITE_REQUIRED';
  end if;
end $$;

-- A writable evidence row would let a generic service UPDATE manufacture acceptance.
-- Keep the existing validated RPC bodies and project -> release lock ordering. Only
-- these two narrow server RPCs can create/accept releases; browser EXECUTE stays closed.
revoke all on public.natori_delivery_releases from public,anon,authenticated,service_role;
grant select on public.natori_delivery_releases to service_role;
alter function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) security definer;
alter function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) set search_path='';
alter function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) owner to postgres;
alter function public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz) security definer;
alter function public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz) set search_path='';
alter function public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz) owner to postgres;
revoke all on function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb),
  public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb),
  public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz) to service_role;

create or replace function public.natori_delivery_project_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r public.natori_delivery_releases%rowtype; first_acceptance boolean;
begin
  if tg_op='INSERT' then
    -- The manual historical completed-registration RPC inserts only paid/completed
    -- facts. A new project cannot invent formal mail/token/customer-acceptance facts
    -- and later have issue_v1 adopt them as pre-existing legacy evidence.
    if new.delivery_token_hash is not null or new.delivery_token_expires_at is not null
      or new.delivered_mail_at is not null or new.delivery_accepted_at is not null
      or new.status='delivered' then
      raise exception 'Formal delivery evidence requires dedicated RPC' using errcode='23514';
    end if;
    return new;
  end if;

  -- Metadata, payment/refund projections, task and archive writers do not need a
  -- release-table read when they preserve these facts (including historical dates).
  if (new.status,new.completed_at,new.delivery_accepted_at,new.delivery_token_hash,new.delivery_token_expires_at)
    is not distinct from (old.status,old.completed_at,old.delivery_accepted_at,old.delivery_token_hash,old.delivery_token_expires_at) then
    return new;
  end if;

  if (old.completed_at is not null and new.completed_at is distinct from old.completed_at)
    or (old.delivery_accepted_at is not null and new.delivery_accepted_at is distinct from old.delivery_accepted_at) then
    raise exception 'Immutable issued delivery evidence' using errcode='23514';
  end if;
  select * into r from public.natori_delivery_releases where project_id=old.id;
  if r.id is not null and (new.delivery_token_hash,new.delivery_token_expires_at)
    is distinct from (old.delivery_token_hash,old.delivery_token_expires_at) then
    raise exception 'Immutable issued delivery evidence' using errcode='23514';
  end if;

  first_acceptance:=old.delivery_accepted_at is null and new.delivery_accepted_at is not null;
  if first_acceptance and (r.id is null or r.accepted_at is null
    or new.delivery_accepted_at is distinct from r.accepted_at
    or new.completed_at is distinct from r.accepted_at
    or old.status<>'delivered' or new.status<>'completed'
    or new.payment_confirmed_at is null or new.deleted_at is not null) then
    raise exception 'Customer acceptance requires dedicated RPC evidence' using errcode='23514';
  end if;
  if old.completed_at is null and new.completed_at is not null and not first_acceptance then
    raise exception 'First completion requires customer acceptance' using errcode='23514';
  end if;

  if new.status is distinct from old.status
    and (old.status in ('delivered','completed') or new.status in ('delivered','completed')) then
    if old.status='delivery_prep' and new.status='delivered' and r.id is not null
      and r.accepted_at is null and new.delivery_accepted_at is null and new.completed_at is null
      and new.payment_confirmed_at is not null and new.deleted_at is null then
      return new;
    end if;
    if old.status='delivered' and new.status='completed' and first_acceptance then return new; end if;
    raise exception 'Delivery status requires dedicated RPC evidence' using errcode='23514';
  end if;
  -- Retain the existing terminal acceptance/status fence.
  if old.delivery_accepted_at is not null and new.status is distinct from old.status then
    raise exception 'Immutable issued delivery evidence' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger natori_delivery_project_guard on public.natori_projects;
create trigger natori_delivery_project_guard before insert or update on public.natori_projects
  for each row execute function public.natori_delivery_project_guard_v1();
revoke all on function public.natori_delivery_project_guard_v1() from public,anon,authenticated,service_role;

-- An unexpected inherited or column-level privilege must not silently weaken the
-- evidence boundary. Drift aborts the complete migration for separate review.
do $$ declare who text; begin
  foreach who in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(who,'public.natori_delivery_releases','INSERT,UPDATE,DELETE')
      or has_any_column_privilege(who,'public.natori_delivery_releases','INSERT,UPDATE')
      or (who<>'service_role' and (
        has_function_privilege(who,'public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)','EXECUTE')
        or has_function_privilege(who,'public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz)','EXECUTE'))) then
      raise exception 'PAY01_DELIVERY_AUTHORITY_ACL_DRIFT';
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
