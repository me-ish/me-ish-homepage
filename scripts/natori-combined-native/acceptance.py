#!/usr/bin/env python3
"""Supplemental exact-four-schema proof; original PAY01/WF01 suites stay unchanged."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
PREREQUISITES = [
    'supabase/migrations/20260723111730_etorie_baseline.sql',
    'supabase/migrations/20260723111741_baseline_security_hardening.sql',
    'supabase/migrations/20260729115313_etorie_phase1_expand.sql',
    'supabase/migrations/20260731115652_etorie_intake_rpcs.sql',
    'supabase/migrations/20260908124222_etorie_publication_allowed_from_validator_fix.sql',
    'supabase/migrations/20260806120330_natori_accept_delivery_rpc.sql',
    'supabase/migrations/20260927073530_natori_acceptance_notifications.sql',
    'supabase/migrations/20260930101753_natori_delivery_integrity.sql',
    'supabase/migrations/20261001150445_natori_payment_event_inbox.sql',
    'supabase/migrations/20261001221938_natori_refund_ledger.sql',
    'supabase/migrations/20261001222233_natori_intake_operations.sql',
    'supabase/migrations/20261001223805_natori_task_integrity.sql',
    'supabase/migrations/20260923033156_natori_consultation_messages.sql',
    'supabase/migrations/20260923033205_natori_consultation_files.sql',
    'supabase/migrations/20260923033212_natori_consultation_link_renewal.sql',
    'supabase/migrations/20260927102757_natori_consultation_overview.sql',
    'supabase/migrations/20261001225106_natori_consultation_operations.sql',
    'supabase/migrations/20261011140000_natori_talk_roughs.sql',
]
# Explicit held rollout order, not filename order. Exact approved raw bytes.
FORWARD = [
    ('supabase/migrations/20261012013126_secure_natori_portfolio_assets.sql', '56c90f27e56150cb9909c3456d6b8f7f59226949bfab78bf7cf898c3677c57c1'),
    ('supabase/migrations/20261012085748_natori_rough_ok_followup.sql', 'e54f41607ad0241dd4ee66c89d4097a2f38172d762323637e4135ab757db6c97'),
    ('supabase/migrations/20261011221028_lockdown_legacy_entries_reads.sql', 'bd4226784fc86e9b6f2bb7708f6895c15a9f5720fa344b587c9cfe15f15547ae'),
    ('supabase/migrations/20261012064005_natori_pay01_completion_evidence.sql', '2e32bbd971beaa51deec9dcc3dab639ac2aeed9cf42eb673086f8776eb8301c1'),
]
CHECKS = []
LIFECYCLE = ['natori_notification_immutable_v1','natori_notification_claim_v1','natori_notification_start_v1',
             'natori_notification_finish_v1','natori_notification_retry_v1','natori_notification_list_v1']
ROUGH = ['natori_record_rough_ok_v1','natori_acknowledge_rough_ok_v1','natori_rough_ok_list_v1',
         'natori_retry_rough_ok_notification_v1','natori_consultation_overview_v2',
         'natori_rough_ok_fact_guard_v1','natori_rough_ok_insert_guard_v1','natori_rough_ok_ack_binding_v1','natori_rough_ok_enqueue_v1']
PORTFOLIO = ['sec01_portfolio_revision','natori_save_portfolio_content']
PURPOSES = ['quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client',
            'quote_issue_client','payment_received_artist','payment_received_client','payment_review_artist',
            'payment_link_client','refund_confirmed_artist','refund_review_artist','intake_artist','intake_client',
            'consultation_staff','consultation_client','rough_ok_artist']
ENV = {k: v for k, v in os.environ.items() if k in ('PATH','LANG','LD_LIBRARY_PATH')}
ENV.update({'PGPASSFILE':'/dev/null','PGSERVICEFILE':'/dev/null'})


def lit(value):
    return 'null' if value is None else "'"+str(value).replace("'","''")+"'"


def sql(statement, role='service_role', expected=None):
    result = subprocess.run(COMMAND,input=(f'SET ROLE {role};\n' if role else '')+statement,
                            capture_output=True,text=True,env=ENV,timeout=25)
    if expected:
        assert result.returncode != 0 and expected in result.stderr, 'unexpected combined SQL rejection'
        return None
    assert result.returncode == 0, result.stderr[:400]
    return result.stdout.strip()


def value(statement,role='service_role'):
    return sql(statement,role).splitlines()[-1]


def row(statement,role='service_role'):
    return json.loads(value(statement,role))


def check(name,condition=True):
    assert condition,name
    assert name not in CHECKS,'duplicate combined evidence ID'
    CHECKS.append(name)
    print('PASS '+name,flush=True)


def load_helpers(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.COMMAND=COMMAND
    module.check=check
    return module


def function_state(names):
    return row("select jsonb_object_agg(f.oid::regprocedure::text,jsonb_build_object('body',md5(f.prosrc),'definer',f.prosecdef,'owner',o.rolname,'config',f.proconfig,'service',has_function_privilege('service_role',f.oid,'EXECUTE'),'anon',has_function_privilege('anon',f.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',f.oid,'EXECUTE')))::text from pg_proc f join pg_roles o on o.oid=f.proowner where f.pronamespace='public'::regnamespace and f.proname in ("+','.join(lit(n) for n in names)+')',None)


def entry_read(role,owner=None,email=None):
    return row(f"set request.jwt.claim.sub={lit(owner or '')}; set request.jwt.claim.email={lit(email or '')}; select coalesce(jsonb_agg(id order by id),'[]')::text from public.entries",role)


def assert_core_catalog(lifecycle,rough,portfolio,issue_accept):
    check('notification_lifecycle_exact_latest_bodies_and_acl_preserved',function_state(LIFECYCLE)==lifecycle)
    check('wf01_function_bodies_invoker_runtime_and_acl_survive_db01_pay01',function_state(ROUGH)==rough and len(rough)==9 and all(not f['definer'] and not f['anon'] and not f['authenticated'] and f['config']==['search_path=""'] for f in rough.values()))
    check('sec01_function_bodies_invoker_and_acl_survive_other_forward_sql',function_state(PORTFOLIO)==portfolio and len(portfolio)==2 and all(not f['definer'] and f['service'] and not f['anon'] and not f['authenticated'] for f in portfolio.values()))
    final=function_state(['natori_delivery_issue_v1','natori_accept_delivery_ready_v1'])
    check('pay01_issue_accept_exact_body_postgres_definer_empty_path_service_only',len(final)==2 and all(f['body']==issue_accept[sig]['body'] and f['definer'] and f['owner']=='postgres' and f['config']==['search_path=""'] and f['service'] and not f['anon'] and not f['authenticated'] for sig,f in final.items()))
    tables=['natori_projects','natori_project_tasks','natori_portfolio_assets','natori_portfolio_content',
            'natori_notification_jobs','natori_talk_roughs','natori_rough_ok_events','natori_rough_ok_acknowledgements',
            'natori_delivery_releases','entries']
    check('final_all_target_tables_and_storage_keep_rls',value("select count(*)=11 and bool_and(relrowsecurity) from pg_class where oid in ("+','.join(lit('public.'+t)+'::regclass' for t in tables)+",'storage.objects'::regclass)",None)=='t')
    for table in tables[2:9]:
        check('final_'+table+'_browser_privileges_denied',value(f"select not has_any_column_privilege('anon','public.{table}','SELECT,INSERT,UPDATE') and not has_any_column_privilege('authenticated','public.{table}','SELECT,INSERT,UPDATE') and not has_table_privilege('anon','public.{table}','DELETE,TRUNCATE') and not has_table_privilege('authenticated','public.{table}','DELETE,TRUNCATE')",None)=='t')
    check('pay01_release_service_select_only',value("select has_table_privilege('service_role','public.natori_delivery_releases','SELECT') and not has_any_column_privilege('service_role','public.natori_delivery_releases','INSERT,UPDATE') and not has_table_privilege('service_role','public.natori_delivery_releases','DELETE')",None)=='t')
    check('wf01_fact_tables_service_append_only',value("select bool_and(has_table_privilege('service_role',rel,'SELECT') and has_table_privilege('service_role',rel,'INSERT') and not has_any_column_privilege('service_role',rel,'UPDATE') and not has_table_privilege('service_role',rel,'DELETE')) from unnest(array['public.natori_rough_ok_events'::regclass,'public.natori_rough_ok_acknowledgements'::regclass]) rel",None)=='t')
    check('final_four_relevant_guards_are_enabled',value("select count(*)=4 and bool_and(tgenabled='O') from pg_trigger where not tgisinternal and tgname in ('trg_sec01_portfolio_revision','natori_rough_ok_enqueue','natori_talk_roughs_guard','natori_delivery_project_guard')",None)=='t')
    expression=value("select pg_get_expr(conbin,conrelid) from pg_constraint where conrelid='public.natori_notification_jobs'::regclass and conname='natori_notification_jobs_purpose_check' and convalidated",None)
    for purpose in PURPOSES:
        assert value('select ('+expression+') from (select '+lit(purpose)+'::text purpose) fixture',None)=='t','installed purpose lost'
    check('all_sixteen_actual_phase3b_and_rough_purposes_retained_after_four_sql')


def main():
    check('dedicated_socket_only_native_postgresql_17_11',value("select current_database()='natori_combined_native' and current_setting('listen_addresses')='' and current_setting('server_version_num')='170011'",None)=='t')
    sql((ROOT/'scripts/natori-wf01/bootstrap.sql').read_text(),None)
    for path in PREREQUISITES:
        sql((ROOT/path).read_text(),None)
    sql((ROOT/'scripts/natori-combined-native/legacy-bootstrap.sql').read_text(),None)
    pay=load_helpers('combined_pay01_helpers','scripts/natori-pay01/acceptance.py')
    wf=load_helpers('combined_wf01_helpers','scripts/natori-wf01/acceptance.py')
    check('legacy_fixture_before_db01_anon_can_read_broad_public_rows',entry_read('anon')==[1,2,3,4])
    entries_before=row('select jsonb_agg(to_jsonb(e) order by id)::text from public.entries e')
    legacy_pid,legacy_token=wf.project('combined-historical')
    legacy_rid,_=wf.rough(legacy_pid,'combined-historical')
    wf.sql(f"update public.natori_talk_roughs set client_ok_at='2024-01-03T09:00:00Z' where id={lit(legacy_rid)}")
    legacy_fact=wf.stored_ok(legacy_rid)
    lifecycle=function_state(LIFECYCLE)
    issue_accept=function_state(['natori_delivery_issue_v1','natori_accept_delivery_ready_v1'])
    check('foundation_uses_actual_latest_delivery_and_notification_bodies',len(lifecycle)==6 and lifecycle['natori_notification_immutable_v1()']['body']=='a83c1b07e264cf2f1d05cd75dbd85bf9' and lifecycle['natori_notification_finish_v1(uuid,uuid,text,text,text)']['body']=='09e6228c0424e9f5a06a22376eba1d6d' and value(f"select md5(prosrc) from pg_proc where oid={lit(pay.ISSUE)}::regprocedure",None)=='961f11c3c1b6d06ff8a6a797ca72f5a9' and value(f"select md5(prosrc) from pg_proc where oid={lit(pay.ACCEPT)}::regprocedure",None)=='e9ae3bbe50e0772c7c07355f234b053c')
    portfolio=None
    rough=None
    for index,(path,_) in enumerate(FORWARD):
        sql((ROOT/path).read_text(),None)
        check('exact_raw_forward_'+['sec01','wf01','db01','pay01'][index]+'_guards_and_transaction_pass')
        if index==0:portfolio=function_state(PORTFOLIO)
        if index==1:rough=function_state(ROUGH)
    assert_core_catalog(lifecycle,rough,portfolio,issue_accept)
    check('four_schema_migrations_do_not_rewrite_legacy_entries',row('select jsonb_agg(to_jsonb(e) order by id)::text from public.entries e')==entries_before)
    check('historical_rough_ok_not_backfilled_enqueued_or_retimestamped',wf.stored_ok(legacy_rid)==legacy_fact and wf.counts(legacy_rid)==[0,0] and wf.overview(legacy_pid)[0]['rough_ok_pending']==1 and wf.retry(legacy_pid,legacy_rid)=='none')
    sql('select id,email,reject_reason,plan_payment_session_id from public.entries','anon','42501')
    check('db01_anon_table_and_column_reads_denied_after_all_four')
    check('db01_authenticated_linked_id_and_unlinked_email_only',entry_read('authenticated',wf.OWNER,'owner@combined.invalid')==[1,3])
    check('db01_other_authenticated_owner_retains_own_rows',entry_read('authenticated',wf.OTHER,'other@combined.invalid')==[2,4])
    check('db01_service_keeps_all_synthetic_legacy_rows',entry_read('service_role')==[1,2,3,4])
    check('db01_final_anon_column_grants_removed_owner_and_server_select_retained',value("select not has_any_column_privilege('anon','public.entries','SELECT') and has_table_privilege('authenticated','public.entries','SELECT') and has_table_privilege('service_role','public.entries','SELECT')",None)=='t')

    # SEC01's actual restrictive Storage policy intersects the synthetic broad allow.
    for key,bucket in [('public-object','natori-portfolio'),('private-object','natori-management-assets')]:
        oid=str(uuid.uuid5(uuid.NAMESPACE_URL,'combined/'+key))
        sql(f"insert into storage.objects(id,bucket_id,name) values({lit(oid)},{lit(bucket)},'synthetic')")
    for role in ['anon','authenticated']:
        check('sec01_'+role+'_storage_private_bucket_hidden_legacy_scope_retained',row('select jsonb_agg(bucket_id order by bucket_id)::text from storage.objects',role)==['natori-portfolio'])
    check('sec01_private_bucket_exact_configuration_survives_other_migrations',value("select not public and file_size_limit=50000000 and allowed_mime_types=array['image/webp','video/mp4']::text[] from storage.buckets where id='natori-management-assets'",None)=='t')
    saved=value("select saved_revision from public.natori_save_portfolio_content(0,'{\"commissionOpen\":true}'::jsonb)")
    check('sec01_revision_save_and_conflict_work_after_db01_pay01',saved=='1' and value("select count(*) from public.natori_save_portfolio_content(0,'{}'::jsonb)")=='0' and value("select saved_revision from public.natori_save_portfolio_content(1,'{\"commissionOpen\":true}'::jsonb)")=='2')

    # The same project crosses rough/customer-OK/notify/owner-ack/formal delivery.
    pid,token=wf.project('combined-current')
    rid,_=wf.rough(pid,'combined-current')
    before=wf.facts(pid)
    accepted=wf.ok(pid,rid,token)
    check('combined_rough_ok_event_and_job_atomic_and_project_unchanged',accepted['result']=='ok' and wf.counts(rid)==[1,1] and wf.facts(pid)==before)
    nid=accepted['notification_ids'][0]
    wf.finish_notice(nid,'sent','combined_rough')
    check('combined_rough_provider_receipt_does_not_ack_business_followup',wf.listed(pid)[0]['notification_status']=='sent' and wf.overview(pid)[0]['rough_ok_pending']==1)
    sql(f"update public.natori_projects set payment_confirmed_at={lit(pay.HISTORICAL)},paid_at={lit(pay.HISTORICAL)},paid_amount=1000 where id={lit(pid)}")
    sql(f"insert into public.natori_project_tasks(project_id,task_key,label,stage,done,sort_order) values({lit(pid)},'combined-rough','Synthetic rough task','rough',false,0)")
    task=row(f"select public.natori_update_task_v1({lit(wf.OWNER)},{lit(pid)},'combined-rough',true)")
    check('combined_actual_task_writer_advances_production_without_formal_completion_or_rough_ack',task['result']=='applied' and pay.state(pid)['status']=='delivery_prep' and pay.state(pid)['completed_at'] is None and pay.state(pid)['delivery_accepted_at'] is None and wf.overview(pid)[0]['rough_ok_pending']==1)
    manifest=pay.file(pid)
    delivery_token=hashlib.sha256(('combined-delivery/'+pid).encode()).hexdigest()
    operation=str(uuid.uuid5(uuid.NAMESPACE_URL,'combined-delivery-operation/'+pid))
    issued=row(pay.issue_sql(pid,manifest,delivery_token,operation))
    release_id=issued['release_id']
    check('combined_formal_issue_atomic_release_access_notice_after_rough_ok',issued['result']=='issued' and pay.state(pid)['status']=='delivered' and value(f"select count(*) from public.natori_delivery_operations where project_id={lit(pid)}")=='1' and value(f"select count(*) from public.natori_notification_jobs where project_id={lit(pid)} and purpose='delivery_issue_client'")=='1')
    check('combined_formal_publication_does_not_ack_rough',wf.overview(pid)[0]['rough_ok_pending']==1)
    sql(f"update public.natori_delivery_releases set accepted_at=clock_timestamp() where id={lit(release_id)}",expected='42501')
    sql(f"update public.natori_projects set completed_at=clock_timestamp(),status='completed' where id={lit(pid)}",expected='23514')
    check('combined_service_release_forgery_and_generic_completion_denied')
    wrong=pay.accept(delivery_token,release_id,manifest[:-1])
    check('combined_stale_formal_manifest_denied',wrong['result']=='unavailable')
    complete=pay.accept(delivery_token,release_id,manifest)
    state=pay.state(pid)
    check('combined_formal_acceptance_atomic_matching_evidence_and_two_notices',complete['result']=='accepted' and state['status']=='completed' and state['completed_at']==state['delivery_accepted_at']==pay.release(pid)['accepted_at'] and pay.notice_count(pid,True)==2)
    check('combined_formal_acceptance_replay_once',pay.accept(delivery_token,release_id,manifest)['result']=='already-accepted' and pay.notice_count(pid,True)==2)
    check('combined_customer_formal_acceptance_does_not_clear_rough_followup',wf.overview(pid)[0]['rough_ok_pending']==1)
    after=pay.state(pid)
    undo=row(f"select public.natori_update_task_v1({lit(wf.OWNER)},{lit(pid)},'combined-rough',false)")
    check('combined_task_undo_after_formal_acceptance_denied_without_fact_changes',undo['result']=='conflict' and pay.state(pid)==after and value(f"select done from public.natori_project_tasks where project_id={lit(pid)} and task_key='combined-rough'")=='t')
    acknowledged=wf.ack(pid,rid)
    check('combined_explicit_specific_rough_ack_clears_pending_preserves_formal_facts',acknowledged['result']=='acknowledged' and wf.overview(pid)[0]['rough_ok_pending']==0 and pay.state(pid)==after)
    check('combined_rough_ok_and_ack_replay_keep_same_evidence',wf.ok(pid,rid,token)['result']=='already_ok' and wf.ack(pid,rid)['result']=='already_acknowledged' and wf.counts(rid)==[1,1])
    sql(f"update public.natori_projects set title='Combined metadata',note='Synthetic metadata' where id={lit(pid)}")
    check('combined_ordinary_metadata_writer_preserves_accepted_dates',pay.state(pid)['completed_at']==state['completed_at'] and pay.state(pid)['delivery_accepted_at']==state['delivery_accepted_at'])
    for role in ['anon','authenticated']:
        sql(pay.accept_sql(delivery_token,release_id,manifest),role,'42501')
        sql(wf.ok_sql(pid,rid,token),role,'42501')
        sql(wf.ack_sql(pid,rid),role,'42501')
        sql("select * from public.natori_save_portfolio_content(2,'{}'::jsonb)",role,'42501')
        check('combined_'+role+'_formal_rough_ack_portfolio_rpc_execution_denied')
    assert_core_catalog_final=function_state(LIFECYCLE)
    check('combined_business_operations_leave_notification_lifecycle_bodies_unchanged',assert_core_catalog_final==lifecycle)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--container',required=True)
    parser.add_argument('--results',required=True)
    args=parser.parse_args()
    assert args.container.startswith('natori-combined-native-')
    results=Path(args.results)
    assert results.is_dir() and '/natori-combined-native.' in str(results)
    COMMAND=['docker','exec','-i',args.container,'psql','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-qAt','-h','/var/run/postgresql','-U','postgres','-d','natori_combined_native']
    manifest=json.loads((ROOT/'supabase/baseline/manifest.json').read_text())
    for path,expected in FORWARD:
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==expected,'approved forward SQL bytes changed'
        assert manifest['checksums']['sha256:'+path]==expected,'forward manifest pin changed'
    for path in PREREQUISITES:
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==manifest['checksums']['sha256:'+path],'named prerequisite bytes differ from manifest'
    sources=PREREQUISITES+[p for p,_ in FORWARD]+['supabase/baseline/manifest.json','scripts/natori-pay01/acceptance.py','scripts/natori-wf01/acceptance.py','scripts/natori-wf01/bootstrap.sql','scripts/natori-combined-native/acceptance.py','scripts/natori-combined-native/legacy-bootstrap.sql','scripts/natori-combined-native/run.sh','.github/workflows/natori-combined-native.yml']
    (results/'source-sha256.json').write_text(json.dumps({p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},indent=2)+'\n')
    (results/'sql-application-order.json').write_text(json.dumps({'namedPrerequisites':PREREQUISITES,'heldForwardOrder':[p for p,_ in FORWARD]},indent=2)+'\n')
    outcome='failed'
    try:
        main()
        outcome='passed'
    finally:
        (results/'combined-native-checks.json').write_text(json.dumps({'outcome':outcome,'checkCount':len(CHECKS),'checks':CHECKS,'scope':'supplemental exact four forward migrations and combined SQL boundaries; original PAY01/WF01 suites remain separate','database':'disposable socket-only PostgreSQL 17.11','provider':'none'},indent=2)+'\n')
