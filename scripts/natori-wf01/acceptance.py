#!/usr/bin/env python3
"""Real SQL, competing transactions, isolated roles; artifacts contain no row data."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = 'supabase/migrations/20261012085748_natori_rough_ok_followup.sql'
SOURCES = [
    'supabase/migrations/20260723111730_etorie_baseline.sql',
    'supabase/migrations/20260723111741_baseline_security_hardening.sql',
    'supabase/migrations/20260729115313_etorie_phase1_expand.sql',
    'supabase/migrations/20260806120330_natori_accept_delivery_rpc.sql',
    'supabase/migrations/20260927073530_natori_acceptance_notifications.sql',
    'supabase/migrations/20260930101753_natori_delivery_integrity.sql',
    'supabase/migrations/20260923033156_natori_consultation_messages.sql',
    'supabase/migrations/20260923033205_natori_consultation_files.sql',
    'supabase/migrations/20260923033212_natori_consultation_link_renewal.sql',
    'supabase/migrations/20260927102757_natori_consultation_overview.sql',
    'supabase/migrations/20261001225106_natori_consultation_operations.sql',
    'supabase/migrations/20261011140000_natori_talk_roughs.sql',
]
OWNER = '00000000-0000-4000-8000-000000000001'
OTHER = '00000000-0000-4000-8000-000000000002'
CHECKS = []
ENV = {k: v for k, v in os.environ.items() if k in ('PATH', 'LANG', 'LD_LIBRARY_PATH')}
ENV.update({'PGPASSFILE': '/dev/null', 'PGSERVICEFILE': '/dev/null'})


def lit(value):
    return 'null' if value is None else "'" + str(value).replace("'", "''") + "'"


def uid(label):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'natori-wf01/' + label))


def sql(statement, role='service_role', expected=None):
    result = subprocess.run(COMMAND, input=(f'SET ROLE {role};\n' if role else '') + statement,
                            capture_output=True, text=True, env=ENV, timeout=25)
    if expected=='40P01_or_success':
        if result.returncode==0:return result.stdout.strip()
        assert '40P01' in result.stderr, 'unexpected mixed-path rejection'
        return '{"result":"retryable_deadlock"}'
    if expected:
        assert result.returncode != 0 and expected in result.stderr, 'unexpected native SQL rejection'
        return None
    assert result.returncode == 0, result.stderr[:400]
    return result.stdout.strip()


def value(statement, role='service_role'):
    return sql(statement, role).splitlines()[-1]


def row(statement):
    return json.loads(value(statement))


def check(name, condition=True):
    assert condition, name
    assert name not in CHECKS, 'duplicate native evidence ID'
    CHECKS.append(name)
    print('PASS ' + name, flush=True)


def project(label):
    pid = uid(label)
    sql(f"insert into public.natori_projects(id,user_id,title,client_name,client_email,type,status,due_date) values({lit(pid)},{lit(OWNER)},'WF01 synthetic','Synthetic client','client@wf01.invalid','illustration','rough','2027-01-01')")
    token = hashlib.sha256(('capability/' + label).encode()).hexdigest()
    sql(f"insert into public.natori_consultation_access(project_id,token_hash,expires_at) values({lit(pid)},{lit(token)},clock_timestamp()+interval '1 day')")
    return pid, token


def rough(pid, label, sender='staff', message_pid=None):
    mid, rid = uid(label + '/message'), uid(label + '/rough')
    sql(f"insert into public.natori_consultation_messages(id,project_id,sender,body,notification_status) values({lit(mid)},{lit(message_pid or pid)},{lit(sender)},'Synthetic rough','sent')")
    sql(f"insert into public.natori_talk_roughs(id,project_id,message_id,before_quote) values({lit(rid)},{lit(pid)},{lit(mid)},true)")
    return rid, mid


def ok_sql(pid, rid, token):
    return f"select row_to_json(r)::text from public.natori_record_rough_ok_v1({lit(pid)},{lit(rid)},{lit(token)}) r"


def ok(pid, rid, token):
    return row(ok_sql(pid, rid, token))


def ack_sql(pid, rid, owner=OWNER):
    return f"select row_to_json(r)::text from public.natori_acknowledge_rough_ok_v1({lit(owner)},{lit(pid)},{lit(rid)}) r"


def ack(pid, rid, owner=OWNER):
    return row(ack_sql(pid, rid, owner))


def retry(pid, rid, owner=OWNER):
    return value(f"select coalesce(public.natori_retry_rough_ok_notification_v1({lit(owner)},{lit(pid)},{lit(rid)})::text,'none')")


def overview(pid, owner=OWNER):
    return row(f"select coalesce(jsonb_agg(to_jsonb(v)),'[]')::text from public.natori_consultation_overview_v2({lit(owner)},array[{lit(pid)}]::uuid[]) v")


def listed(pid, owner=OWNER):
    return row(f"select coalesce(jsonb_agg(to_jsonb(v)),'[]')::text from public.natori_rough_ok_list_v1({lit(owner)},{lit(pid)}) v")


def facts(pid):
    return row(f"select to_jsonb(p)::text from public.natori_projects p where id={lit(pid)}")


def counts(rid):
    return row(f"select jsonb_build_array((select count(*) from public.natori_rough_ok_events where rough_id={lit(rid)}),(select count(*) from public.natori_notification_jobs where notification_key='rough-ok/'||{lit(rid)}))::text")


def stored_ok(rid):
    return value(f"select coalesce(client_ok_at::text,'none') from public.natori_talk_roughs where id={lit(rid)}")


def apply_new(expected=None):
    return sql((ROOT / MIGRATION).read_text(), None, expected)


def waiter_count(marker):
    return int(value(f"select count(*) from pg_stat_activity where application_name like {lit(marker+'%')} and wait_event_type='Lock'", None))


def held_work(lock_sql, statements, name, while_held=None):
    """Waiters are observed in pg_stat_activity before releasing a real lock."""
    marker = 'WF01_' + name
    holder = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, env=ENV)
    holder.stdin.write('begin;\n' + lock_sql + ';\nselect pg_advisory_xact_lock(12085748,1);\n')
    holder.stdin.flush()
    def participant(item, index):
        statement, expected = item if isinstance(item, tuple) else (item, None)
        output = sql(f'set application_name={lit(marker+str(index))};\n' + statement, expected=expected)
        return {'rejected': expected} if expected and expected!='40P01_or_success' else json.loads(output.splitlines()[-1])
    try:
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            if value('select pg_try_advisory_xact_lock(12085748,1)', None) == 'f':
                break
            assert holder.poll() is None, 'fixture lock holder exited'
            time.sleep(.02)
        else:
            raise AssertionError('fixture lock rendezvous timeout')
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(statements)) as pool:
            pending = []
            try:
                for index, statement in enumerate(statements):
                    pending.append(pool.submit(participant, statement, index))
                    deadline = time.monotonic() + 8
                    while time.monotonic() < deadline:
                        if waiter_count(marker) == index + 1:
                            break
                        if pending[-1].done():
                            pending[-1].result()
                            raise AssertionError('participant did not contend on actual SQL lock')
                        time.sleep(.02)
                    else:
                        raise AssertionError('native lock waiter timeout')
                if while_held:
                    while_held()
            finally:
                holder.stdin.write('commit;\n')
                holder.stdin.flush()
                holder.stdin.close()
            result = [f.result() for f in pending]
    finally:
        if not holder.stdin.closed:
            holder.stdin.write('rollback;\n')
            holder.stdin.flush()
            holder.stdin.close()
        assert holder.wait(timeout=8) == 0, 'fixture lock holder failed'
    check(name + '_observed_native_lock_waiters')
    return result


def expire(token, delay=0):
    sql(f"update public.natori_consultation_access set expires_at=clock_timestamp()+interval '{delay} seconds' where token_hash={lit(token)}")


def wait_expired(token):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if value(f"select expires_at<=clock_timestamp() from public.natori_consultation_access where token_hash={lit(token)}") == 't':
            return
        time.sleep(.02)
    raise AssertionError('synthetic capability expiry timeout')


def finish_notice(nid, status, scenario):
    claim = uid(nid + '/' + status)
    check(scenario+'_claim_' + status, value(f"select count(*) from public.natori_notification_claim_v1({lit(nid)},{lit(claim)},true)") == '1')
    payload = '{"from":"staff@wf01.invalid","to":["owner@wf01.invalid"],"subject":"Synthetic","html":"Synthetic"}'
    check(scenario+'_freeze_payload_' + status, value(f"select count(*) from public.natori_notification_start_v1({lit(nid)},{lit(claim)},{lit(payload)}::jsonb)") == '1')
    check(scenario+'_finish_' + status, value(f"select public.natori_notification_finish_v1({lit(nid)},{lit(claim)},{lit(status)},{lit('synthetic-provider' if status=='sent' else None)},null)") == 't')


def main():
    check('dedicated_socket_only_native_17_11', value("select current_database()='natori_wf01' and current_setting('listen_addresses')='' and current_setting('server_version_num')='170011'", None) == 't')
    sql((ROOT / 'scripts/natori-wf01/bootstrap.sql').read_text(), None)
    for source in SOURCES:
        sql((ROOT / source).read_text(), None)
    historical_pid, historical_token = project('historical')
    historical_rid, _ = rough(historical_pid, 'historical')
    sql(f"update public.natori_talk_roughs set client_ok_at='2024-01-03T09:00:00Z' where id={lit(historical_rid)}")
    historical_fact = stored_ok(historical_rid)
    # Native-only purpose fixture models all latest Phase3B predicates plus an
    # independent purpose, proving the extension preserves installed choices.
    purposes = ['quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client',
                'quote_issue_client','payment_received_artist','payment_received_client','payment_review_artist',
                'payment_link_client','refund_confirmed_artist','refund_review_artist','intake_artist','intake_client',
                'consultation_staff','consultation_client','synthetic_other_purpose']
    definition = 'CHECK (purpose IN (' + ','.join(lit(v) for v in purposes) + '))'
    sql('alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check; alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check ' + definition, None)
    for drift in ['CHECK (purpose IS NOT NULL)', 'CHECK (length(purpose)>0)']:
        sql('alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check; alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check '+drift,None)
        apply_new('23514')
        check('migration_rejects_'+('permissive_purpose_predicate' if 'IS NOT NULL' in drift else 'unrecognized_purpose_predicate'))
        sql('alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check; alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check '+definition,None)
    original = sql("select pg_get_functiondef('public.natori_talk_roughs_guard()'::regprocedure)", None)
    sql(original.replace('begin', '-- native body drift\nbegin', 1), None)
    apply_new('23514')
    sql(original, None)
    check('migration_rejects_predecessor_body_drift')
    sql('alter table public.natori_talk_roughs disable trigger natori_talk_roughs_guard', None)
    apply_new('23514')
    sql('alter table public.natori_talk_roughs enable trigger natori_talk_roughs_guard', None)
    check('migration_rejects_disabled_guard')
    sql('grant select(client_ok_at) on public.natori_talk_roughs to authenticated', None)
    apply_new('23514')
    sql('revoke select(client_ok_at) on public.natori_talk_roughs from authenticated', None)
    check('migration_rejects_browser_column_acl_drift')
    sql('alter table public.natori_consultation_access disable row level security', None)
    apply_new('23514')
    sql('alter table public.natori_consultation_access enable row level security', None)
    check('migration_rejects_rls_drift')
    sql('revoke update on public.natori_consultation_access from service_role', None)
    apply_new('23514')
    sql('grant update on public.natori_consultation_access to service_role', None)
    check('migration_requires_capability_row_lock_privilege')
    # Apply the exact forward body, interrupt inside its transaction, inspect rollback.
    interrupted = (ROOT / MIGRATION).read_text().replace("notify pgrst,'reload schema';", "do $$begin raise exception 'synthetic_migration_interrupt' using errcode='P0001';end$$;")
    sql(interrupted, None, 'P0001')
    check('migration_interruption_rolls_back_schema_and_purpose', value("select to_regclass('public.natori_rough_ok_events') is null and to_regprocedure('public.natori_consultation_overview_v2(uuid,uuid[])') is null", None) == 't' and 'rough_ok_artist' not in value("select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.natori_notification_jobs'::regclass and conname='natori_notification_jobs_purpose_check'", None))
    apply_new()
    check('latest_main_lifecycle_bodies_preserved',value("select md5(prosrc) from pg_proc where oid='public.natori_notification_immutable_v1()'::regprocedure",None)=='a83c1b07e264cf2f1d05cd75dbd85bf9' and value("select md5(prosrc) from pg_proc where oid='public.natori_notification_finish_v1(uuid,uuid,text,text,text)'::regprocedure",None)=='09e6228c0424e9f5a06a22376eba1d6d')
    check('historical_ok_not_repaired_or_enqueued', stored_ok(historical_rid) == historical_fact and counts(historical_rid) == [0,0])
    check('historical_ok_visible_pending_without_mail_success', overview(historical_pid)[0]['rough_ok_pending'] == 1 and listed(historical_pid)[0]['notification_status'] is None)
    check('historical_ok_replay_does_not_enqueue', ok(historical_pid,historical_rid,historical_token)['result'] == 'already_ok' and counts(historical_rid) == [0,0])
    check('historical_ok_retry_does_not_enqueue', retry(historical_pid,historical_rid) == 'none' and counts(historical_rid) == [0,0])
    for purpose in purposes:
        sql(f"insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot,payload) values({lit('purpose/'+purpose)},{lit(historical_pid)},{lit(purpose)},'{{}}','{{\"format\":\"natori-delivery-aes256gcm-v1\",\"ciphertext\":\"synthetic\",\"expiresAt\":\"2027-01-01T00:00:00Z\"}}')")
    check('every_latest_phase3b_and_unknown_installed_purpose_retained')

    pid, token = project('normal')
    rid, mid = rough(pid, 'normal')
    before = facts(pid)
    results = held_work(f'select id from public.natori_projects where id={lit(pid)} for update', [ok_sql(pid,rid,token),ok_sql(pid,rid,token)], 'ok_ok')
    check('competing_ok_once_and_replay_same_fact', sorted(r['result'] for r in results) == ['already_ok','ok'] and results[0]['client_ok_at'] == results[1]['client_ok_at'] and results[0]['notification_ids'] == results[1]['notification_ids'] and counts(rid) == [1,1])
    check('ok_does_not_change_project_status_payment_or_acceptance', facts(pid) == before)
    mixed_pid,mixed_token=project('mixed-direct-rpc')
    mixed_rid,_=rough(mixed_pid,'mixed-direct-rpc')
    direct=f"with changed as (update public.natori_talk_roughs set client_ok_at=clock_timestamp() where id={lit(mixed_rid)} returning id) select jsonb_build_object('result','direct')::text from changed"
    mixed=held_work(f'select id from public.natori_projects where id={lit(mixed_pid)} for update',[(direct,'40P01_or_success'),(ok_sql(mixed_pid,mixed_rid,mixed_token),'40P01_or_success')],'mixed_direct_rpc')
    check('mixed_direct_service_and_rpc_preserve_once_only_with_retryable_deadlock',counts(mixed_rid)==[1,1] and ok(mixed_pid,mixed_rid,mixed_token)['result']=='already_ok' and any(r['result']!='retryable_deadlock' for r in mixed))

    check('pending_business_followup_and_current_job_independent', overview(pid)[0]['rough_ok_pending'] == 1 and listed(pid)[0]['notification_status'] == 'pending')
    nid = results[0]['notification_ids'][0]
    sql(f"insert into public.natori_consultation_messages(project_id,sender,body,notification_status) values({lit(pid)},'staff','Ordinary reply','sent')")
    sql(f"update public.natori_projects set status='lineart' where id={lit(pid)}")
    check('ordinary_reply_and_project_status_do_not_acknowledge', overview(pid)[0]['rough_ok_pending'] == 1)
    finish_notice(nid,'sent','normal')
    check('provider_success_does_not_acknowledge_followup', overview(pid)[0]['rough_ok_pending'] == 1 and listed(pid)[0]['notification_status'] == 'sent')
    check('sent_notification_cannot_retry', retry(pid,rid) == 'none')
    rid2, _ = rough(pid, 'second')
    race = held_work(f'select id from public.natori_projects where id={lit(pid)} for update', [ack_sql(pid,rid),ok_sql(pid,rid2,token)], 'ack_new_ok')
    check('specific_ack_preserves_new_rough_pending', {r['result'] for r in race} == {'acknowledged','ok'} and overview(pid)[0]['rough_ok_pending'] == 1 and overview(pid)[0]['latest_rough_ok_id'] == rid2)
    original_ack = ack(pid,rid)
    check('ack_idempotent_immutable_fact', original_ack['result'] == 'already_acknowledged' and original_ack['acknowledged_at'] == ack(pid,rid)['acknowledged_at'])
    ack_pid,ack_token=project('competing-ack')
    ack_rid,_=rough(ack_pid,'competing-ack')
    ok(ack_pid,ack_rid,ack_token)
    acks=held_work(f'select id from public.natori_projects where id={lit(ack_pid)} for update',[ack_sql(ack_pid,ack_rid),ack_sql(ack_pid,ack_rid)],'ack_ack')
    check('competing_ack_once_and_same_immutable_time',sorted(r['result'] for r in acks)==['acknowledged','already_acknowledged'] and acks[0]['acknowledged_at']==acks[1]['acknowledged_at'] and overview(ack_pid)[0]['rough_ok_pending']==0)

    check('wrong_owner_list_overview_ack_retry_denied', listed(pid,OTHER) == [] and overview(pid,OTHER) == [] and ack(pid,rid2,OTHER)['result'] == 'not_found' and retry(pid,rid2,OTHER) == 'none')
    foreign_pid, foreign_token = project('foreign')
    check('cross_project_rough_token_ack_retry_denied', ok(foreign_pid,rid2,foreign_token)['result'] == 'not_found' and ok(pid,rid2,foreign_token)['result'] == 'not_found' and ack(foreign_pid,rid2)['result'] == 'not_found' and retry(foreign_pid,rid2) == 'none')
    unok, _ = rough(pid,'unok')
    check('unanswered_rough_cannot_ack_or_retry', ack(pid,unok)['result'] == 'not_ok' and retry(pid,unok) == 'none')
    check('invalid_hash_and_absent_rough_denied', ok(pid,unok,'raw-token')['result'] == 'not_found' and ok(pid,uid('absent'),token)['result'] == 'not_found')
    move_pid,move_token=project('owner-recheck')
    move_rid,_=rough(move_pid,'owner-recheck')
    ok(move_pid,move_rid,move_token)
    moved=held_work(f'select id from public.natori_projects where id={lit(move_pid)} for update; update public.natori_projects set user_id={lit(OTHER)} where id={lit(move_pid)}',[ack_sql(move_pid,move_rid)],'owner_changed_while_waiting')[0]
    check('owner_binding_rechecked_after_lock_wait',moved['result']=='not_found' and listed(move_pid,OWNER)==[] and overview(move_pid,OTHER)[0]['rough_ok_pending']==1)

    sql(f"update public.natori_projects set status='closed' where id={lit(pid)}")
    closed_before = facts(pid)
    check('closing_project_preserves_pending_fact', overview(pid)[0]['rough_ok_pending'] == 1)
    check('closed_rejects_new_customer_ok', ok(pid,unok,token)['result'] == 'closed' and stored_ok(unok) == 'none')
    check('closed_owner_can_ack_without_reopen_or_status_change', ack(pid,rid2)['result'] == 'acknowledged' and overview(pid)[0]['rough_ok_pending'] == 0 and facts(pid) == closed_before)
    sql(f"update public.natori_projects set deleted_at=clock_timestamp() where id={lit(pid)}")
    check('deleted_denies_ok_owner_list_ack_and_retry', ok(pid,unok,token)['result'] == 'not_found' and listed(pid) == [] and ack(pid,rid)['result'] == 'not_found' and retry(pid,rid2) == 'none')
    check('deleted_does_not_delete_business_history', counts(rid) == [1,1] and stored_ok(rid) != 'none')

    # Queue insertion failure and service direct UPDATE cannot break transactionality.
    failpid, failtoken = project('queue-failure')
    failrid, _ = rough(failpid,'queue-failure')
    sql("create function public.wf01_queue_fault() returns trigger language plpgsql as $$begin if new.purpose='rough_ok_artist' then raise exception 'synthetic_queue_failure' using errcode='23514';end if;return new;end$$; create trigger wf01_queue_fault before insert on public.natori_notification_jobs for each row execute function public.wf01_queue_fault()",None)
    sql(ok_sql(failpid,failrid,failtoken),expected='23514')
    check('queue_failure_rolls_back_rpc_ok_event_and_job', stored_ok(failrid)=='none' and counts(failrid)==[0,0])
    sql(f"update public.natori_talk_roughs set client_ok_at=clock_timestamp() where id={lit(failrid)}",expected='23514')
    check('queue_failure_rolls_back_direct_service_ok', stored_ok(failrid)=='none' and counts(failrid)==[0,0])
    sql('drop trigger wf01_queue_fault on public.natori_notification_jobs; drop function public.wf01_queue_fault()',None)
    sql(f"update public.natori_talk_roughs set client_ok_at=clock_timestamp() where id={lit(failrid)}")
    check('direct_service_first_ok_has_event_and_one_job',counts(failrid)==[1,1])
    for statement in [f"update public.natori_talk_roughs set client_ok_at=null where id={lit(failrid)}",f"update public.natori_talk_roughs set client_ok_at=clock_timestamp() where id={lit(failrid)}",f"delete from public.natori_talk_roughs where id={lit(failrid)}"]:
        sql(statement,expected='23514')
    check('known_ok_cannot_clear_change_or_unmark')
    freshmid = uid('forged-insert-message')
    sql(f"insert into public.natori_consultation_messages(id,project_id,sender,body) values({lit(freshmid)},{lit(failpid)},'staff','Synthetic')")
    sql(f"insert into public.natori_talk_roughs(project_id,message_id,before_quote,client_ok_at) values({lit(failpid)},{lit(freshmid)},false,clock_timestamp())",expected='23514')
    check('direct_insert_with_ok_is_rejected')
    markrid,_=rough(failpid,'mark-unmark')
    sql(f"delete from public.natori_talk_roughs where id={lit(markrid)}")
    check('unanswered_mark_and_unmark_retained')
    for table in ['natori_rough_ok_events','natori_rough_ok_acknowledgements']:
        sql(f'update public.{table} set project_id=project_id',expected='42501')
        sql(f'delete from public.{table}',expected='42501')
        sql(f'update public.{table} set project_id=project_id',None,'23514')
        sql(f'delete from public.{table}',None,'23514')
    check('event_and_ack_update_delete_denied_and_immutable')
    sql(f"insert into public.natori_rough_ok_acknowledgements(rough_id,project_id,owner_id,client_ok_at) select id,project_id,{lit(OTHER)},client_ok_at from public.natori_talk_roughs where id={lit(failrid)}",expected='23514')
    check('ack_direct_insert_wrong_owner_binding_rejected')

    # Corrupt message/project/sender bindings are denied even though the FK exists.
    bindpid, bindtoken = project('binding')
    bindrid, bindmid = rough(bindpid,'binding')
    sql(f"update public.natori_consultation_messages set project_id={lit(foreign_pid)} where id={lit(bindmid)}")
    check('current_message_project_binding_rechecked',ok(bindpid,bindrid,bindtoken)['result']=='not_found')
    sql(f"update public.natori_consultation_messages set project_id={lit(bindpid)},sender='client' where id={lit(bindmid)}")
    check('current_message_staff_binding_rechecked',ok(bindpid,bindrid,bindtoken)['result']=='not_found' and counts(bindrid)==[0,0])

    # Fresh clock after a real project or queue lock wait; both paths tested.
    expid, extoken = project('expiry-project')
    exrid,_=rough(expid,'expiry-project')
    expire(extoken,3)
    expired=held_work(f'select id from public.natori_projects where id={lit(expid)} for update',[ok_sql(expid,exrid,extoken)],'expiry_project',lambda:wait_expired(extoken))[0]
    check('capability_expiry_while_waiting_project_denied',expired['result']=='not_found' and stored_ok(exrid)=='none' and counts(exrid)==[0,0])
    rpid,rtoken=project('expiry-rough')
    rrid,_=rough(rpid,'expiry-rough')
    expire(rtoken,3)
    rex=held_work(f'select id from public.natori_talk_roughs where id={lit(rrid)} for update',[ok_sql(rpid,rrid,rtoken)],'expiry_rough',lambda:wait_expired(rtoken))[0]
    check('capability_expiry_while_waiting_rough_denied',rex['result']=='not_found' and stored_ok(rrid)=='none' and counts(rrid)==[0,0])
    qpid,qtoken=project('expiry-queue')
    qrid,_=rough(qpid,'expiry-queue')
    expire(qtoken,3)
    held_work('lock table public.natori_notification_jobs in access exclusive mode',[(ok_sql(qpid,qrid,qtoken),'40001')],'expiry_queue',lambda:wait_expired(qtoken))
    check('expiry_during_queue_wait_rolls_back_ok_event_and_job',stored_ok(qrid)=='none' and counts(qrid)==[0,0])
    # Replay also checks the clock after reading queue state behind a table wait.
    replaypid,replaytoken=project('expiry-replay')
    replayrid,_=rough(replaypid,'expiry-replay')
    ok(replaypid,replayrid,replaytoken)
    replayfact=stored_ok(replayrid)
    expire(replaytoken,3)
    held_work('lock table public.natori_notification_jobs in access exclusive mode',[(ok_sql(replaypid,replayrid,replaytoken),'40001')],'expiry_replay',lambda:wait_expired(replaytoken))
    check('replay_queue_wait_checks_expiry_without_changing_fact',stored_ok(replayrid)==replayfact and counts(replayrid)==[1,1])
    # A concurrent capability update contends with the real FOR SHARE lock.
    cappid,captoken=project('capability-lock')
    caprid,_=rough(cappid,'capability-lock')
    capresults=held_work(f'select id from public.natori_consultation_access where token_hash={lit(captoken)} for update',[ok_sql(cappid,caprid,captoken)],'capability_row',lambda:None)
    check('matched_capability_row_is_locked',capresults[0]['result']=='ok')
    shorten_pid,shorten_token=project('capability-shortened')
    shorten_rid,_=rough(shorten_pid,'capability-shortened')
    shortened=held_work(f'select id from public.natori_consultation_access where token_hash={lit(shorten_token)} for update; update public.natori_consultation_access set expires_at=clock_timestamp()-interval \'1 second\' where token_hash={lit(shorten_token)}',[ok_sql(shorten_pid,shorten_rid,shorten_token)],'capability_shortened')[0]
    check('concurrent_shortened_capability_rechecked_after_row_lock',shortened['result']=='not_found' and counts(shorten_rid)==[0,0] and stored_ok(shorten_rid)=='none')


    # Process loss AFTER commit leaves durable pending work for a later dispatcher.
    crashpid,crashtoken=project('process-after-commit')
    crashrid,_=rough(crashpid,'process-after-commit')
    marker='WF01_committed_interruption'
    proc=subprocess.Popen(COMMAND,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
    proc.stdin.write(f'set role service_role; set application_name={lit(marker)}; begin;\n'+ok_sql(crashpid,crashrid,crashtoken)+';\ncommit;\nselect pg_sleep(15);\n')
    proc.stdin.flush()
    deadline=time.monotonic()+8
    while time.monotonic()<deadline:
        if counts(crashrid)==[1,1]:break
        time.sleep(.02)
    else:raise AssertionError('commit before process interruption not observed')
    check('postcommit_process_termination',value(f"select bool_and(pg_terminate_backend(pid)) from pg_stat_activity where application_name={lit(marker)}",None)=='t')
    proc.communicate(timeout=8)
    check('pending_job_survives_process_interruption',counts(crashrid)==[1,1] and listed(crashpid)[0]['notification_status']=='pending')

    retry_pid,retry_token=project('retry')
    retry_rid,_=rough(retry_pid,'retry')
    first=ok(retry_pid,retry_rid,retry_token)['notification_ids'][0]
    finish_notice(first,'unknown','unknown_retry')
    old=row(f"select to_jsonb(j)::text from public.natori_notification_jobs j where id={lit(first)}")
    check('unknown_retries_same_attempt_key_and_payload',retry(retry_pid,retry_rid)==first and counts(retry_rid)==[1,1])
    unknown_replayed=row(f"select to_jsonb(j)::text from public.natori_notification_jobs j where id={lit(first)}")
    check('unknown_job_payload_and_started_clock_preserved',unknown_replayed['payload']==old['payload'] and old['send_started_at'] is not None and unknown_replayed['send_started_at']==old['send_started_at'])
    failed_pid,failed_token=project('definite-failure-retry')
    failed_rid,_=rough(failed_pid,'definite-failure-retry')
    failed_first=ok(failed_pid,failed_rid,failed_token)['notification_ids'][0]
    finish_notice(failed_first,'failed','definite_failure')
    failed_old=row(f"select to_jsonb(j)::text from public.natori_notification_jobs j where id={lit(failed_first)}")
    second=retry(failed_pid,failed_rid)
    current=row(f"select to_jsonb(j)::text from public.natori_notification_jobs j where id={lit(second)}")
    check('definite_failure_creates_one_new_attempt_same_logical_key_payload',second!=failed_first and current['attempt_no']==2 and current['notification_key']==failed_old['notification_key'] and current['payload']==failed_old['payload'] and current['send_started_at'] is None and counts(failed_rid)==[1,2])
    check('latest_attempt_pending_replaces_older_failed_projection',listed(failed_pid)[0]['notification_id']==second and listed(failed_pid)[0]['notification_status']=='pending' and overview(failed_pid)[0]['notification_failed']==0)
    check('repeated_retry_returns_existing_open_attempt',retry(failed_pid,failed_rid)==second and counts(failed_rid)==[1,2])
    badpid,badtoken=project('malformed-retry-history')
    badrid,_=rough(badpid,'malformed-retry-history')
    badfirst=ok(badpid,badrid,badtoken)['notification_ids'][0]
    finish_notice(badfirst,'failed','malformed_retry')
    sql(f"insert into public.natori_notification_jobs(notification_key,attempt_no,project_id,purpose,snapshot) values('rough-ok/'||{lit(badrid)},2,{lit(foreign_pid)},'quote_accept_artist','{{}}')")
    sql(f"select public.natori_retry_rough_ok_notification_v1({lit(OWNER)},{lit(badpid)},{lit(badrid)})",expected='23514')
    check('retry_rejects_cross_project_or_nonrough_latest_history')

    # Actual browser roles, not catalog-only approximations, for all public entrypoints.
    rpc_signatures=[f"public.natori_record_rough_ok_v1({lit(retry_pid)},{lit(retry_rid)},{lit(retry_token)})",
                    f"public.natori_acknowledge_rough_ok_v1({lit(OWNER)},{lit(retry_pid)},{lit(retry_rid)})",
                    f"public.natori_rough_ok_list_v1({lit(OWNER)},{lit(retry_pid)})",
                    f"public.natori_consultation_overview_v2({lit(OWNER)},array[{lit(retry_pid)}]::uuid[])",
                    f"public.natori_retry_rough_ok_notification_v1({lit(OWNER)},{lit(retry_pid)},{lit(retry_rid)})"]
    for role in ['anon','authenticated']:
        for expression in rpc_signatures:sql('select * from '+expression,role,'42501')
        for table in ['natori_talk_roughs','natori_rough_ok_events','natori_rough_ok_acknowledgements']:
            sql('select * from public.'+table,role,'42501')
        check(role+'_cannot_read_facts_or_execute_business_rpcs')
    check('all_new_helpers_private_and_all_new_rpcs_invoker',value("select bool_and(not prosecdef and proconfig=array['search_path=\"\"']::text[] and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE')) from pg_proc where proname in ('natori_rough_ok_fact_guard_v1','natori_rough_ok_insert_guard_v1','natori_rough_ok_ack_binding_v1','natori_rough_ok_enqueue_v1','natori_record_rough_ok_v1','natori_acknowledge_rough_ok_v1','natori_rough_ok_list_v1','natori_retry_rough_ok_notification_v1','natori_consultation_overview_v2')",None)=='t')
    check('version1_signature_preserved',value("select pg_get_function_result('public.natori_consultation_overview_v1(uuid,uuid[])'::regprocedure)",None)=='TABLE(project_id uuid, latest_message_id uuid, latest_sender text, latest_message_at timestamp with time zone, notification_failed integer, notification_pending integer)')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--container',required=True)
    parser.add_argument('--results',required=True)
    args=parser.parse_args()
    assert args.container.startswith('natori-wf01-')
    results=Path(args.results)
    assert results.is_dir() and '/natori-wf01.' in str(results)
    COMMAND=['docker','exec','-i',args.container,'psql','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-qAt','-h','/var/run/postgresql','-U','postgres','-d','natori_wf01']
    evidence_paths=SOURCES+[MIGRATION,'scripts/natori-wf01/bootstrap.sql','scripts/natori-wf01/acceptance.py','scripts/natori-wf01/run.sh','.github/workflows/natori-wf01.yml']
    (results/'source-sha256.json').write_text(json.dumps({p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in evidence_paths},indent=2)+'\n')
    outcome='failed'
    try:
        main()
        outcome='passed'
    finally:
        (results/'native-checks.json').write_text(json.dumps({'outcome':outcome,'checkCount':len(CHECKS),'checks':CHECKS,'database':'disposable native PostgreSQL 17.11','provider':'none'},indent=2)+'\n')
