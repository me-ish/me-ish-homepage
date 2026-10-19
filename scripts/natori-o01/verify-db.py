#!/usr/bin/env python3
"""Actual O01/PAY-03 contracts on a no-network disposable PostgreSQL; synthetic data only."""
import argparse, concurrent.futures, hashlib, importlib.util, json, os, subprocess, sys, uuid
from pathlib import Path
sys.dont_write_bytecode = True
ROOT=Path(__file__).resolve().parents[2]
MIGRATION='supabase/migrations/20261019101057_natori_payment_stop_recovery.sql'
CHECKS=[]
def check(name,value):
    assert value,name
    CHECKS.append(name);print('PASS '+name,flush=True)
def main(container,results):
    spec=importlib.util.spec_from_file_location('o01_helpers',ROOT/'scripts/natori-pay01/acceptance.py');pay=importlib.util.module_from_spec(spec);spec.loader.exec_module(pay)
    pay.COMMAND=['docker','exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-h','/var/run/postgresql','-U','postgres','-d','natori_pay01']
    sql,value,lit,js=pay.sql,pay.value,pay.literal,pay.js
    check('isolated_database',value("select current_database()='natori_pay01' and current_setting('listen_addresses')=''",role=None)=='t')
    sql((ROOT/'scripts/natori-pay01/bootstrap.sql').read_text(),role=None)
    sources=pay.SOURCES+['supabase/migrations/20261001161401_natori_payment_link_generations.sql',MIGRATION]
    for source in sources:sql((ROOT/source).read_text(),role=None)
    def ident():return str(uuid.uuid4())
    def setup(label,future=False,generation=1,pid=None):
        pid=pid or pay.project('o01-'+label,paid=False,status='quoted')
        q,a,j=ident(),ident(),ident()
        sql(f"insert into public.natori_quotes(id,project_id,user_id,version,title,client_name,to_email,amount,subject,body_snapshot,token_hash,expires_at) values({lit(q)},{lit(pid)},{lit(pay.OWNER)},{generation},'Synthetic','Synthetic','client@o01.invalid',1000,'Synthetic','Synthetic',{lit(hashlib.sha256(q.encode()).hexdigest())},clock_timestamp()+interval '1 day')")
        link='plink_'+a.replace('-','');deadline="clock_timestamp()+interval '1 day'" if future else "clock_timestamp()-interval '1 day'"
        sql(f"insert into public.natori_payment_link_attempts(id,project_id,owner_id,quote_id,generation,amount,livemode,provider_account_id,state,price_id,link_id,link_url,deadline) values({lit(a)},{lit(pid)},{lit(pay.OWNER)},{lit(q)},{generation},1000,false,'acct_fixture','active','price_fixture',{lit(link)},{lit('https://buy.stripe.com/'+link)},{deadline})")
        sql(f"insert into public.natori_payment_link_stops(id,project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision,status) values({lit(j)},{lit(pid)},{lit(pay.OWNER)},{lit(a)},{lit(link)},false,'deadline',1,'needs_review')")
        return pid,a,j,link
    def claim(pid,j,owner=pay.OWNER):return json.loads(value(f"select public.natori_payment_stop_claim_v1({lit(owner)},{lit(pid)},{lit(j)},{lit(ident())})::text"))
    def core(pid,command,payload):return json.loads(value(f"select public.natori_payment_links_v1({lit(pay.OWNER)},{lit(pid)},{lit(command)},{js(payload)})::text"))
    def status(owner=pay.OWNER):return json.loads(value(f"select public.natori_payment_stop_status_v1({lit(owner)})::text"))
    p,a,j,link=setup('recovery')
    before=value(f"select created_at from public.natori_payment_link_stops where id={lit(j)}")
    first=claim(p,j);check('needs_review_exact_job_claimed',first['result']=='claimed' and first['job']['id']==j and first['attempt']['id']==a)
    fence={'jobId':j,'token':first['job']['claim_token'],'generation':first['job']['claim_generation']}
    check('same_job_live_lease_busy',claim(p,j)['result']=='busy')
    check('retry_failure_remains_pending',core(p,'finish_stop',{**fence,'outcome':'retry'})['result']=='needs_review')
    second=claim(p,j);check('same_job_reclaims_higher_generation',second['job']['id']==j and second['job']['claim_generation']>fence['generation'])
    check('stale_worker_cannot_finish',core(p,'finish_stop',{**fence,'outcome':'inactive'})['result']=='stale')
    check('stale_worker_cannot_renew',core(p,'stop_renew',fence)['result']=='stale')
    fence={'jobId':j,'token':second['job']['claim_token'],'generation':second['job']['claim_generation']}
    check('same_job_completes',core(p,'finish_stop',{**fence,'outcome':'inactive'})['result']=='completed')
    check('completed_retry_idempotent',claim(p,j)['result']=='completed')
    check('created_age_preserved',value(f"select created_at from public.natori_payment_link_stops where id={lit(j)}")==before)
    p,a,j,link=setup('future',True)
    check('current_future_link_not_claimed',claim(p,j)['result']=='not_due')
    check('current_future_state_unchanged',value(f"select state='active' from public.natori_payment_link_attempts where id={lit(a)}")=='t')
    check('other_owner_denied',claim(p,j,pay.OTHER)['result']=='not_found')
    other,_,otherj,_=setup('other')
    check('other_project_job_denied',claim(other,j)['result']=='not_found')
    sql(f"update public.natori_payment_link_stops set deadline_revision=2 where id={lit(otherj)}")
    check('changed_deadline_revision_denied',claim(other,otherj)['result']=='needs_review')
    p,a,j,link=setup('old-generation')
    _,newa,newj,newlink=setup('new-generation',True,2,p)
    sql(f"begin;select set_config('natori.payment_link_writer','v1',true);update public.natori_projects set payment_link_id={lit(newlink)},payment_link_url={lit('https://buy.stripe.com/'+newlink)},payment_link_status='sent' where id={lit(p)};commit")
    projection=pay.state(p)
    old=claim(p,j);check('retired_generation_claims_exact_old_link',old['result']=='claimed' and old['job']['link_id']==link)
    check('later_job_waits_for_earlier',claim(p,newj)['result']=='not_due')
    fence={'jobId':j,'token':old['job']['claim_token'],'generation':old['job']['claim_generation']}
    check('retired_generation_completes',core(p,'finish_stop',{**fence,'outcome':'inactive'})['result']=='completed')
    check('new_projection_and_money_unchanged',pay.state(p)==projection)
    check('new_generation_stays_active',value(f"select state='active' from public.natori_payment_link_attempts where id={lit(newa)}")=='t')
    p,a,j,_=setup('ordering');extra=ident()
    sql(f"insert into public.natori_payment_link_stops(id,project_id,owner_id,link_id,reason,status,created_at) values({lit(extra)},{lit(p)},{lit(pay.OWNER)},'plink_older','legacy_closed','pending',clock_timestamp()-interval '1 day')")
    check('different_oldest_job_not_claimed',claim(p,j)['result']=='earlier_job_pending')
    check('legacy_unverified_job_not_reset',claim(p,extra)['result']=='needs_review')
    p,a,j,_=setup('parallel');sql(f"update public.natori_payment_link_stops set status='pending' where id={lit(j)}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        values=list(pool.map(lambda _:claim(p,j),range(2)))
    check('parallel_manual_single_claim',sorted(x['result'] for x in values)==['busy','claimed'])
    active=next(x for x in values if x['result']=='claimed');fence={'jobId':j,'token':active['job']['claim_token'],'generation':active['job']['claim_generation']}
    sql(f"update public.natori_payment_link_stops set lease_until=clock_timestamp()-interval '1 second' where id={lit(j)}")
    check('expired_lease_cannot_finish',core(p,'finish_stop',{**fence,'outcome':'inactive'})['result']=='stale')
    reclaimed=claim(p,j);check('expired_lease_reclaims_same_job',reclaimed['result']=='claimed' and reclaimed['job']['claim_generation']>fence['generation'])
    cp,ca,cj,_=setup('cron-manual');sql(f"update public.natori_payment_link_stops set status='pending' where id={lit(cj)}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        cron=pool.submit(core,cp,'claim_stop',{'token':ident()})
        manual=pool.submit(claim,cp,cj)
        raced=[cron.result(),manual.result()]
    check('actual_cron_manual_single_claim',sorted(x['result'] for x in raced)==['busy','claimed'] and next(x for x in raced if x['result']=='claimed')['job']['id']==cj)
    own=status();check('owner_status_counts_and_oldest',own['unresolved']>=1 and own['oldestAt'] is not None and all(x['title']=='PAY01 synthetic' for x in own['jobs']))
    check('other_owner_status_empty',status(pay.OTHER)['unresolved']==0)
    sql(f"update public.natori_payment_link_stops set owner_id={lit(pay.OTHER)} where id={lit(j)}")
    check('current_project_owner_required',not any(x['id']==j for x in status(pay.OTHER)['jobs']))
    run=ident();check('cron_start_recorded',value(f"select public.natori_payment_stop_run_v1({lit(pay.OWNER)},{lit(run)})")=='t')
    check('unfinished_run_visible',status()['lastRun']['finishedAt'] is None and status()['lastRun']['outcome'] is None)
    result={'kind':'ok','scanned':2,'expired':1,'skipped':0,'failed':1}
    check('partial_run_recorded',value(f"select public.natori_payment_stop_run_v1({lit(pay.OWNER)},{lit(run)},{js(result)})")=='t' and status()['lastRun']['outcome']=='partial')
    check('completed_run_cannot_be_overwritten',value(f"select public.natori_payment_stop_run_v1({lit(pay.OWNER)},{lit(run)},{js({**result,'failed':0})})")=='f')
    check('other_owner_cannot_complete_run',value(f"select public.natori_payment_stop_run_v1({lit(pay.OTHER)},{lit(run)},{js(result)})")=='f')
    for role in ['anon','authenticated']:
        for function in ['natori_payment_stop_status_v1(uuid)','natori_payment_stop_run_v1(uuid,uuid,jsonb)','natori_payment_stop_claim_v1(uuid,uuid,uuid,uuid)']:
            check(role+'_execute_denied_'+function.split('(')[0],value(f"select not has_function_privilege({lit(role)},{lit('public.'+function)},'execute')",role=None)=='t')
        check(role+'_table_denied',value(f"select not has_table_privilege({lit(role)},'public.natori_payment_stop_runs','select')",role=None)=='t')
    check('new_functions_invoker_empty_search_path',value("select bool_and(not prosecdef and proconfig=array['search_path=\"\"']) from pg_proc where pronamespace='public'::regnamespace and proname in ('natori_payment_stop_status_v1','natori_payment_stop_run_v1','natori_payment_stop_claim_v1')",role=None)=='t')
    target=Path(results);target.mkdir(parents=True,exist_ok=True);(target/'db-checks.json').write_text(json.dumps({'count':len(CHECKS),'checks':CHECKS,'sources':{x:hashlib.sha256((ROOT/x).read_bytes()).hexdigest() for x in sources}},indent=2)+'\n')
    print(f'{len(CHECKS)} O01 native PostgreSQL checks passed',flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--container',required=True);parser.add_argument('--results',required=True);args=parser.parse_args();main(args.container,args.results)
