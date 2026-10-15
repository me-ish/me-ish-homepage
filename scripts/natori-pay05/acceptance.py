#!/usr/bin/env python3
"""PAY-05 unresolved Stripe payment: execute the real RPC and guards on a disposable PostgreSQL."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = 'supabase/migrations/20261015100000_natori_unresolved_stripe_payment.sql'
FN = 'public.natori_record_unresolved_stripe_payment_v1'
CHECKS = []


def check(name, condition=True):
    assert condition, name
    assert name not in CHECKS, 'duplicate evidence ID'
    CHECKS.append(name)
    print('PASS ' + name, flush=True)


def load_pay01():
    spec = importlib.util.spec_from_file_location('pay05_pay01_helpers', ROOT / 'scripts/natori-pay01/acceptance.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.check = check
    return module


def main(command, results):
    pay = load_pay01()
    pay.COMMAND = command
    lit, sql, value = pay.literal, pay.sql, pay.value
    assert value("select current_database()='natori_pay01' and current_setting('listen_addresses')=''", role=None) == 't'
    sql((ROOT / 'scripts/natori-pay01/bootstrap.sql').read_text(), role=None)
    for path in pay.SOURCES + [MIGRATION]:
        sql((ROOT / path).read_text(), role=None)

    def record(pid, session, amount, reason, role='service_role'):
        amount_sql = 'null' if amount is None else str(amount)
        return value(f"select row_to_json(r)::text from {FN}({lit(pid)},{lit(session)},{amount_sql},{lit(reason)}) r", role=role)

    def state(pid):
        return value(f"select status||'|'||coalesce(payment_confirmed_at::text,'')||'|'||coalesce(paid_amount::text,'') from public.natori_projects where id={lit(pid)}")

    def rows(pid):
        return int(value(f"select count(*) from public.natori_payment_transactions where project_id={lit(pid)} and status='needs_review'"))

    def notes(pid):
        return int(value(f"select count(*) from public.natori_projects where id={lit(pid)} and note like '%要確認: 照合できない入金%'"))

    pid = pay.project('unresolved', paid=False, status='awaiting_payment')
    before = state(pid)
    first = json.loads(record(pid, 'cs_pay05_quote', 8000, 'quote_unavailable'))
    check('unresolved_payment_is_recorded_as_new_event', first == {'result': 'recorded', 'new_event': True})
    check('review_row_keeps_session_amount_reason_and_no_quote', value(
        f"select count(*)=1 and bool_and(amount=8000 and quote_id is null and note='quote_unavailable') from public.natori_payment_transactions "
        f"where stripe_session_id='cs_pay05_quote' and project_id={lit(pid)} and status='needs_review'") == 't')
    check('project_note_tells_the_administrator', notes(pid) == 1)
    check('project_state_and_payment_confirmation_are_untouched', state(pid) == before)

    again = json.loads(record(pid, 'cs_pay05_quote', 8000, 'quote_unavailable'))
    check('redelivery_is_idempotent_without_new_row_or_note', again == {'result': 'recorded', 'new_event': False}
          and rows(pid) == 1 and notes(pid) == 1)

    nullamount = json.loads(record(pid, 'cs_pay05_amount', None, 'amount_unavailable'))
    check('missing_amount_is_stored_as_zero_for_review', nullamount['new_event'] is True and value(
        "select amount from public.natori_payment_transactions where stripe_session_id='cs_pay05_amount'") == '0')
    undecided = json.loads(record(pid, 'cs_pay05_type', 5000, 'project_type_unconfirmed'))
    check('undecided_type_is_recorded', undecided['new_event'] is True and rows(pid) == 3)

    check('unknown_reason_is_rejected', json.loads(record(pid, 'cs_pay05_bad', 1, 'anything'))['result'] == 'invalid-input')
    check('negative_amount_is_rejected', json.loads(record(pid, 'cs_pay05_neg', -1, 'quote_unavailable'))['result'] == 'invalid-input')
    check('blank_session_is_rejected', json.loads(record(pid, '  ', 1, 'quote_unavailable'))['result'] == 'invalid-input')
    check('unknown_project_is_not_found', json.loads(record('00000000-0000-4000-8000-0000000000ff', 'cs_pay05_none', 1, 'quote_unavailable'))['result'] == 'not-found')
    check('rejected_calls_wrote_nothing', rows(pid) == 3)

    # A review row must not block the project from being paid through the normal, verified path.
    paid = value(f"select result from public.natori_record_stripe_payment({lit(pid)},'cs_pay05_real',null,null)")
    check('normal_payment_can_still_be_recorded_afterwards', paid in ('received', 'quote-mismatch') and rows(pid) == 3)

    for role in ['anon', 'authenticated']:
        sql(f"select * from {FN}({lit(pid)},'cs_pay05_role',1,'quote_unavailable')", role=role, expected='42501')
    check('browser_roles_cannot_call_the_recorder')
    sql(f"insert into public.natori_payment_transactions(project_id,stripe_session_id,amount,status) values({lit(pid)},'cs_pay05_bad_status',1,'whatever')",
        role=None, expected='23514')
    check('status_constraint_still_rejects_unknown_values')

    Path(results).mkdir(parents=True, exist_ok=True)
    (Path(results) / 'checks.json').write_text(json.dumps(dict(count=len(CHECKS), checks=CHECKS)))
    print(f'{len(CHECKS)} PAY-05 native checks passed', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--container')
    parser.add_argument('--results', required=True)
    args = parser.parse_args()
    if os.environ.get('PAY05_LOCAL_PSQL'):
        cmd = json.loads(os.environ['PAY05_LOCAL_PSQL'])
    else:
        cmd = ['docker', 'exec', '-i', args.container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate',
               '-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'natori_pay01']
    main(cmd, args.results)
