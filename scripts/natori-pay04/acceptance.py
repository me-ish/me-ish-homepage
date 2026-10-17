#!/usr/bin/env python3
"""PAY-04 delivery extension: execute the real RPC and guards on a disposable PostgreSQL."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import uuid

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = 'supabase/migrations/20261013130000_natori_delivery_extension.sql'
RESEND_MIGRATION = 'supabase/migrations/20261017093231_natori_delivery_resend_effective_expiry.sql'
EXTEND = 'public.natori_delivery_extend_v1(uuid,uuid,uuid,text,timestamptz,text,text,jsonb,timestamptz,jsonb)'
CHECKS = []


def check(name, condition=True):
    assert condition, name
    assert name not in CHECKS, 'duplicate evidence ID'
    CHECKS.append(name)
    print('PASS ' + name, flush=True)


def load_pay01():
    spec = importlib.util.spec_from_file_location('pay04_pay01_helpers', ROOT / 'scripts/natori-pay01/acceptance.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.check = check
    return module


def main(command, results):
    pay = load_pay01()
    pay.COMMAND = command
    lit, js, sql, value = pay.literal, pay.js, pay.sql, pay.value
    assert value("select current_database()='natori_pay01' and current_setting('listen_addresses')=''", role=None) == 't'
    sql((ROOT / 'scripts/natori-pay01/bootstrap.sql').read_text(), role=None)
    for path in pay.SOURCES + [pay.MIGRATION]:
        sql((ROOT / path).read_text(), role=None)
    sql((ROOT / RESEND_MIGRATION).read_text(), role=None, expected='P0001')
    check('q01_migration_requires_extension_prerequisite')
    sql((ROOT / MIGRATION).read_text(), role=None)
    sql(f'alter function {pay.ISSUE} security invoker', role=None)
    sql((ROOT / RESEND_MIGRATION).read_text(), role=None, expected='P0001')
    check('q01_migration_rejects_runtime_drift')
    sql(f'alter function {pay.ISSUE} security definer', role=None)
    sql((ROOT / RESEND_MIGRATION).read_text(), role=None)

    def request_hash(label):
        return hashlib.sha256(('pay04/' + label).encode()).hexdigest()

    def payload():
        return dict(format='natori-delivery-aes256gcm-v1', ciphertext='synthetic', iv='synthetic', tag='synthetic', expiresAt='2027-01-01T00:00:00Z')

    def extend_sql(pid, manifest, token, op, expires, reason='Synthetic reason', owner=pay.OWNER, label=None, verified='clock_timestamp()'):
        return (f"select row_to_json(r)::text from {EXTEND.split('(')[0]}({lit(owner)},{lit(pid)},{lit(op)},"
                f"{lit(request_hash(label or op))},{expires},{lit(reason)},{lit(token)},{js(manifest)},{verified},{js(payload())}) r")

    def extend(*args, **kwargs):
        return json.loads(value(extend_sql(*args, **kwargs)))

    def send_notice(notice_id):
        claim = str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay04-claim/' + notice_id))
        assert value(f"select count(*) from public.natori_notification_claim_v1({lit(notice_id)},{lit(claim)},true)") == '1'
        stored = value(f"select payload::text from public.natori_notification_jobs where id={lit(notice_id)}")
        assert value(f"select count(*) from public.natori_notification_start_v1({lit(notice_id)},{lit(claim)},{lit(stored)}::jsonb)") == '1'
        assert value(f"select public.natori_notification_finish_v1({lit(notice_id)},{lit(claim)},'sent','synthetic-provider',null)") == 't'

    def notice_of(pid):
        return value(f"select id from public.natori_notification_jobs where project_id={lit(pid)} and purpose='delivery_issue_client' order by created_at desc limit 1")

    future = "clock_timestamp()+interval '10 days'"

    # An issued delivery whose download period already ran out.
    pid, manifest, old_token, _, rid = pay.issued('expired', expires="clock_timestamp()+interval '2 seconds'")
    value('select 1 from pg_sleep(2.5)')
    original = pay.release(pid)
    check('original_link_is_expired', pay.accept(old_token, rid, manifest)['result'] == 'expired')

    # The first mail is still queued: no second mail may be queued behind it.
    new_token = hashlib.sha256(b'pay04/new-token').hexdigest()
    op = str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay04/op-1'))
    check('extension_waits_while_previous_notice_is_unresolved', extend(pid, manifest, new_token, op, future)['result'] == 'notice-pending')
    send_notice(notice_of(pid))

    # Boundaries and wrong state.
    check('extension_rejects_expiry_not_after_current', extend(pid, manifest, new_token, op, "clock_timestamp()-interval '1 day'")['result'] == 'invalid-expiry')
    check('extension_rejects_expiry_within_one_day', extend(pid, manifest, new_token, op, "clock_timestamp()+interval '12 hours'")['result'] == 'invalid-expiry')
    check('extension_rejects_expiry_beyond_thirty_one_days', extend(pid, manifest, new_token, op, "clock_timestamp()+interval '32 days'")['result'] == 'invalid-expiry')
    check('extension_rejects_other_owner', extend(pid, manifest, new_token, op, future, owner=pay.OTHER)['result'] == 'not-found')
    check('extension_rejects_changed_manifest', extend(pid, [dict(manifest[0], sizeBytes=33)], new_token, op, future)['result'] == 'unavailable')
    check('extension_rejects_stale_storage_verification', extend(pid, manifest, new_token, op, future, verified="clock_timestamp()-interval '5 minutes'")['result'] == 'unavailable')
    check('extension_rejects_empty_reason', extend(pid, manifest, new_token, op, future, reason='')['result'] == 'invalid-input')
    check('nothing_written_by_rejected_extensions', value(f"select count(*) from public.natori_delivery_extensions where project_id={lit(pid)}") == '0')

    # A paid project that was never delivered has nothing to extend.
    undelivered = pay.project('pay04-undelivered')
    check('extension_rejects_project_without_release', extend(undelivered, manifest, new_token, op, future)['result'] == 'invalid-state')

    # The real extension.
    done = extend(pid, manifest, new_token, op, future)
    check('extension_succeeds_for_expired_unreceived_delivery', done['result'] == 'extended' and done['release_id'] == rid and done['notification_id'])
    check('original_release_evidence_unchanged', pay.release(pid) == original)
    check('extension_fact_keeps_previous_and_new_expiry_and_reason', value(
        f"select count(*)=1 and bool_and(previous_expires_at=(select expires_at from public.natori_delivery_releases where id={lit(rid)}) "
        f"and new_expires_at>clock_timestamp()+interval '9 days' and reason='Synthetic reason') from public.natori_delivery_extensions where project_id={lit(pid)}") == 't')
    check('extension_queues_one_encrypted_resend_notice', value(
        f"select count(*)=2 and count(*) filter (where payload->>'format'='natori-delivery-aes256gcm-v1')=2 from public.natori_notification_jobs "
        f"where project_id={lit(pid)} and purpose='delivery_issue_client'") == 't')
    check('old_link_stays_expired_after_extension', pay.accept(old_token, rid, manifest)['result'] == 'expired')

    # Replays.
    again = extend(pid, manifest, new_token, op, future)
    check('same_operation_replay_returns_same_notice_without_new_rows', again['result'] == 'extended' and again['notification_id'] == done['notification_id']
          and value(f"select count(*) from public.natori_delivery_extensions where project_id={lit(pid)}") == '1')
    check('same_operation_with_different_request_conflicts', extend(pid, manifest, new_token, op, future, label='different')['result'] == 'conflict')

    # Append-only and service-only.
    for statement in [f"update public.natori_delivery_extensions set reason='x' where project_id={lit(pid)}",
                      f"delete from public.natori_delivery_extensions where project_id={lit(pid)}"]:
        pay.sql(statement, role='service_role', expected='42501')
        pay.sql(statement, role=None, expected='23514')
    check('extension_rows_are_append_only_even_for_the_table_owner')
    for role in ['anon', 'authenticated']:
        pay.sql(f"select * from public.natori_delivery_extensions", role=role, expected='42501')
        pay.sql(f"select public.natori_delivery_extend_v1({lit(pay.OWNER)},{lit(pid)},{lit(op)},{lit(request_hash('x'))},{future},'x',{lit(new_token)},'[]'::jsonb,clock_timestamp(),'{{}}'::jsonb)", role=role, expected='42501')
    check('browser_roles_cannot_read_or_call_extension')
    check('service_role_has_select_insert_only_on_extensions', value(
        "select has_table_privilege('service_role','public.natori_delivery_extensions','SELECT') and has_table_privilege('service_role','public.natori_delivery_extensions','INSERT') "
        "and not has_table_privilege('service_role','public.natori_delivery_extensions','UPDATE') and not has_table_privilege('service_role','public.natori_delivery_extensions','DELETE')") == 't')

    # The extended link works exactly once; a received delivery cannot be extended.
    send_notice(done['notification_id'])
    received = pay.accept(new_token, rid, manifest)
    check('new_link_accepts_and_completes_delivery', received['result'] == 'accepted' and pay.state(pid)['status'] == 'completed')
    check('received_delivery_cannot_be_extended', extend(pid, manifest, new_token, str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay04/op-2')), future)['result'] == 'invalid-state')

    # A second extension chains from the latest expiry, not the original.
    pid2, manifest2, _, _, rid2 = pay.issued('chain', expires="clock_timestamp()+interval '2 seconds'")
    value('select 1 from pg_sleep(2.5)')
    send_notice(notice_of(pid2))
    first = extend(pid2, manifest2, hashlib.sha256(b'pay04/chain-1').hexdigest(), str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay04/chain-op-1')), "clock_timestamp()+interval '5 days'")
    check('chain_first_extension', first['result'] == 'extended')
    send_notice(first['notification_id'])
    low = extend(pid2, manifest2, hashlib.sha256(b'pay04/chain-low').hexdigest(), str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay04/chain-op-low')), "clock_timestamp()+interval '3 days'")
    check('second_extension_must_exceed_latest_extension', low['result'] == 'invalid-expiry')
    second = extend(pid2, manifest2, hashlib.sha256(b'pay04/chain-2').hexdigest(), str(uuid.uuid5(uuid.NAMESPACE_URL, 'pay04/chain-op-2')), "clock_timestamp()+interval '12 days'")
    check('second_extension_chains_from_latest_expiry', second['result'] == 'extended' and value(
        f"select count(*)=2 and bool_or(previous_expires_at=(select min(new_expires_at) from public.natori_delivery_extensions where release_id={lit(rid2)})) "
        f"from public.natori_delivery_extensions where release_id={lit(rid2)}") == 't')

    spec = importlib.util.spec_from_file_location('pay04_q01_resend', ROOT / 'scripts/natori-pay04/resend.py')
    resend = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(resend)
    resend.run(pay, send_notice, notice_of, extend_sql)

    Path(results).mkdir(parents=True, exist_ok=True)
    (Path(results) / 'checks.json').write_text(json.dumps(dict(count=len(CHECKS), checks=CHECKS)))
    (Path(results) / 'q01-sources.json').write_text(json.dumps([
        dict(path=path, sha256=hashlib.sha256((ROOT / path).read_bytes()).hexdigest())
        for path in [RESEND_MIGRATION, 'scripts/natori-pay04/resend.py', 'scripts/natori-pay04/acceptance.py']
    ]))
    print(f'{len(CHECKS)} PAY-04 native checks passed', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--container')
    parser.add_argument('--results', required=True)
    args = parser.parse_args()
    if os.environ.get('PAY04_LOCAL_PSQL'):
        cmd = json.loads(os.environ['PAY04_LOCAL_PSQL'])
    else:
        cmd = ['docker', 'exec', '-i', args.container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate',
               '-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'natori_pay01']
    main(cmd, args.results)
