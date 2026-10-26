"""Normal 53->54 synthetic PostgreSQL only. No provider, purge or TRUNCATE."""
import hashlib,json,pathlib,subprocess,sys,time,uuid
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path(sys.argv[1]);OUT.mkdir(exist_ok=False)
MIG='supabase/migrations/20261025000000_natori_production_mail_evidence.sql'
RUN='prod-mail-'+uuid.uuid4().hex[:8]
REPORT={'checks':[],'containers':[],'scope':'normal business schema; Auth/Storage catalog fixtures; no real services','migrationSHA256':hashlib.sha256((ROOT/MIG).read_bytes()).hexdigest()}
def docker(args,stdin=None,ok=True):
 r=subprocess.run(['/usr/local/bin/docker','--host','unix:///var/run/docker.sock',*args],input=stdin,text=True,capture_output=True,timeout=30)
 if ok and r.returncode:raise RuntimeError(r.stderr)
 return r if not ok else r.stdout.strip()
def lit(v):return "'"+str(v).replace("'","''")+"'"
def js(v):return lit(json.dumps(v))+'::jsonb'
def check(label,value):
 assert value,label
 REPORT['checks'].append(label);print(label,flush=True)
def db(label,work):
 name=RUN+'-'+label
 docker(['run','--detach','--pull','never','--network','none','--name',name,'--label','meish.production-mail='+RUN,'--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=256m','--env','POSTGRES_HOST_AUTH_METHOD=trust','sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f','postgres','-c','listen_addresses=127.0.0.1'])
 row={'name':name,'removed':False};REPORT['containers'].append(row)
 def raw(s):return docker(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],s,False)
 def sql(s):
  r=raw(s)
  if r.returncode:raise RuntimeError(r.stderr)
  return r.stdout.strip()
 try:
  for _ in range(80):
   if raw('select 1').returncode==0:break
   time.sleep(.1)
  info=json.loads(docker(['inspect',name]))[0]
  assert info['HostConfig']['NetworkMode']=='none' and not info['HostConfig'].get('PortBindings') and all(m['Type']=='tmpfs' for m in info['Mounts'])
  sql('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');sql((ROOT/'scripts/legacy-entry-read-security/fresh-bootstrap.sql').read_text())
  base=[f for f in json.loads((ROOT/'supabase/baseline/manifest.json').read_text())['activeMigrations'] if f!=MIG];assert len(base)==53
  for f in base:sql((ROOT/f).read_text())
  work(sql,raw,name)
 finally:
  assert json.loads(docker(['inspect',name]))[0]['Config']['Labels']['meish.production-mail']==RUN
  docker(['rm','--force',name]);row['removed']=True

def upgrade(sql,raw,name):
 owner='22222222-2222-4222-8222-222222222222';other='33333333-3333-4333-8333-333333333333';uid=lambda:str(uuid.uuid4())
 sql(f"insert into auth.users(id) values('{owner}'),('{other}');")
 fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',f"import{{seed}}from'./scripts/natori-case-payment/fixture.mjs';console.log(JSON.stringify(seed('{owner}','{other}')));"],cwd=ROOT,text=True));sql(fixture['sql']);project=fixture['ids'][0];legacy=uid()
 sql(f"insert into natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,status,payload,send_started_at) values('{legacy}','legacy','{project}','rough_ok_artist','{{}}','unknown','{{\"legacy\":true}}',now()-interval '1 hour')")
 snapshot=lambda:sql("select md5((select jsonb_agg(to_jsonb(p) order by id)::text from natori_projects p)||(select jsonb_agg(to_jsonb(j) order by id)::text from natori_notification_jobs j))")
 before=snapshot();sql((ROOT/MIG).read_text());check('populated 53 to 54 upgrade changes no existing project/notification bytes',snapshot()==before)
 service=lambda s:'begin;set local role service_role;'+s+';commit;'
 rpc=lambda f,a:json.loads(sql(service('select to_jsonb(public.'+f+'('+a+'))')) or 'null')
 conn=uid();foreign=uid();scope='resend/'+conn;ref='abcdefghijklmnopqrst';origin='https://release.example.invalid';fp='c'*64;h='a'*64;payload={'fixture':'immutable synthetic mail'}
 sql(f"insert into natori_case_production_mail_connections(id,owner_id,scope,project_ref,origin,credential_hash,enabled) values('{conn}','{owner}','{scope}','{ref}','{origin}','{fp}',true),('{foreign}','{other}','resend/{foreign}','{ref}','{origin}','{fp}',true)")
 def job():
  j={'id':uid(),'claim':uid()};sql(f"insert into natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,status,claim_token,lease_expires_at,created_at) values('{j['id']}','prod-{j['id']}','{project}','quote_accept_artist','{{}}','sending','{j['claim']}',now()+interval '10 minutes',now()-interval '1 hour')");return j
 def bind(j,**patch):
  a=dict(conn=conn,owner=owner,project=project,claim=j['claim'],ref=ref,origin=origin,fp=fp,h=h,payload=payload);a.update(patch)
  return rpc('natori_case_production_mail_bind_v1',','.join([lit(a[k]) for k in ['conn','owner','project']]+[lit(j['id'])]+[lit(a[k]) for k in ['claim','ref','origin','fp','h']]+[js(a['payload'])]))
 def gate(j,**patch):
  a=dict(conn=conn,owner=owner,project=project,claim=j['claim'],fp=fp,h=h);a.update(patch)
  return rpc('natori_case_production_mail_send_v1',','.join([lit(a[k]) for k in ['conn','owner','project']]+[lit(j['id'])]+[lit(a[k]) for k in ['claim','fp','h']]))
 stamp=lambda:sql("select to_char(clock_timestamp()-interval '1 second','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")
 def event_args(j,e,typ='email.sent',**patch):
  a=dict(conn=conn,h=h,provider='mail_'+j['id'].replace('-',''),body='d'*64,at=stamp(),ref=ref,origin=origin);a.update(patch)
  return ','.join([lit(a['conn']),lit(e),lit(a['body']),lit(j['id']),lit(a['h']),lit(a['provider']),lit(typ),lit(a['at']),lit(a['ref']),lit(a['origin'])])
 def event(j,e,typ='email.sent',**patch):return rpc('natori_case_production_mail_event_v1',event_args(j,e,typ,**patch))
 proof=lambda j,who=owner:rpc('natori_case_production_mail_evidence_v1',','.join(map(lit,[who,project,j['id'],conn])))
 first=job();waiting=job();check('new send binds scope and frozen payload with NULL provider mode',bind(first)['allowed'] and sql(f"select provider_livemode is null and provider_scope='{scope}' and payload={js(payload)} from natori_notification_jobs where id='{first['id']}'")=='t')
 check('same reservation is idempotent',bind(first)['allowed'] and sql(f"select count(*) from natori_case_production_mail_bindings where job_id='{first['id']}'")=='1')
 check('changed owner/ref/origin/credential/token/request/body/connection cannot bind',all(not bind(first,**p)['allowed'] for p in [dict(owner=other),dict(ref='z'*20),dict(origin='https://other.invalid'),dict(fp='e'*64),dict(claim=uid()),dict(h='e'*64),dict(payload={'changed':True}),dict(conn=foreign)]))
 check('legacy started unknown gets no environment backfill',not bind(dict(id=legacy,claim=uid()))['allowed'] and 'mailEnvironment' not in rpc('natori_case_reconciliation_identity_v1',lit(project)+",'mail',"+lit(legacy)))
 check('pre-send requires actual started claim',gate(first)==False)
 rpc('natori_notification_start_v1',','.join([lit(first['id']),lit(first['claim']),js(payload)]))
 check('exact started claim may send; key/token/hash changes deny',gate(first) and not gate(first,fp='e'*64) and not gate(first,claim=uid()) and not gate(first,h='e'*64))
 at=stamp();check('out-of-order delivered alone is not acceptance proof',event(first,'delivery','email.delivered',at=at)['result']=='recorded' and proof(first) is None)
 check('duplicate event stable; changed body/provider conflicts',event(first,'delivery','email.delivered',at=at)['result']=='duplicate' and event(first,'delivery','email.delivered',at=at,body='e'*64)['result']=='conflict' and event(first,'different_provider',provider='other')['result']=='conflict')
 check('connection/ref/owner separation',event(first,'badref',ref='z'*20)['result']=='unmatched' and event(first,'badconn',conn=foreign)['result']=='unmatched' and proof(first,other) is None)
 # Two genuine PostgreSQL sessions contend for the same signed event/job.
 args=event_args(first,'concurrent_delivery','email.delivered');expr='public.natori_case_production_mail_event_v1('+args+')'
 worker=subprocess.Popen(['/usr/local/bin/docker','--host','unix:///var/run/docker.sock','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  worker.stdin.write('begin;set local role service_role;select '+expr+';select pg_sleep(0.5);commit;\n');worker.stdin.close();worker.stdin=None
  first_result=json.loads(worker.stdout.readline());second_result=json.loads(sql(service('select '+expr)));_,errors=worker.communicate(timeout=10)
  check('concurrent same-event sessions serialize to one fact without conflict or duplicate send',worker.returncode==0 and not errors and first_result['result']=='recorded' and second_result['result']=='duplicate' and sql("select count(*) from natori_case_production_mail_events where event_id='concurrent_delivery'")=='1')
 finally:
  if worker.poll() is None:worker.terminate();worker.wait(timeout=5)
 rpc('natori_notification_start_v1',','.join([lit(waiting['id']),lit(waiting['claim']),js(payload)]))
 check('valid active started claim still cannot acquire a historical environment binding',not bind(waiting)['allowed'] and 'mailEnvironment' not in rpc('natori_case_reconciliation_identity_v1',lit(project)+",'mail',"+lit(waiting['id'])))
 # Seed an already-purged tombstone only; no erasure, purge RPC or TRUNCATE.
 tomb={'id':uid()};sql(f"insert into natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,status,payload,send_started_at,created_at,provider_scope) values('{tomb['id']}','tombstone','{project}','quote_accept_artist','{{}}','unknown','{{\"purged\":true}}',now()-interval '30 minutes',now()-interval '1 hour','{scope}');insert into natori_case_production_mail_bindings(job_id,connection_id,owner_id,project_id,request_hash,payload_hash) values('{tomb['id']}','{conn}','{owner}','{project}','{h}','{'b'*64}')")
 recon=lambda cmd,data={}:rpc('natori_case_reconciliation_v1',','.join([lit(owner),lit(project),lit(cmd),js(data)]))
 busy_id=uid();busy=recon('claim',dict(id=busy_id,token=uid(),kind='mail',mode='read',target=tomb['id'],revision=recon('read')['revision'],operator=dict(kind='auth-user',userId=owner)))
 check('active notification lease prevents reconciliation claim',busy['result']=='busy')
 rpc('natori_notification_finish_v1',','.join([lit(first['id']),lit(first['claim']),lit('unknown'),'null',lit('synthetic_response_unknown')]))
 rpc('natori_notification_finish_v1',','.join([lit(waiting['id']),lit(waiting['claim']),lit('unknown'),'null',lit('synthetic_response_unknown')]))
 rid=uid();token=uid();claimed=recon('claim',dict(id=rid,token=token,kind='mail',mode='read',target=tomb['id'],revision=recon('read')['revision'],operator=dict(kind='auth-user',userId=owner)))
 check('canonical production identity retains NULL mode and persistent hashes',claimed['result']=='claimed' and claimed['identity']['mailEnvironment']=='production' and claimed['identity']['mailConnection']==conn and claimed['identity']['livemode'] is None and claimed['identity']['payloadHash']=='b'*64)
 fake=dict(state='confirmed',source='provider_webhook',identity=claimed['identity'],checkedAt=stamp(),complete=True,limits=[],reference='unproven_mail',occurredAt=stamp(),outcome='accepted');fake_id=uid()
 save_fake=dict(id=rid,token=token,generation=claimed['generation'],evidenceId=fake_id,facts=fake);apply_fake=dict(id=rid,evidenceId=fake_id,resolutionId=uid(),operator=dict(kind='auth-user',userId=owner))
 rejected=sql('begin;set local role service_role;'+f"select natori_case_reconciliation_v1('{owner}','{project}','save',{js(save_fake)});select natori_case_reconciliation_v1('{owner}','{project}','apply',{js(apply_fake)});rollback;")
 check('a forged positive proof without signed inbox cannot settle even an exact canonical identity','needs_review' in rejected and sql(f"select status from natori_notification_jobs where id='{tomb['id']}'")=='unknown')
 status=lambda:rpc('natori_case_system_status_v1',lit(owner));review=lambda:rpc('natori_case_system_review_v1',lit(owner))
 control=lambda action:rpc('natori_case_system_control_v2',','.join([lit(owner),lit(action),str(status()['generation']),js(dict(kind='auth-user',userId=owner)),lit(review()['revision']) if action.startswith('resume-') else 'null','true']))
 check('system hold blocks new reservation and send',control('hold')['result']=='saved' and rpc('natori_case_system_admit_v1',lit(owner)+",'sender'")==False and not bind(waiting)['allowed'] and gate(first)==False)
 sql(f"update natori_case_production_mail_connections set enabled=false where id='{conn}'")
 at=stamp();check('disabled connection/full hold still record late sent fact',event(tomb,'late_sent',at=at)['result']=='recorded')
 ev=proof(tomb);check('tombstone proof has exact microsecond timestamp and hashes',ev['environment']=='production' and ev['payloadHash']=='b'*64 and len(ev['occurredAt'].split('.')[1].split('+')[0])>=6)
 facts=dict(state='confirmed',source='provider_webhook',identity=claimed['identity'],checkedAt=sql("select to_char(clock_timestamp(),'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"),complete=True,limits=[],reference=ev['reference'],occurredAt=ev['occurredAt'],outcome='accepted');eid=uid();resolution=uid()
 check('save under hold does not apply or revive payload',recon('save',dict(id=rid,token=token,generation=claimed['generation'],evidenceId=eid,facts=facts))['result']=='saved' and sql(f"select status||'/'||(payload->>'purged') from natori_notification_jobs where id='{tomb['id']}'")=='unknown/true')
 apply=dict(id=rid,evidenceId=eid,resolutionId=resolution,operator=dict(kind='auth-user',userId=owner))
 check('apply cannot bypass full hold',raw(service(f"select natori_case_reconciliation_v1('{owner}','{project}','apply',{js(apply)})")).returncode!=0)
 check('command resume permits separate exact-proof apply while senders remain held',control('resume-commands')['result']=='saved' and status()['sendersHeld'] and recon('apply',apply)['result']=='applied')
 check('apply replay keeps one resolution and other purpose unknown',recon('apply',apply)['result']=='applied' and sql(f"select count(*) from natori_case_reconciliation_resolutions where job_id='{rid}'")=='1' and sql(f"select status||'/'||(payload->>'purged') from natori_notification_jobs where id='{tomb['id']}'")=='sent/true' and sql(f"select status from natori_notification_jobs where id='{legacy}'")=='unknown')
 sql(f"update natori_case_production_mail_connections set enabled=true where id='{conn}'")
 check('connection re-enable alone cannot resume senders',not gate(first))
 check('fresh sender resume preserves unknown/legacy fences instead of restarting old claims',control('resume-senders')['result']=='saved' and rpc('natori_case_system_admit_v1',lit(owner)+",'sender'")==True and rpc('natori_case_system_admit_v1',lit(owner)+",'legacy-sender'")==False and gate(first)==False)
 check('reader includes production event history',any(e['job_id']==first['id'] and e['event_type']=='email.delivered' for e in recon('read')['mailEvents']))
 check('all four tables have RLS/browser denial',sql("select bool_and(relrowsecurity and not has_table_privilege('anon',oid,'SELECT') and not has_table_privilege('authenticated',oid,'SELECT')) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'natori_case_production_mail_%'")=='t')
 check('connection/evidence edits and private schema remain unavailable to service',sql("select has_table_privilege('service_role','natori_case_production_mail_connections','INSERT,UPDATE,DELETE,TRUNCATE')")=='f' and sql("select has_table_privilege('service_role','natori_case_production_mail_events','UPDATE,DELETE,TRUNCATE')")=='f' and sql("select has_schema_privilege('service_role','natori_case_guard','USAGE')")=='f')
 check('no PUBLIC/anon/authenticated implicit RPC execution',sql("select bool_and(not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE')) from pg_proc where pronamespace='public'::regnamespace and proname like '%production_mail%'")=='t')
 definition=sql("select pg_get_functiondef('natori_case_guard.natori_case_production_mail_event_v1(uuid,text,text,uuid,text,text,text,timestamptz,text,text)'::regprocedure)")
 changed=definition.replace('begin','begin /* fixture drift */',1)
 drift=raw('begin;'+changed+';set local role service_role;'+f"select natori_case_production_mail_event_v1('{conn}','drift','{h}','{tomb['id']}','{h}','x','email.sent',now(),'{ref}','{origin}');")
 check('private fact definition drift fails closed transactionally',drift.returncode!=0 and 'contract_changed' in drift.stderr)
 check('canonical contract restored and no frame leak after rejected drift',sql('select count(*) from natori_case_guard.frames')=='0' and event(tomb,'after_drift')['result']=='recorded')

def fresh(sql,raw,_name):
 sql((ROOT/MIG).read_text());check('fresh complete 54 migration replay needs no source rewrite or connection seed',sql('select count(*) from natori_case_production_mail_connections')=='0')
try:
 db('upgrade',upgrade);db('fresh',fresh);REPORT['success']=True
except Exception as error:
 REPORT['success']=False;REPORT['error']=str(error);print(str(error),file=sys.stderr);sys.exitcode=1
finally:
 (OUT/'results.json').write_text(json.dumps(REPORT,indent=2));print(json.dumps({'success':REPORT.get('success'),'checks':len(REPORT['checks']),'removed':all(c['removed'] for c in REPORT['containers'])}))
if not REPORT.get('success'):sys.exit(1)
