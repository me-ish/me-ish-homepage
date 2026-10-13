#!/usr/bin/env python3
"""Native-only ordinary transaction proof; never accepts a production endpoint."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OPS = ROOT / 'supabase/operations/pay01-recovery'
ORIGINAL_PATH = 'supabase/migrations/20261012064005_natori_pay01_completion_evidence.sql'
ORIGINAL_SHA = '2e32bbd971beaa51deec9dcc3dab639ac2aeed9cf42eb673086f8776eb8301c1'
RECOVERY_SHA = 'bcf20b05509084e4fa0027787773b93fb3527994742b1de41fe4724d4ac9e3c3'
ISSUE = 'public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)'
ACCEPT = 'public.natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamptz)'
CHECKS = []
CORE_CHECKS = []
ENV = {k:v for k,v in os.environ.items() if k in ('PATH','LANG')}
ENV.update({'PGPASSFILE':'/dev/null','PGSERVICEFILE':'/dev/null'})
DB = 'natori_combined_native'
ROLES_CREATED = False


def lit(value):
    return "'" + str(value).replace("'", "''") + "'"


def command(db=None):
    return ['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1',
            '-v','VERBOSITY=verbose','-h','/var/run/postgresql','-U','postgres','-d',db or DB]


def sql(statement, expected=None, db=None, role=None):
    prefix = f'SET ROLE {role};\n' if role else ''
    result = subprocess.run(command(db),input=prefix+statement,text=True,capture_output=True,env=ENV,timeout=35)
    if expected:
        assert result.returncode != 0 and expected in result.stderr, 'native SQL rejection did not match expected SQLSTATE'
        return result.stderr
    assert result.returncode == 0, result.stderr[:500]
    return result.stdout.strip()


def value(statement, **kwargs):
    return sql(statement, **kwargs).splitlines()[-1]


def row(statement, **kwargs):
    return json.loads(value(statement, **kwargs))


def check(name, condition=True):
    assert condition, name
    assert name not in CHECKS, 'duplicate evidence name'
    CHECKS.append(name)
    print('PASS ' + name,flush=True)


def ledger(name):
    # Synthetic history recording after the ordinary SQL COMMIT. This is not
    # a claim about a provider callback or its migration-history implementation.
    return f"insert into supabase_migrations.schema_migrations(version,name) values({lit('native-fixture-'+name)},{lit(name)});"


def tracked(source, name, expected=None):
    return sql(source + '\n' + ledger(name),expected=expected)


def history_count(name):
    return int(value(f"select count(*) from supabase_migrations.schema_migrations where name={lit(name)}"))


def catalog():
    return row("select jsonb_build_object('functions',(select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('body',md5(prosrc),'definer',prosecdef,'owner',pg_get_userbyid(proowner),'config',proconfig,'acl',proacl)) from pg_proc where oid in ("+lit(ISSUE)+'::regprocedure,'+lit(ACCEPT)+"::regprocedure,'public.natori_delivery_project_guard_v1()'::regprocedure)), 'trigger',(select jsonb_build_object('oid',oid,'type',tgtype,'enabled',tgenabled,'function',tgfoid) from pg_trigger where tgrelid='public.natori_projects'::regclass and tgname='natori_delivery_project_guard'), 'releaseAcl',(select relacl from pg_class where oid='public.natori_delivery_releases'::regclass),'history',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by name),'[]') from supabase_migrations.schema_migrations))::text")


def observe(expected=None, role=None):
    output = sql(OBSERVE,expected=expected,role=role)
    return output if expected else json.loads(output.splitlines()[-1])


def recover_if_ready():
    observation = observe()
    if observation['decision'] == 'skip-pay-already-complete':
        return 'skipped'
    assert observation['decision'] == 'ready', 'operator gate refused recovery'
    for k,v in observation['readiness'].items():
        assert not k.endswith('_pass') or v is True, 'operator readiness null/false'
    tracked(RECOVERY,'natori_pay01_completion_evidence')
    return 'recovered'


def setup(label):
    global DB,ROLES_CREATED
    DB = 'natori_pay01_recovery_' + label
    sql('create database ' + DB,db='postgres')
    bootstrap=(ROOT/'scripts/natori-wf01/bootstrap.sql').read_text()
    sql(platform_bootstrap(bootstrap) if ROLES_CREATED else bootstrap)
    ROLES_CREATED=True
    for path in combined.PREREQUISITES:
        sql((ROOT/path).read_text())
    sql((ROOT/'scripts/natori-combined-native/legacy-bootstrap.sql').read_text())
    sql("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null)")
    for path,_ in combined.FORWARD[:3]:
        name=Path(path).stem.split('_',1)[1]
        tracked((ROOT/path).read_text(),name)


def platform_bootstrap(bootstrap):
    # Roles are cluster-wide, unlike the per-case Auth/Storage stand-ins. Create
    # the exact three fixture roles once; no business migration text is changed.
    for statement in ('create role anon nologin;\n','create role authenticated nologin;\n','create role service_role nologin bypassrls;\n'):
        assert bootstrap.count(statement)==1,'platform role fixture boundary changed'
        bootstrap=bootstrap.replace(statement,'')
    return bootstrap


def held_original(label, repeatable=False, disabled=False, before_do=False):
    holder=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
    prefix=ORIGINAL_PREFIX
    if repeatable:
        prefix="set default_transaction_isolation='repeatable read';\n"+prefix
    if before_do:
        prefix=prefix[:prefix.index('do $$')]
    holder.stdin.write(prefix+"\nselect pg_advisory_xact_lock(12064005,1);\n")
    if disabled:
        holder.stdin.write('set track_activities=off;\n')
    holder.stdin.flush()
    deadline=time.monotonic()+10
    while time.monotonic()<deadline:
        if value('select pg_try_advisory_xact_lock(12064005,1)')=='f':
            # A second marker follows the optional disabled setting; the gate
            # does not infer activity completeness from a timing-based sleep.
            holder.stdin.write('select pg_advisory_xact_lock(12064005,2);\n')
            holder.stdin.flush()
            while time.monotonic()<deadline:
                if value('select pg_try_advisory_xact_lock(12064005,2)')=='f':
                    return holder
                assert holder.poll() is None,'native held transaction exited'
            break
        assert holder.poll() is None,'native held transaction exited'
        time.sleep(.02)
    raise AssertionError('native held transaction rendezvous missing')


def release(holder, suffix='rollback;\n'):
    holder.stdin.write(suffix)
    holder.stdin.flush()
    holder.stdin.close()
    assert holder.wait(timeout=15)==0,'native fixture transaction failed on release'


def main():
    check('dedicated_pinned_postgresql_17_11_no_tcp',value("select current_setting('listen_addresses')='' and current_setting('server_version_num')='170011' and current_setting('max_prepared_transactions')='0'",db='postgres')=='t')

    # 1. Old original passed its DO, but has not reached a later DDL statement.
    setup('passed_do')
    held=held_original('passed_do')
    try:
        tracked(FENCE,'natori_pay01_recovery_fence')
        after_fence=catalog()
        observe(expected='55000')
        check('old_do_passed_open_transaction_blocks_recovery',catalog()==after_fence and history_count('natori_pay01_completion_evidence')==0)
    finally:
        release(held)
    check('abort_old_do_then_fresh_recovery_succeeds',recover_if_ready()=='recovered' and history_count('natori_pay01_recovery_fence')==1 and history_count('natori_pay01_completion_evidence')==1)

    # 2. The old request can finish after its DO and after the separate fence.
    setup('old_completes')
    held=held_original('old_completes')
    tracked(FENCE,'natori_pay01_recovery_fence')
    release(held,ORIGINAL_SUFFIX+'\n'+ledger('natori_pay01_completion_evidence')+'\n')
    before=catalog()
    check('old_original_completion_is_verified_and_recovery_skipped',recover_if_ready()=='skipped' and catalog()==before)

    # 3. A request whose DO starts after the fence rejects and records no history.
    setup('late_original')
    tracked(FENCE,'natori_pay01_recovery_fence')
    before=catalog()
    tracked(ORIGINAL,'natori_pay01_completion_evidence',expected='P0001')
    check('late_original_after_fence_fails_closed_and_has_no_changes_or_history',catalog()==before and history_count('natori_pay01_completion_evidence')==0)

    # 4. An old Repeatable Read snapshot remains an open transaction. The root
    # observation rejects it; draining it permits only the new recovery payload.
    setup('repeatable')
    held=held_original('repeatable',repeatable=True)
    try:
        tracked(FENCE,'natori_pay01_recovery_fence')
        before=catalog()
        observe(expected='55000')
        check('old_repeatable_read_snapshot_blocks_recovery',catalog()==before)
    finally:
        release(held)
    check('drained_repeatable_read_then_recovery_succeeds',recover_if_ready()=='recovered')

    # 5. Staged failure and privilege drift must roll back, including trigger
    # replacement. These fixture faults never alter the proposed payload files.
    setup('rollback')
    before=catalog()
    sql("grant execute on function "+ACCEPT+' to authenticated')
    drift=catalog()
    tracked(FENCE,'natori_pay01_recovery_fence',expected='P0001')
    check('fence_acl_drift_rolls_back_without_a_history_record',catalog()==drift)
    sql('revoke execute on function '+ACCEPT+' from authenticated')
    sql("create function public.native_fail_first_fence() returns event_trigger language plpgsql as $$ begin if TG_TAG='ALTER FUNCTION' and (select prosecdef from pg_proc where oid="+lit(ISSUE)+"::regprocedure) and not (select prosecdef from pg_proc where oid="+lit(ACCEPT)+"::regprocedure) then raise exception 'native staged fault' using errcode='P0001'; end if; end $$; create event trigger native_fail_first_fence on ddl_command_end when tag in ('ALTER FUNCTION') execute function public.native_fail_first_fence();")
    staged=catalog()
    tracked(FENCE,'natori_pay01_recovery_fence',expected='P0001')
    check('fence_failure_after_first_alter_rolls_back_both_rpcs_and_history',catalog()==staged)
    sql('drop event trigger native_fail_first_fence; drop function public.native_fail_first_fence()')
    tracked(FENCE,'natori_pay01_recovery_fence')
    # Use an existing built-in role in this synthetic database only. The
    # production SQL does not grant roles or change ownership.
    sql('grant update(accepted_at) on public.natori_delivery_releases to pg_read_all_stats; grant pg_read_all_stats to service_role')
    drift=catalog()
    tracked(RECOVERY,'natori_pay01_completion_evidence',expected='P0001')
    check('recovery_inherited_acl_failure_rolls_back_body_trigger_and_history',catalog()==drift)
    sql('revoke pg_read_all_stats from service_role; revoke update(accepted_at) on public.natori_delivery_releases from pg_read_all_stats')
    trigger_before=catalog()['trigger']['oid']
    check('recovery_after_removed_synthetic_acl_drift_succeeds',recover_if_ready()=='recovered')
    trigger=catalog()['trigger']
    check('create_or_replace_keeps_trigger_oid_and_sets_before_insert_update_enabled',trigger['oid']==trigger_before and trigger['type']==23 and trigger['enabled']=='O')
    # INSERT and UPDATE both fire the exact approved guard function body.
    sql("set role service_role; insert into public.natori_projects(user_id,title,client_name,type,status,due_date,delivery_accepted_at) values('00000000-0000-4000-8000-000000000001','synthetic','synthetic','illustration','completed','2027-01-01',clock_timestamp())",expected='23514')
    pid=value("insert into public.natori_projects(user_id,title,client_name,type,status,due_date) values('00000000-0000-4000-8000-000000000001','synthetic','synthetic','illustration','delivery_prep','2027-01-01') returning id")
    sql('set role service_role; update public.natori_projects set completed_at=clock_timestamp() where id='+lit(pid),expected='23514')
    check('replacement_trigger_native_insert_and_update_guard_fire')

    # Required metadata completeness regression: disabled activity is unknown,
    # even if PostgreSQL does not show the old transaction's xact_start.
    setup('disabled')
    held=held_original('disabled',disabled=True)
    try:
        tracked(FENCE,'natori_pay01_recovery_fence')
        before=catalog()
        observe(expected='55000')
        check('disabled_old_activity_session_blocks_recovery',catalog()==before)
    finally:
        release(held)
    observe(expected='55000',role='service_role')
    check('observer_without_read_all_stats_usage_cannot_report_ready')

    # 6. The observer's first DO statement has begun and is waiting before
    # activity sampling. Commit old PAY in that actual observation window.
    # Instrument one barrier in an in-memory copy only; payload bytes stay fixed.
    setup('observation_boundary')
    held=held_original('observation_boundary')
    tracked(FENCE,'natori_pay01_recovery_fence')
    marker="  PERFORM pg_catalog.pg_stat_clear_snapshot();\n"
    instrumentation="  PERFORM pg_catalog.pg_advisory_xact_lock(12064005,3);\n"
    assert OBSERVE.count(marker)==1
    instrumented=OBSERVE.replace(marker,instrumentation+marker)
    assert instrumented.count(instrumentation)==1 and instrumented.replace(instrumentation,'')==OBSERVE
    barrier=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
    barrier.stdin.write('select pg_advisory_lock(12064005,3);\n')
    barrier.stdin.flush()
    deadline=time.monotonic()+10
    while time.monotonic()<deadline:
        if value('select pg_try_advisory_xact_lock(12064005,3)')=='f':
            break
        time.sleep(.02)
    else:
        raise AssertionError('native session advisory barrier missing')
    boundary=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
    try:
        boundary.stdin.write("set application_name='pay01_recovery_observer_boundary';\n"+instrumented)
        boundary.stdin.close()
        deadline=time.monotonic()+10
        waiting=0
        while time.monotonic()<deadline:
            waiting=int(value("select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='pay01_recovery_observer_boundary' and l.locktype='advisory' and l.classid=12064005 and l.objid=3 and not l.granted"))
            if waiting==1:
                break
            assert boundary.poll() is None,'observer exited before activity barrier'
            time.sleep(.02)
        assert waiting==1,'first observer DO must wait before its activity aggregate'
        check('observer_do_is_running_and_blocked_before_activity_sampling')
        release(held,ORIGINAL_SUFFIX+'\n'+ledger('natori_pay01_completion_evidence')+'\n')
        release(barrier,'select pg_advisory_unlock(12064005,3);\n')
        assert boundary.wait(timeout=20)==0,'fresh boundary observation failed'
        observation=json.loads(boundary.stdout.read().strip().splitlines()[-1])
        check('old_pay_commit_during_observer_do_before_stats_classifies_skip_not_ready',observation['decision']=='skip-pay-already-complete' and history_count('natori_pay01_completion_evidence')==1 and observation['guard'][0]['body_md5']=='5669d0837ba50a7f5a31de9b08208d22')
        check('boundary_test_instrumentation_does_not_change_observer_payload',hashlib.sha256((OPS/'observe.sql').read_bytes()).hexdigest()==payloads['observe.sql']['sha256'])
    finally:
        if not held.stdin.closed:
            release(held)
        if not barrier.stdin.closed:
            release(barrier,'select pg_advisory_unlock(12064005,3);\n')
        if boundary.poll() is None:
            boundary.wait(timeout=20)

    # Final proof reuses the exact existing combined helper and all its business,
    # ACL/runtime/evidence assertions. Only its last forward payload is routed to
    # fence + newly attested recovery; its original raw descriptor is renamed.
    global DB
    DB='natori_combined_native'
    sql('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null)')
    combined.COMMAND=command()
    original_sql=combined.sql
    def final_check(name,condition=True):
        assert condition,name
        # Never claim that the modified recovery bytes are original raw PAY.
        if name=='exact_raw_forward_pay01_guards_and_transaction_pass':
            name='new_attested_recovery_forward_pay01_guards_and_transaction_pass'
        CORE_CHECKS.append(name)
        check('combined54_'+name,condition)
    def final_sql(statement,role='service_role',expected=None):
        if statement==ORIGINAL:
            tracked(FENCE,'natori_pay01_recovery_fence')
            assert recover_if_ready()=='recovered'
            return ''
        if statement==(ROOT/'scripts/natori-wf01/bootstrap.sql').read_text():
            statement=platform_bootstrap(statement)
        output=original_sql(statement,role,expected)
        for path,_ in combined.FORWARD[:3]:
            if statement==(ROOT/path).read_text():
                sql(ledger(Path(path).stem.split('_',1)[1]))
        return output
    combined.check=final_check
    combined.sql=final_sql
    combined.main()
    check('all_54_existing_combined_contract_assertions_pass_with_new_payload_attestation',len(CORE_CHECKS)==54)
    check('final_history_has_three_original_forward_names_fence_and_one_recovered_pay',history_count('natori_pay01_completion_evidence')==1 and history_count('natori_pay01_recovery_fence')==1 and value('select count(*) from supabase_migrations.schema_migrations')=='5')
    check('final_observation_verifies_complete_and_refuses_duplicate_recovery',observe()['decision']=='skip-pay-already-complete')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--container',required=True)
    parser.add_argument('--results',required=True)
    args=parser.parse_args()
    assert re.fullmatch(r'natori-pay01-recovery-[0-9]+-[0-9]+',args.container)
    CONTAINER=args.container
    RESULTS=Path(args.results)
    assert RESULTS.is_dir() and '/natori-pay01-recovery.' in str(RESULTS)
    spec=importlib.util.spec_from_file_location('original_combined_helper',ROOT/'scripts/natori-combined-native/acceptance.py')
    combined=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(combined)
    ORIGINAL=(ROOT/ORIGINAL_PATH).read_text()
    assert hashlib.sha256(ORIGINAL.encode()).hexdigest()==ORIGINAL_SHA
    marker='-- A writable evidence row would let a generic service UPDATE manufacture acceptance.'
    ORIGINAL_PREFIX,ORIGINAL_SUFFIX=ORIGINAL.split(marker,1)
    ORIGINAL_SUFFIX=marker+ORIGINAL_SUFFIX
    FENCE=(OPS/'fence.sql').read_text()
    OBSERVE=(OPS/'observe.sql').read_text()
    RECOVERY=(OPS/'recovery.sql').read_text()
    assert hashlib.sha256(RECOVERY.encode()).hexdigest()==RECOVERY_SHA
    expected=ORIGINAL.replace('and not f.prosecdef','and f.prosecdef').replace('drop trigger natori_delivery_project_guard on public.natori_projects;\ncreate trigger natori_delivery_project_guard before insert or update on public.natori_projects','create or replace trigger natori_delivery_project_guard before insert or update on public.natori_projects')
    assert ORIGINAL.count('and not f.prosecdef')==2 and RECOVERY==expected,'unreviewed recovery edits'
    manifest=json.loads((ROOT/'supabase/baseline/manifest.json').read_text())
    for path,expected_hash in combined.FORWARD:
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==expected_hash
    for path in combined.PREREQUISITES:
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==manifest['checksums']['sha256:'+path]
    payloads=json.loads((OPS/'payload-sha256.json').read_text())
    for name,data in payloads.items():
        b=(OPS/name).read_bytes()
        assert len(b)==data['bytes'] and hashlib.sha256(b).hexdigest()==data['sha256']
    sources=combined.PREREQUISITES+[p for p,_ in combined.FORWARD]+[
        'scripts/natori-combined-native/acceptance.py','scripts/natori-combined-native/legacy-bootstrap.sql',
        'scripts/natori-pay01/acceptance.py','scripts/natori-wf01/acceptance.py','scripts/natori-wf01/bootstrap.sql',
        'scripts/natori-pay01-recovery/acceptance.py','scripts/natori-pay01-recovery/run.sh',
        '.github/workflows/natori-pay01-recovery.yml','supabase/operations/pay01-recovery/fence.sql',
        'supabase/operations/pay01-recovery/recovery.sql','supabase/operations/pay01-recovery/observe.sql']
    (RESULTS/'source-sha256.json').write_text(json.dumps({p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},indent=2)+'\n')
    outcome='failed'
    try:
        main()
        outcome='passed'
    finally:
        (RESULTS/'acceptance.json').write_text(json.dumps({'status':outcome,'engine':'native-postgresql-17.11',
            'ordinaryTransactionsOnly':True,'providerCallbackBehaviorClaimed':False,
            'productionOperations':False,'count':len(CHECKS),'checks':CHECKS,
            'combinedContractCount':len(CORE_CHECKS),'combinedContractChecks':CORE_CHECKS,
            'rawOriginalSha256':ORIGINAL_SHA,'newRecoverySha256':RECOVERY_SHA,
            'fixtureHistory':'synthetic append after ordinary SQL COMMIT; names/counts only'},indent=2)+'\n')
