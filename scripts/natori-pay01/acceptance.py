#!/usr/bin/env python3
"""Execute actual PostgreSQL RPCs/guards; publish only test names/counts/source hashes."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
SOURCES = [
    'supabase/migrations/20260723111730_etorie_baseline.sql',
    'supabase/migrations/20260723111741_baseline_security_hardening.sql',
    'supabase/migrations/20260729115313_etorie_phase1_expand.sql',
    'supabase/migrations/20260806120330_natori_accept_delivery_rpc.sql',
    'supabase/migrations/20260927073530_natori_acceptance_notifications.sql',
    'supabase/migrations/20260930101753_natori_delivery_integrity.sql',
    'supabase/migrations/20261001150445_natori_payment_event_inbox.sql',
    'supabase/migrations/20261001221938_natori_refund_ledger.sql',
    'supabase/migrations/20261001223805_natori_task_integrity.sql',
]
MIGRATION = 'supabase/migrations/20261012064005_natori_pay01_completion_evidence.sql'
ISSUE = 'public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)'
ACCEPT = 'public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz)'
OWNER = '00000000-0000-4000-8000-000000000001'
OTHER = '00000000-0000-4000-8000-000000000002'
HISTORICAL = '2024-01-03T09:00:00+00:00'
CHECKS = []
ENV = {k: v for k, v in os.environ.items() if k in ('PATH', 'LANG', 'LD_LIBRARY_PATH')}
# -X ignores psql startup files. Empty pgpass/service locations prevent credential reads.
ENV.update({'PGPASSFILE': '/dev/null', 'PGSERVICEFILE': '/dev/null'})


def literal(value):
    if value is None:
        return 'null'
    return "'" + str(value).replace("'", "''") + "'"


def js(value):
    return literal(json.dumps(value, separators=(',', ':'))) + '::jsonb'


def sql(statement, role='service_role', expected=None):
    prefix = f'SET ROLE {role};\n' if role else ''
    result = subprocess.run(COMMAND, input=prefix + statement, capture_output=True, text=True, env=ENV, timeout=20)
    if expected:
        assert result.returncode != 0 and expected in result.stderr, f'expected SQLSTATE {expected}; got {result.stderr[:150]}'
        return None
    assert result.returncode == 0, result.stderr[:500]
    return result.stdout.strip()


def value(statement, role='service_role'):
    return sql(statement, role).splitlines()[-1]


def check(name, condition=True):
    assert condition, name
    CHECKS.append(name)
    print('PASS ' + name, flush=True)


def state(pid):
    return json.loads(value(f"select to_jsonb(p)::text from public.natori_projects p where id={literal(pid)}"))


def assert_unchanged(pid, before, name):
    check(name, state(pid) == before)


def project(label, paid=True, status='delivery_prep', extras=None):
    pid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'natori-pay01/' + label))
    fields = dict(id=pid, user_id=OWNER, title='PAY01 synthetic', client_name='Synthetic client',
                  client_email='client@pay01.invalid', amount=1000, type='illustration', status=status,
                  due_date='2027-01-01', payment_confirmed_at=HISTORICAL if paid else None,
                  paid_at=HISTORICAL if paid else None, paid_amount=1000 if paid else None)
    fields.update(extras or {})
    sql('insert into public.natori_projects(' + ','.join(fields) + ') values(' + ','.join(literal(v) for v in fields.values()) + ')')
    return pid


def file(pid):
    fid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay01-file/' + pid))
    path = pid + '/final/' + fid + '.png'
    result = value(f"select result from public.natori_delivery_reserve_v1({literal(OWNER)},{literal(pid)},{literal(fid)},'final',{literal(path)},'synthetic.png',32,'image/png')")
    assert result == 'reserved', result
    assert value(f"select public.natori_delivery_finalize_v1({literal(OWNER)},{literal(fid)},32,'image/png','synthetic-version',clock_timestamp())") == 'ready'
    return [dict(id=fid, path=path, fileName='synthetic.png', sizeBytes=32,
                 contentType='image/png', storageVersion='synthetic-version')]


def issue_sql(pid, manifest, token, op, owner=OWNER, expires="clock_timestamp()+interval '1 day'", payload=None, request_hash=None):
    payload = payload or dict(format='natori-delivery-aes256gcm-v1', ciphertext='synthetic', iv='synthetic', tag='synthetic', expiresAt='2027-01-01T00:00:00Z')
    # Match deliveryReleaseService's stable business-request identity. The
    # operation ID and newly generated access token are intentionally excluded.
    request = dict(project=pid, files=sorted(f['id'] for f in manifest), to='client@pay01.invalid', subject='PAY01 synthetic', body='PAY01 synthetic')
    request_hash = request_hash or hashlib.sha256(json.dumps(request,separators=(',', ':')).encode()).hexdigest()
    return f"select row_to_json(r)::text from public.natori_delivery_issue_v1({literal(owner)},{literal(pid)},{literal(op)},'client@pay01.invalid',{literal(request_hash)},{js(manifest)},clock_timestamp(),{literal(token)},{expires},{js(payload)}) r"


def issued(label, expires="clock_timestamp()+interval '1 day'"):
    pid = project(label)
    manifest = file(pid)
    token = hashlib.sha256(('token/' + label).encode()).hexdigest()
    op = str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay01-operation/' + label))
    result = json.loads(value(issue_sql(pid, manifest, token, op, expires=expires)))
    assert result['result'] == 'issued', result['result']
    return pid, manifest, token, op, result['release_id']


def accept_sql(token, rid, manifest, verified='clock_timestamp()'):
    return f"select row_to_json(r)::text from public.natori_accept_delivery_ready_v1({literal(token)},{literal(rid)},{js(manifest)},{verified}) r"


def accept(token, rid, manifest, verified='clock_timestamp()'):
    return json.loads(value(accept_sql(token, rid, manifest, verified)))


def release(pid):
    return json.loads(value(f"select to_jsonb(r)::text from public.natori_delivery_releases r where project_id={literal(pid)}"))


def notice_count(pid, purpose=None):
    clause = " and purpose like 'delivery_accept_%'" if purpose else ''
    return int(value(f"select count(*) from public.natori_notification_jobs where project_id={literal(pid)}{clause}"))


def apply_new(expected=None):
    return sql((ROOT / MIGRATION).read_text(), role=None, expected=expected)


def guarded_attempt(pid, statement, name, role='service_role', expected='23514'):
    before = state(pid)
    sql(statement, role=role, expected=expected)
    assert_unchanged(pid, before, name)


def lock_race(pid, statements, name):
    # Hold the actual project row until two independent RPC sessions are waiting.
    marker = 'PAY01_' + name
    holder = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=ENV)
    holder.stdin.write(f"begin; select id from public.natori_projects where id={literal(pid)} for update; select pg_advisory_xact_lock(12064005,1); select pg_sleep(3); commit;\n")
    holder.stdin.close()
    for _ in range(50):
        if value('select pg_try_advisory_xact_lock(12064005,1)', role=None) == 'f':
            break
        time.sleep(.02)
    else:
        raise AssertionError('row lock rendezvous not observed')
    def participant(item):
        statement, expected = item if isinstance(item, tuple) else (item, None)
        output = sql('-- ' + marker + '\n' + statement, expected=expected)
        return dict(result='rejected', sqlstate=expected) if expected else json.loads(output.splitlines()[-1])

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as workers:
        pending = []
        # Observe each queued waiter before starting the next participant. The
        # two mixed races therefore test both arrival orders against a held row.
        for index, statement in enumerate(statements):
            pending.append(workers.submit(participant, statement))
            waiters = 0
            for _ in range(50):
                waiters = int(value(f"select count(*) from pg_stat_activity where pid<>pg_backend_pid() and query like '%{marker}%' and wait_event_type='Lock'", role=None))
                if waiters == index + 1:
                    break
                time.sleep(.02)
            assert waiters == index + 1, 'both native sessions must contend on the project row'
        result = [p.result() for p in pending]
    assert holder.wait(timeout=8) == 0
    check(name + '_two_real_row_lock_waiters')
    return result


def main():
    # These names/configuration describe a fresh dedicated socket-only database.
    assert value("select current_database()='natori_pay01' and current_setting('listen_addresses')=''", role=None) == 't'
    assert value('show server_version_num', role=None).startswith('1700')
    sql((ROOT / 'scripts/natori-pay01/bootstrap.sql').read_text(), role=None)
    for path in SOURCES:
        sql((ROOT / path).read_text(), role=None)

    # A real pre-fix reproduction: generic complete then Undo poisons acceptance.
    poisoned, manifest, token, _, rid = issued('pre-fix-reproduction')
    sql(f"update public.natori_projects set status='completed',completed_at=clock_timestamp() where id={literal(poisoned)}")
    sql(f"update public.natori_projects set status='delivered' where id={literal(poisoned)}")
    before = state(poisoned)
    check('pre_fix_generic_complete_and_undo_poison_real_rpc', before['completed_at'] is not None and before['delivery_accepted_at'] is None and accept(token, rid, manifest)['result'] == 'invalid-state')

    legacy = project('pre-existing-accepted-legacy', status='completed', extras=dict(
        completed_at='2024-01-04T09:00:00+00:00', delivery_accepted_at=HISTORICAL,
        delivery_token_hash='b' * 64, delivery_token_expires_at='2027-01-01T00:00:00+00:00', delivered_mail_at=HISTORICAL))
    legacy_before = state(legacy)
    legacy_manifest = [dict(id='00000000-0000-4000-8000-000000000099', path=legacy+'/final/legacy.png', fileName='legacy.png', sizeBytes=32, contentType='image/png', storageVersion='legacy-version')]
    # Stored ready file in a synthetic historical completed project; no guard is disabled.
    sql(f"insert into public.natori_delivery_files(id,project_id,folder,storage_path,file_name,size_bytes,state,content_type,storage_version,verified_at) values({literal(legacy_manifest[0]['id'])},{literal(legacy)},'final',{literal(legacy_manifest[0]['path'])},'legacy.png',32,'ready','image/png','legacy-version',clock_timestamp())")

    # Elevating a drifted body/runtime/trigger/column grant must be atomic and fail closed.
    original = sql(f"select pg_get_functiondef({literal(ACCEPT)}::regprocedure)", role=None)
    sql(original.replace('declare p public.natori_projects%rowtype;', '-- synthetic source drift\ndeclare p public.natori_projects%rowtype;'), role=None)
    apply_new(expected='P0001')
    sql(original, role=None)
    check('migration_rejects_rpc_body_drift')
    sql(f"alter function {ACCEPT} set statement_timeout='5s'", role=None)
    apply_new(expected='P0001')
    sql(f'alter function {ACCEPT} reset statement_timeout', role=None)
    check('migration_rejects_rpc_runtime_setting_drift')
    sql('alter table public.natori_projects disable trigger natori_delivery_project_guard', role=None)
    apply_new(expected='P0001')
    sql('alter table public.natori_projects enable trigger natori_delivery_project_guard', role=None)
    check('migration_rejects_disabled_delivery_guard')
    # PostgreSQL's REVOKE ALL on the table closes direct column grants too.
    # An inherited column writer is the meaningful unresolved-drift case: this
    # scoped migration must abort rather than changing role membership globally.
    sql('create role pay01_release_writer nologin; grant update(accepted_at) on public.natori_delivery_releases to pay01_release_writer; grant pay01_release_writer to service_role', role=None)
    apply_new(expected='P0001')
    check('migration_acl_drift_rolls_back_authority_elevation', value(f"select not prosecdef from pg_proc where oid={literal(ACCEPT)}::regprocedure", role=None) == 't')
    sql('revoke pay01_release_writer from service_role; revoke update(accepted_at) on public.natori_delivery_releases from pay01_release_writer', role=None)
    sql('grant update(accepted_at) on public.natori_delivery_releases to service_role', role=None)
    apply_new()
    check('migration_closes_direct_column_writer_grant', value("select not has_column_privilege('service_role','public.natori_delivery_releases','accepted_at','UPDATE')",role=None) == 't')
    assert_unchanged(poisoned, before, 'migration_does_not_repair_or_backfill_poisoned_history')
    assert_unchanged(legacy, legacy_before, 'migration_preserves_legacy_accepted_original_dates')

    check('dedicated_rpc_owner_runtime_and_service_execute', value(f"select count(*)=2 from pg_proc f join pg_roles o on o.oid=f.proowner where f.oid in ({literal(ISSUE)}::regprocedure,{literal(ACCEPT)}::regprocedure) and f.prosecdef and o.rolname='postgres' and f.proconfig=array['search_path=\"\"']::text[] and has_function_privilege('service_role',f.oid,'EXECUTE')", role=None) == 't')

    p, m, t, op, r = issued('fixed-delivery')
    check('genuine_publication_atomic_release_access_operation_notice', state(p)['status'] == 'delivered' and notice_count(p) == 1 and value(f"select count(*) from public.natori_delivery_operations where project_id={literal(p)}") == '1')
    # Reuse the original stored expiry exactly, as the RPC's idempotency contract requires.
    exp = literal(release(p)['expires_at']) + '::timestamptz'
    check('publication_operation_retry_idempotent', json.loads(value(issue_sql(p,m,t,op,expires=exp)))['release_id'] == r and notice_count(p) == 1)
    check('publication_operation_request_conflict_rejected', json.loads(value(issue_sql(p,m,t,op,expires=exp,request_hash='0'*64)))['result'] == 'conflict' and notice_count(p) == 1)
    for label, stmt in [
        ('generic_first_completed_at_without_acceptance', f"update public.natori_projects set completed_at=clock_timestamp() where id={literal(p)}"),
        ('generic_completed_status_without_timestamp', f"update public.natori_projects set status='completed' where id={literal(p)}"),
        ('generic_completed_status_and_timestamp', f"update public.natori_projects set status='completed',completed_at=clock_timestamp() where id={literal(p)}"),
        ('generic_forged_customer_acceptance', f"update public.natori_projects set status='completed',delivery_accepted_at=clock_timestamp(),completed_at=clock_timestamp() where id={literal(p)}"),
        ('status_undo_from_delivered', f"update public.natori_projects set status='delivery_prep' where id={literal(p)}"),
        ('guc_spoof_cannot_authorize_completion', f"set natori.delivery_acceptance='true'; set request.jwt.claim.role='postgres'; update public.natori_projects set status='completed',completed_at=clock_timestamp() where id={literal(p)}"),
        ('issued_token_evidence_immutable', f"update public.natori_projects set delivery_token_hash={'c'*64!r} where id={literal(p)}"),
    ]:
        guarded_attempt(p, stmt, label)
    sql(f"update public.natori_delivery_releases set accepted_at=clock_timestamp() where id={literal(r)}", expected='42501')
    check('service_cannot_forge_release_first_acceptance')
    sql(f"insert into public.natori_delivery_releases(project_id,manifest,snapshot,expires_at,accepted_at) values({literal(p)},{js(m)},'{{}}',clock_timestamp()+interval '1 day',clock_timestamp())", expected='42501')
    check('service_cannot_insert_forged_release')
    check('unaccepted_stale_manifest_rejected', accept(t,r,m[:-1])['result'] == 'unavailable')
    check('unaccepted_stale_server_verification_rejected', accept(t,r,m,"clock_timestamp()-interval '61 seconds'")['result'] == 'unavailable')
    check('other_owner_publication_denied', json.loads(value(issue_sql(p,m,'d'*64,str(uuid.uuid4()),owner=OTHER,expires=exp)))['result'] == 'not-found')

    # Two sessions genuinely wait on the same project row; exactly one commits acceptance.
    results = lock_race(p, [accept_sql(t,r,m), accept_sql(t,r,m)], 'concurrent_acceptance')
    check('concurrent_acceptance_one_new_one_idempotent', sorted(x['result'] for x in results) == ['accepted','already-accepted'])
    after = state(p)
    check('customer_acceptance_atomic_matching_dates', after['status'] == 'completed' and after['delivery_accepted_at'] == after['completed_at'] == release(p)['accepted_at'] and notice_count(p,True) == 2)
    check('repeat_customer_acceptance_idempotent', accept(t,r,m)['result'] == 'already-accepted' and notice_count(p,True) == 2)
    for generic_first in (True, False):
        race, rm, rt, _, rr = issued('generic-vs-accept-' + str(generic_first))
        race_before = state(race)
        generic = (f"update public.natori_projects set status='completed',completed_at=clock_timestamp() where id={literal(race)}", '23514')
        genuine = accept_sql(rt,rr,rm)
        order = [generic,genuine] if generic_first else [genuine,generic]
        race_results = lock_race(race,order,'generic_vs_accept_' + str(generic_first))
        check('generic_vs_accept_' + str(generic_first) + '_only_genuine_acceptance_commits', sorted(x['result'] for x in race_results) == ['accepted','rejected'])
        race_after = state(race)
        check('generic_vs_accept_' + str(generic_first) + '_no_poisoned_or_duplicate_evidence', race_after['status'] == 'completed' and race_after['completed_at'] == race_after['delivery_accepted_at'] == release(race)['accepted_at'] and race_after['mutation_revision'] == race_before['mutation_revision'] + 1 and notice_count(race,True) == 2)
    guarded_attempt(p, f"update public.natori_projects set status='delivered' where id={literal(p)}", 'status_undo_from_accepted_completion')
    guarded_attempt(p, f"update public.natori_projects set completed_at=null,delivery_accepted_at=null where id={literal(p)}", 'accepted_timestamps_cannot_be_cleared')
    sql(f"update public.natori_projects set title='PAY01 metadata',note='metadata',priority='high' where id={literal(p)}")
    check('accepted_metadata_update_preserves_dates', state(p)['delivery_accepted_at'] == after['delivery_accepted_at'] and state(p)['completed_at'] == after['completed_at'])
    state_before_resend = state(p)
    result = json.loads(value(issue_sql(p,m,'e'*64,str(uuid.uuid4()),expires=exp)))
    check('accepted_release_reissue_retains_original_publication', result['release_id'] == r)
    assert_unchanged(p,state_before_resend,'accepted_release_reissue_preserves_status_dates')

    for paid in (False,True):
        no = project('no-release-'+str(paid),paid=paid)
        for status in ('delivered','completed'):
            guarded_attempt(no,f"update public.natori_projects set status={literal(status)} where id={literal(no)}", f'no_release_paid_{paid}_generic_{status}_rejected')
        guarded_attempt(no,f"update public.natori_projects set completed_at=clock_timestamp() where id={literal(no)}",f'no_release_paid_{paid}_first_completion_rejected')
        guarded_attempt(no,f"update public.natori_projects set delivery_accepted_at=clock_timestamp(),completed_at=clock_timestamp(),status='completed' where id={literal(no)}",f'no_release_paid_{paid}_forged_acceptance_rejected')
    unpaid, um, ut, _, ur = issued('unpaid-after-issue')
    sql(f"update public.natori_projects set payment_confirmed_at=null where id={literal(unpaid)}")
    check('unpaid_customer_acceptance_rejected', accept(ut,ur,um)['result'] == 'unpaid')
    guarded_attempt(unpaid,f"update public.natori_projects set status='completed',completed_at=clock_timestamp() where id={literal(unpaid)}",'unpaid_generic_completion_rejected')
    expired, em, et, _, er = issued('expired',expires="clock_timestamp()+interval '0.25 seconds'")
    time.sleep(.3)
    check('expired_customer_acceptance_rejected', accept(et,er,em)['result'] == 'expired')
    guarded_attempt(expired,f"update public.natori_projects set status='completed',completed_at=clock_timestamp() where id={literal(expired)}",'expired_generic_completion_rejected')

    # Failure after acceptance writes both rows must roll back release, project and notices.
    fail, fm, ft, _, fr = issued('acceptance-rollback')
    sql(f"insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot) values('delivery-accepted/'||{literal(fail)}||'/delivery_accept_artist',{literal(fail)},'delivery_accept_artist','{{}}')")
    fail_before = state(fail)
    sql(accept_sql(ft,fr,fm),expected='23505')
    assert_unchanged(fail,fail_before,'acceptance_notification_failure_rolls_back_project')
    check('acceptance_notification_failure_rolls_back_release_and_notices', release(fail)['accepted_at'] is None and notice_count(fail,True) == 1)
    bad = project('issue-rollback')
    bm = file(bad)
    bad_before = state(bad)
    sql(issue_sql(bad,bm,'f'*64,str(uuid.uuid4()),payload=dict(format='natori-delivery-aes256gcm-v1')),expected='23514')
    assert_unchanged(bad,bad_before,'issue_notification_failure_rolls_back_project_token')
    check('issue_notification_failure_rolls_back_release_access_operation', value(f"select count(*)=0 from public.natori_delivery_releases where project_id={literal(bad)}") == 't' and notice_count(bad) == 0)

    # Historical manual registration uses the real existing create RPC; no acceptance proxy.
    manual_json = dict(title='PAY01 historical manual',client_name='Synthetic',amount=1000,type='illustration',status='completed',delivery_plan='normal',due_date='2024-01-04',payment_confirmed_at=HISTORICAL,paid_at=HISTORICAL,paid_amount=1000,completed_at='2024-01-04T09:00:00Z')
    manual = value(f"select public.natori_create_project_with_tasks({literal(OWNER)},{js(manual_json)},'[]','[]')")
    historical = state(manual)
    check('manual_paid_historical_completed_registration_preserved', historical['status'] == 'completed' and historical['delivery_accepted_at'] is None and historical['delivery_token_hash'] is None and historical['completed_at'].startswith('2024-01-04'))
    sql(f"update public.natori_projects set note='historical metadata',paid_amount=1000 where id={literal(manual)}")
    check('manual_completed_metadata_payment_updates_preserve_date', state(manual)['completed_at'] == historical['completed_at'])
    guarded_attempt(manual,f"update public.natori_projects set completed_at=clock_timestamp() where id={literal(manual)}",'manual_original_completion_date_immutable')
    sql(f"update public.natori_projects set note='legacy metadata',paid_amount=1000 where id={literal(legacy)}")
    legacy_meta = state(legacy)
    adoption = json.loads(value(issue_sql(legacy,legacy_manifest,'a'*64,str(uuid.uuid4()),expires="'2027-01-01T00:00:00Z'::timestamptz")))
    check('legacy_preexisting_acceptance_adoption_preserved', adoption['result'] == 'issued' and release(legacy)['accepted_at'] == legacy_before['delivery_accepted_at'])
    assert_unchanged(legacy,legacy_meta,'legacy_adoption_does_not_synthesize_completion_date')
    check('legacy_accepted_retry_does_not_enqueue_acceptance', accept('b'*64,adoption['release_id'],legacy_manifest)['result'] == 'already-accepted' and notice_count(legacy,True) == 0)

    task = project('task-production',status='rough')
    sql(f"insert into public.natori_project_tasks(project_id,task_key,label,stage,done,sort_order) values({literal(task)},'rough','Rough','rough',false,1),({literal(task)},'final','Final','delivery',false,2)")
    check('real_task_rpc_production_transition_allowed', json.loads(value(f"select public.natori_update_task_v1({literal(OWNER)},{literal(task)},'rough',true)"))['result'] == 'applied' and state(task)['status'] == 'delivery_prep')
    check('real_task_rpc_never_writes_completion', state(task)['completed_at'] is None and state(task)['delivery_accepted_at'] is None)
    sql(f"insert into public.natori_project_tasks(project_id,task_key,label,stage,done,sort_order) values({literal(p)},'existing-terminal-task','Final','delivery',false,1)")
    task_terminal_before = state(p)
    check('real_task_rpc_delivery_lock_preserved', json.loads(value(f"select public.natori_update_task_v1({literal(OWNER)},{literal(p)},'existing-terminal-task',true)"))['result'] == 'conflict' and value(f"select not done from public.natori_project_tasks where project_id={literal(p)} and task_key='existing-terminal-task'") == 't')
    assert_unchanged(p,task_terminal_before,'terminal_task_conflict_preserves_acceptance_dates_status')

    # Real refund reconciliation keeps formal completion dates/status untouched.
    sql(f"update public.natori_projects set stripe_payment_session_id='cs_pay01_synthetic' where id={literal(p)}")
    payment = value(f"insert into public.natori_payment_transactions(project_id,stripe_session_id,amount,status,stripe_account_scope,stripe_livemode,stripe_payment_intent_id,stripe_currency) values({literal(p)},'cs_pay01_synthetic',1000,'received','platform',false,'pi_pay01_synthetic','jpy') returning id")
    sql(f"insert into public.natori_refund_ledger(owner_id,account_scope,livemode,refund_id,project_id,payment_intent_id,amount,currency,provider_status,confirmed_at,first_event_id,latest_event_id,provider_event_created) values({literal(OWNER)},'platform',false,'re_pay01_synthetic',{literal(p)},'pi_pay01_synthetic',100,'jpy','succeeded',clock_timestamp(),'evt_pay01','evt_pay01',1)")
    refund_before = state(p)
    sql(f"select public.natori_refund_reconcile_v1({literal(OWNER)},'platform',false,'re_pay01_synthetic')")
    check('real_refund_reconciliation_remains_available', value("select resolution from public.natori_refund_ledger where refund_id='re_pay01_synthetic'") == 'resolved')
    assert_unchanged(p,refund_before,'refund_preserves_customer_completion_dates_status')

    # Actual baseline ACL is closed. Also test the owner policy with plausible DML
    # restored ONLY in this synthetic fixture to prove the guard itself holds.
    for role in ('anon','authenticated'):
        sql(accept_sql(t,r,m),role=role,expected='42501')
        sql(issue_sql(p,m,'a'*64,str(uuid.uuid4()),expires=exp),role=role,expected='42501')
        check(role+'_dedicated_rpcs_execute_denied')
    sql('grant select,insert,update on public.natori_projects to authenticated',role=None)
    auth_prefix = f"select set_config('request.jwt.claim.sub',{literal(OWNER)},false);"
    forged = str(uuid.uuid4())
    for field in ('delivery_accepted_at','delivery_token_hash','delivered_mail_at'):
        evidence = "'a'" if field == 'delivery_token_hash' else 'clock_timestamp()'
        sql(auth_prefix+f"insert into public.natori_projects(id,user_id,title,client_name,type,status,due_date,{field}) values({literal(forged)},{literal(OWNER)},'PAY01 synthetic','Synthetic','illustration','completed','2027-01-01',{evidence})",role='authenticated',expected='23514')
        check('browser_own_insert_cannot_forge_'+field)
        sql(f"insert into public.natori_projects(id,user_id,title,client_name,type,status,due_date,{field}) values({literal(forged)},{literal(OWNER)},'PAY01 synthetic','Synthetic','illustration','completed','2027-01-01',{evidence})",role='service_role',expected='23514')
        check('service_insert_cannot_forge_'+field)
    guarded_attempt(p,auth_prefix+f"update public.natori_projects set completed_at=clock_timestamp() where id={literal(p)}",'browser_own_update_completion_denied',role='authenticated')
    guarded_attempt(task,auth_prefix+f"update public.natori_projects set status='completed' where id={literal(task)}",'browser_own_generic_status_denied',role='authenticated',expected='42501')
    sql(auth_prefix+f"update public.natori_projects set note='owner metadata' where id={literal(p)}",role='authenticated')
    check('browser_own_metadata_does_not_require_release_privilege', state(p)['note'] == 'owner metadata')
    result = value(f"select set_config('request.jwt.claim.sub',{literal(OTHER)},false); with changed as (update public.natori_projects set note='other owner' where id={literal(p)} returning id) select count(*) from changed",role='authenticated')
    check('browser_other_owner_rls_zero_rows', result == '0' and state(p)['note'] == 'owner metadata')
    sql('revoke select,insert,update on public.natori_projects from authenticated',role=None)

    # Actual SQL and its selected historical prerequisites are fingerprinted.
    provenance = [dict(path=x,sha256=hashlib.sha256((ROOT/x).read_bytes()).hexdigest()) for x in ['scripts/natori-pay01/bootstrap.sql',*SOURCES,MIGRATION,'scripts/natori-pay01/acceptance.py','scripts/natori-pay01/run.sh']]
    output = dict(engine='native-postgresql',serverVersion=value('show server_version',role=None),
                  isolation='unix-socket-only; dedicated synthetic database',
                  fixture='selected exact migrations; no full active replay',count=len(CHECKS),checks=CHECKS,sources=provenance)
    RESULTS.mkdir(parents=True,exist_ok=True)
    (RESULTS/'acceptance.json').write_text(json.dumps(output,indent=2)+'\n')
    print(f'PASS native PostgreSQL acceptance: {len(CHECKS)} checks; no customer rows or production connection',flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--container',required=True)
    parser.add_argument('--results',required=True)
    args = parser.parse_args()
    assert re.fullmatch(r'natori-pay01-[0-9]+-[0-9]+',args.container), 'dedicated CI container required'
    COMMAND = ['docker','exec','-i',args.container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-h','/var/run/postgresql','-U','postgres','-d','natori_pay01']
    RESULTS = Path(args.results)
    main()
