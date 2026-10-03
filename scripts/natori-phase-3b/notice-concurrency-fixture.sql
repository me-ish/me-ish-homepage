-- Disposable-only concurrency control. This file is appended by build-fixture;
-- it is not a production migration and never enables a notification dispatcher.
do $$begin if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required';end if;end$$;

create function public.phase3b_hold_message_then_queue_v1(p_project uuid,p_message uuid,p_notice uuid,p_owner uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.natori_notification_jobs%rowtype; queued uuid; deadline timestamptz; observed boolean:=false; marker bigint;
begin
 perform m.id from public.natori_consultation_messages m join public.natori_projects p on p.id=m.project_id
  where m.id=p_message and m.project_id=p_project and m.notification_id=p_notice and m.sender='staff'
   and p.user_id=p_owner and p.client_email='client@phase3b.invalid' and p.title='Consultation fixture' for update of m;
 if not found then raise exception 'synthetic_fixture_required';end if;
 select * into strict prior from public.natori_notification_jobs where id=p_notice and project_id=p_project and status='failed' and attempt_no=1 and purpose='consultation_client';
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600045));
 marker:=pg_catalog.hashtextextended(p_project::text,600046);deadline:=pg_catalog.clock_timestamp()+interval '4 seconds';
 loop
  -- The exact callback owns this project-specific marker and is demonstrably
  -- blocked by our message lock. We do not depend on a timing-only sleep.
  select exists(select 1 from pg_catalog.pg_locks l where l.locktype='advisory' and l.granted
    and l.classid=((marker>>32)&4294967295)::oid and l.objid=(marker&4294967295)::oid and l.objsubid=1
    and pg_catalog.pg_backend_pid()=any(pg_catalog.pg_blocking_pids(l.pid))) into observed;
  exit when observed;
  if pg_catalog.clock_timestamp()>=deadline then raise exception 'older_callback_wait_not_observed';end if;
  perform pg_catalog.pg_sleep(0.01);
 end loop;
 -- Controlled fixture copy of the frozen retry INSERT: locking the older job
 -- here would deadlock with its callback. The real owner retry RPC is tested
 -- separately in the same case; the identity/receipt/count assertions are shared.
 insert into public.natori_notification_jobs(notification_key,attempt_no,project_id,quote_id,purpose,snapshot,payload)
 values(prior.notification_key,prior.attempt_no+1,prior.project_id,prior.quote_id,prior.purpose,prior.snapshot,prior.payload) returning id into queued;
 return pg_catalog.jsonb_build_object('queuedId',queued,'blocked',observed);
end$$;

create function public.phase3b_message_is_held_v1(p_project uuid) returns boolean language sql security invoker set search_path='' as $$
 select not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600045))
$$;

create function public.phase3b_late_notice_callback_v1(p_project uuid,p_message uuid,p_notice uuid,p_owner uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.natori_projects p join public.natori_consultation_messages m on m.project_id=p.id
   where p.id=p_project and p.user_id=p_owner and p.client_email='client@phase3b.invalid' and p.title='Consultation fixture'
    and m.id=p_message and m.notification_id=p_notice and m.sender='staff') then raise exception 'synthetic_fixture_required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600046));
 update public.natori_notification_jobs set status='sent',provider_id='phase3b-synthetic-race',sent_at=pg_catalog.clock_timestamp()
  where id=p_notice and project_id=p_project and status='failed' and attempt_no=1 and purpose='consultation_client';
 if not found then raise exception 'synthetic_old_notice_required';end if;
 return true;
end$$;

revoke all on function public.phase3b_hold_message_then_queue_v1(uuid,uuid,uuid,uuid),public.phase3b_message_is_held_v1(uuid),public.phase3b_late_notice_callback_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.phase3b_hold_message_then_queue_v1(uuid,uuid,uuid,uuid),public.phase3b_message_is_held_v1(uuid),public.phase3b_late_notice_callback_v1(uuid,uuid,uuid,uuid) to service_role;
