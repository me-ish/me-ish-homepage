import {readFileSync,writeFileSync} from 'node:fs';
import {buildReaderFixture} from '../natori-wf01/build-reader-fixture.mjs';
// Current reader schema installs once before earlier browser cases. Keep all Phase3B fault cases.
writeFileSync(process.argv[2],buildReaderFixture('late-phase3b').sql+`
grant update on public.natori_consultation_access to service_role;
-- Disposable-only wait control: prove access/claim expiry during a held project lock.
create function public.phase3b_hold_project_v1(p_project uuid) returns boolean language plpgsql security invoker set search_path='' as $$begin
 perform id from public.natori_projects where id=p_project and client_email='client@phase3b.invalid' and title='Consultation fixture' for update;
 if not found then raise exception 'synthetic_fixture_required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600043));perform pg_catalog.pg_sleep(2);return true;
end$$;
create function public.phase3b_project_is_held_v1(p_project uuid) returns boolean language sql security invoker set search_path='' as $$select not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600043))$$;
revoke all on function public.phase3b_hold_project_v1(uuid),public.phase3b_project_is_held_v1(uuid) from public,anon,authenticated;
grant execute on function public.phase3b_hold_project_v1(uuid),public.phase3b_project_is_held_v1(uuid) to service_role;
-- Disposable-only final business-update wait. No production trigger is added.
create function public.phase3b_wait_final_message_update_v1() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.notification_id is not null and old.notification_id is null and exists(select 1 from public.natori_projects where id=new.project_id and client_email='client@phase3b.invalid' and title='Consultation fixture' and note='phase3b-final-update-wait') then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.project_id::text,600044));
  perform pg_catalog.pg_sleep(2);
 end if;return new;
end$$;
create trigger phase3b_wait_final_message_update after update of notification_id on public.natori_consultation_messages for each row execute function public.phase3b_wait_final_message_update_v1();
create function public.phase3b_final_update_is_waiting_v1(p_project uuid) returns boolean language sql security invoker set search_path='' as $$select not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_project::text,600044))$$;
revoke all on function public.phase3b_final_update_is_waiting_v1(uuid) from public,anon,authenticated;
grant execute on function public.phase3b_final_update_is_waiting_v1(uuid) to service_role;

${readFileSync('scripts/natori-phase-3b/notice-concurrency-fixture.sql','utf8')}
NOTIFY pgrst,'reload schema';
`);
