-- Disposable fixtures only. Must follow guarded Phase T/0B/N/2A/2B/2C/2D setup.
do $$ begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
 if to_regclass('public.natori_intake_operations') is not null then raise exception 'Nonempty intake target'; end if;
end $$;
alter table public.natori_projects add column if not exists quote_accept_token_hash text,
 add column if not exists quote_token_expires_at timestamptz,add column if not exists payment_link_url text,
 add column if not exists payment_link_sent_at timestamptz,add column if not exists payment_link_expires_at timestamptz,
 add column if not exists stripe_payment_link_id text,add column if not exists stripe_payment_session_id text;
create table if not exists public.natori_portfolio_content(id text primary key,content jsonb not null,updated_at timestamptz default now());
alter table public.natori_portfolio_content enable row level security;
revoke all on public.natori_portfolio_content from public,anon,authenticated;
grant select,insert,update on public.natori_portfolio_content to service_role;
insert into storage.buckets(id,name,public) values('natori-inquiry-refs','natori-inquiry-refs',false) on conflict(id) do nothing;
-- Test-only lock probes make lease expiry regressions deterministic without production helper functions.
create function public.phase3a_hold_v1(p_owner uuid,p_operation uuid,p_content boolean,p_seconds integer) returns void
language plpgsql security definer set search_path='' as $$ begin
 if p_seconds not between 1 and 3 then raise exception 'Fixture duration'; end if;
 perform pg_advisory_xact_lock(hashtextextended('phase3a-probe/'||p_operation::text,0));
 if p_content is null then perform 1 from public.natori_intake_operations where owner_id=p_owner and operation_id=p_operation for update;
 elsif p_content then perform 1 from public.natori_portfolio_content where id='main' for update;
 else perform pg_advisory_xact_lock(hashtextextended(p_owner::text||'/intake/'||p_operation::text,0)); end if;
 perform pg_sleep(p_seconds);
end $$;
create function public.phase3a_is_held_v1(p_operation uuid) returns boolean
language plpgsql security definer set search_path='' as $$ declare got boolean; begin
 got:=pg_try_advisory_xact_lock(hashtextextended('phase3a-probe/'||p_operation::text,0));return not got;
end $$;
revoke all on function public.phase3a_hold_v1(uuid,uuid,boolean,integer),public.phase3a_is_held_v1(uuid) from public,anon,authenticated;
grant execute on function public.phase3a_hold_v1(uuid,uuid,boolean,integer),public.phase3a_is_held_v1(uuid) to service_role;

-- Test-only late waits occur after the production admission/operation fences.
-- Return only booleans; never expose SQL activity, owner IDs or request payloads.
create function public.phase3a_hold_late_v1(p_owner uuid,p_operation uuid,p_stage text,p_seconds integer) returns void
language plpgsql security definer set search_path='' as $$ begin
 if p_seconds not between 1 and 5 then raise exception 'Fixture duration'; end if;
 case p_stage
  when 'owner_fk' then perform 1 from auth.users where id=p_owner for update;
  when 'project_relation' then lock table public.natori_projects in share mode;
  when 'notification_relation' then lock table public.natori_notification_jobs in share mode;
  when 'completion_update' then perform pg_advisory_xact_lock(hashtextextended('phase3a-completion/'||p_operation::text,0));
  else raise exception 'Fixture stage';
 end case;
 -- Mark readiness only after the real lock has been acquired.
 perform pg_advisory_xact_lock(hashtextextended('phase3a-probe/'||p_operation::text,0));
 perform pg_sleep(p_seconds);
end $$;
create function public.phase3a_finish_is_waiting_v1(p_operation uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare lock_key bigint:=hashtextextended('phase3a-probe/'||p_operation::text,0);
begin
 return exists(
  select 1 from pg_catalog.pg_stat_activity a
  where a.pid<>pg_backend_pid() and a.wait_event_type='Lock'
   and a.query like '%natori_intake_finish_v1%'
   and pg_catalog.pg_blocking_pids(a.pid) && array(
    select l.pid from pg_catalog.pg_locks l where l.locktype='advisory' and l.granted
     and l.classid::bigint=((lock_key>>32)&4294967295::bigint)
     and l.objid::bigint=(lock_key&4294967295::bigint) and l.objsubid=1));
end $$;
create function public.phase3a_completion_wait_v1() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('phase3a-completion/'||new.operation_id::text,0));
 return new;
end $$;
create function public.phase3a_install_completion_wait_v1() returns void
language plpgsql security definer set search_path='' as $$ begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
 create trigger phase3a_completion_wait after update on public.natori_intake_operations
  for each row when (new.status='completed') execute function public.phase3a_completion_wait_v1();
end $$;
revoke all on function public.phase3a_hold_late_v1(uuid,uuid,text,integer),public.phase3a_finish_is_waiting_v1(uuid),
 public.phase3a_completion_wait_v1(),public.phase3a_install_completion_wait_v1() from public,anon,authenticated;
grant execute on function public.phase3a_hold_late_v1(uuid,uuid,text,integer),public.phase3a_finish_is_waiting_v1(uuid) to service_role;
