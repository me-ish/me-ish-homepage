import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {root} from '../natori-case-local-auth/prepare.mjs';
import {seed} from '../natori-case-payment/fixture.mjs';
const out=resolve(process.argv[2]??'');assert(out.startsWith('/workspace/')||out.startsWith('/tmp/'));mkdirSync(out);
const run='meish-case-fence-'+randomBytes(5).toString('hex'),name=run+'-db';
const report={scope:'normal business schema; synthetic SQL only; Auth/Storage catalog fixtures; no providers',checks:[],removed:false};
const call=(args,input)=>spawnSync('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
const docker=(args,input)=>{const r=call(args,input);if(r.status!==0)throw Error(r.stderr||'docker failed');return r.stdout.trim();};
const raw=s=>call(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],s);
const sql=s=>{const r=raw(s);if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
const check=(label,fn)=>{fn();report.checks.push(label);console.log(label);};
const owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const asService=s=>'begin;set local role service_role;'+s+'commit;';
const status=(o=owner)=>JSON.parse(sql(asService(`select natori_case_system_status_v1('${o}')`)));
const review=()=>JSON.parse(sql(asService(`select natori_case_system_review_v1('${owner}')`)));
const control=(action,g,actor={kind:'auth-user',userId:owner})=>JSON.parse(sql(asService(`select natori_case_system_control_v2('${owner}','${action}',${g},'${JSON.stringify(actor)}'::jsonb,${action.startsWith('resume-')?`'${review().revision}'`:'null'},true);`)));
try{
 docker(['run','--detach','--pull','never','--network','none','--name',name,'--label','meish.hold='+run,'--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=256m','--env','POSTGRES_HOST_AUTH_METHOD=trust','sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f','postgres','-c','listen_addresses=127.0.0.1']);
 for(let i=0;i<80&&raw('select 1').status!==0;i++)await new Promise(r=>setTimeout(r,100));
 const info=JSON.parse(docker(['inspect',name]))[0];assert.equal(info.HostConfig.NetworkMode,'none');assert.deepEqual(info.HostConfig.PortBindings??{},{});assert(info.Mounts.every(m=>m.Type==='tmpfs'));
 sql('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');
 sql(readFileSync(root+'/scripts/legacy-entry-read-security/fresh-bootstrap.sql','utf8'));
 const migrations=JSON.parse(readFileSync(root+'/supabase/baseline/manifest.json','utf8')).activeMigrations;
 for(const file of migrations)sql(readFileSync(root+'/'+file,'utf8'));
 sql(`insert into auth.users(id) values('${owner}'),('${other}');`);const fixture=seed(owner,other);sql(fixture.sql);
 const project=fixture.ids[0],quote='b0000000-0000-4000-8000-000000000001';
 const unknown='e0000000-0000-4000-8000-000000000001',sending='e0000000-0000-4000-8000-000000000002';
 sql(`insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,status,snapshot,payload,send_started_at,claim_token,lease_expires_at)
 values('${unknown}','hold/unknown','${project}','${quote}','quote_accept_artist','unknown','{}','{"fixture":"frozen unknown payload"}',now()-interval '1 hour',null,null),
 ('${sending}','hold/sending','${project}','${quote}','quote_accept_artist','sending','{}','{"fixture":"frozen in-flight payload"}',now(),'d0000000-0000-4000-8000-000000000002',now()+interval '2 minutes');
 insert into natori_payment_link_attempts(id,project_id,owner_id,quote_id,generation,amount,livemode,provider_account_id,state,deadline,price_started_at)
 values('f0000000-0000-4000-8000-000000000001','${project}','${owner}','${quote}',1,12000,false,'acct_holdfixture','creating',now()+interval '1 day',now());
 insert into natori_payment_link_operations(project_id,operation_id,request_hash,action,attempt_id,expected_revision,status)
 values('${project}','c0000000-0000-4000-8000-000000000001',repeat('a',64),'issue','f0000000-0000-4000-8000-000000000001',1,'pending');`);
 const tables=JSON.parse(sql(`select jsonb_agg(relname order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'natori_%' and relname not in ('natori_case_system_holds','natori_case_system_hold_events')`));
 const business=()=>sql(`select md5(string_agg(value,'|' order by value)) from (${tables.map(t=>`select '${t}'||coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]') value from public.${t} r`).join(' union all ')}) t`);const factProject='a0000000-0000-4000-8000-000000000100',factQuote='b0000000-0000-4000-8000-000000000100',factMail='e0000000-0000-4000-8000-000000000100';
 sql(`insert into public.natori_projects(id,user_id,title,client_name,client_email,status,type,amount) values('${factProject}','${owner}','独立合成承諾','合成依頼者','fixture@example.invalid','quoted','illustration',12000);
 insert into public.natori_quotes(id,project_id,user_id,version,amount,created_at,expires_at,issued_at,title,client_name,to_email,subject,body_snapshot,token_hash) values('${factQuote}','${factProject}','${owner}',1,12000,now(),now()+interval '30 days',now(),'独立合成承諾','合成依頼者','fixture@example.invalid','合成見積','合成本文',repeat('9',64));
 update public.natori_projects set active_quote_id='${factQuote}' where id='${factProject}';
 insert into public.natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,status,snapshot,payload,send_started_at,claim_token,lease_expires_at) values('${factMail}','hold/review-delivery','${factProject}','${factQuote}','delivery_issue_client','sending','{}','{"format":"natori-delivery-aes256gcm-v1","ciphertext":"synthetic-not-a-credential","expiresAt":"2026-12-01T00:00:00Z"}',now(),'d0000000-0000-4000-8000-000000000100',now()+interval '2 minutes');`);

 const deliveryProject='a0000000-0000-4000-8000-000000000200',deliveryFile='40000000-0000-4000-8000-000000000200';
 const roughMessage='40000000-0000-4000-8000-000000000300',roughId='50000000-0000-4000-8000-000000000300';
 const lateMail='e0000000-0000-4000-8000-000000000400',lateRun='70000000-0000-4000-8000-000000000400';
 const reconJob='80000000-0000-4000-8000-000000000500',reconToken='d0000000-0000-4000-8000-000000000500',reconTarget='e0000000-0000-4000-8000-000000000500';
 sql(`insert into public.natori_projects(id,user_id,title,client_name,client_email,status,type,amount,payment_confirmed_at) values('${deliveryProject}','${owner}','合成受取','合成依頼者','fixture@example.invalid','delivery_prep','illustration',12000,now());
 insert into public.natori_delivery_files(id,project_id,folder,storage_path,file_name,size_bytes,content_type,state,storage_version,verified_at) values('${deliveryFile}','${deliveryProject}','final','${deliveryProject}/final/${deliveryFile}.png','fixture.png',12,'image/png','ready','synthetic-version',clock_timestamp());
 insert into public.natori_consultation_messages(id,project_id,sender,body) values('${roughMessage}','${fixture.ids[1]}','staff','合成ラフの説明');
 insert into public.natori_talk_roughs(id,project_id,message_id,before_quote) values('${roughId}','${fixture.ids[1]}','${roughMessage}',false);
 insert into public.natori_consultation_access(project_id,token_hash,expires_at) values('${fixture.ids[1]}',repeat('a',64),now()+interval '1 day');
 insert into public.natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,status,snapshot,payload,send_started_at,provider_scope,claim_token,lease_expires_at) values('${lateMail}','hold/late-mail-event','${factProject}','${factQuote}','quote_accept_artist','sending','{}','{"synthetic":true}',clock_timestamp(),'independent-mail-scope','d0000000-0000-4000-8000-000000000400',now()+interval '2 minutes');
 insert into public.natori_case_acceptance_runs(id,owner_id,project_ref,origin,provider_scope,stripe_account,starts_at,ends_at,enabled,allowed_to,sender,reply_to,mail_limit,human_limit) values('${lateRun}','${owner}','synthetic-independent-local','https://example.invalid','independent-mail-scope','acct_syntheticfixture',now()-interval '2 hours',now()-interval '1 hour',false,array['fixture@example.invalid'],'fixture@example.invalid','fixture@example.invalid',1,0);
 insert into public.natori_case_acceptance_projects(run_id,project_id) values('${lateRun}','${factProject}');
 insert into public.natori_case_mail_bindings(job_id,run_id,owner_id,project_id,provider_scope,environment,request_hash,payload_hash) select '${lateMail}','${lateRun}','${owner}','${factProject}','independent-mail-scope','acceptance',repeat('b',64),encode(sha256(convert_to(payload::text,'UTF8')),'hex') from public.natori_notification_jobs where id='${lateMail}';
 insert into public.natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,status,snapshot,payload,send_started_at,provider_scope,provider_livemode) values('${reconTarget}','hold/reconciliation-save','${fixture.ids[2]}','b0000000-0000-4000-8000-000000000003','quote_accept_artist','unknown','{}','{"synthetic":true}',now(),'independent-reconciliation-scope',false);`);
 const issue=JSON.parse(sql(asService(`select row_to_json(r) from public.natori_delivery_issue_v1('${owner}','${deliveryProject}','60000000-0000-4000-8000-000000000200','fixture@example.invalid',repeat('d',64),jsonb_build_array(jsonb_build_object('id','${deliveryFile}','path','${deliveryProject}/final/${deliveryFile}.png','fileName','fixture.png','sizeBytes',12,'contentType','image/png','storageVersion','synthetic-version')),clock_timestamp(),repeat('e',64),clock_timestamp()+interval '1 day','{"format":"natori-delivery-aes256gcm-v1","ciphertext":"synthetic-not-a-credential","expiresAt":"2026-12-01T00:00:00Z"}') r;`)));
 assert.equal(issue.result,'issued');
 const reconRevision=sql(asService(`select public.natori_case_reconciliation_revision_v1('${fixture.ids[2]}');`));
 const claimed=JSON.parse(sql(asService(`select public.natori_case_reconciliation_v1('${owner}','${fixture.ids[2]}','claim',jsonb_build_object('id','${reconJob}','token','${reconToken}','kind','mail','target','${reconTarget}','revision','${reconRevision}','operator',jsonb_build_object('kind','auth-user','userId','${owner}')));`)));
 assert.equal(claimed.result,'claimed');

 const credentialProject=fixture.ids[4],credentialOp='60000000-0000-4000-8000-000000000600',credentialFile='40000000-0000-4000-8000-000000000600',credentialIssuer='d0000000-0000-4000-8000-000000000600';
 const pendingDelivery='40000000-0000-4000-8000-000000000601';
 const credentialGuard=sql(`select jsonb_build_object('title',title,'clientName',client_name,'email',client_email)::text from public.natori_projects where id='${credentialProject}'`);
 const credCall=(command,input,token=credentialIssuer,guard=credentialGuard)=>asService(`select public.natori_case_consultation_operation_v1('${credentialProject}','staff','${credentialOp}',repeat('f',64),'${command}','${owner}',null,${input},${token===null?'null':`'${token}'`},'${guard}'::jsonb);`);
 const reserved=JSON.parse(sql(credCall('reserve',`jsonb_build_object('body','合成署名待ち','files',jsonb_build_array(jsonb_build_object('id','${credentialFile}','fileName','fixture.png','sizeBytes',12,'mimeType','image/png','sha256',repeat('a',64))),'noticePayload',jsonb_build_object('expiresAt',clock_timestamp()+interval '1 day'))`,null)));
 assert.equal(reserved.result,'reserved');
 const begun=JSON.parse(sql(credCall('credential_begin',`jsonb_build_object('fileId','${credentialFile}')`)));assert.equal(begun.result,'credential_started');
 const credentialUpload=sql(`select id from public.natori_consultation_uploads where project_id='${credentialProject}' and operation_id='${credentialOp}' and file_id='${credentialFile}'`);
 // Model only the persisted pre-stop begin and a metadata change while its signer is outstanding.
 sql(asService(`update public.natori_projects set title=title||'（署名待ち中に変更）' where id='${credentialProject}';`));
 assert.equal(sql(asService(`select result from public.natori_delivery_reserve_v1('${owner}','${fixture.ids[6]}','${pendingDelivery}','rough','${fixture.ids[6]}/rough/${pendingDelivery}.png','pending.png',12,'image/png');`)),'reserved');

 const stopProject=fixture.ids[8],stopAttempt='f0000000-0000-4000-8000-000000000700',stopJob='50000000-0000-4000-8000-000000000700',stopToken='d0000000-0000-4000-8000-000000000700';
 sql(`insert into public.natori_payment_link_attempts(id,project_id,owner_id,quote_id,generation,amount,livemode,provider_account_id,state,link_id,link_url,deadline) values('${stopAttempt}','${stopProject}','${owner}','b0000000-0000-4000-8000-000000000009',1,12000,false,'acct_syntheticstop','deactivating','plink_synthetic_independent_stop','https://example.invalid/synthetic-stop',now()-interval '1 day');
 insert into public.natori_payment_link_stops(id,project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision,status,claim_token,claim_generation,lease_until) values('${stopJob}','${stopProject}','${owner}','${stopAttempt}','plink_synthetic_independent_stop',false,'deadline',1,'processing','${stopToken}',1,now()+interval '2 minutes');`);
 const before=business();
 writeFileSync(out+'/catalog.json',sql(`select jsonb_agg(jsonb_build_object('oid',p.oid,'name',p.proname,'signature',p.oid::regprocedure::text,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'acl',p.proacl,'source',p.prosrc,'language',l.lanname,'volatility',p.provolatile,'config',p.proconfig) order by p.proname) from pg_proc p join pg_language l on l.oid=p.prolang where p.pronamespace='public'::regnamespace and p.proname like 'natori_%'`));
 check('normal migration replay succeeds with no business backfill',()=>{assert.equal(migrations.length,53);assert.equal(status().armed,false);});
 check('status remains a pure READ ONLY RPC, with exact owner and no data writes',()=>{assert.equal(raw(asService('set transaction read only;'+`select natori_case_system_status_v1('${owner}');`)).status,0);assert.equal(business(),before);});
 check('empty/invalid actor and stale generation cannot hold or resume; actor identity does not select the owner',()=>{assert.equal(control('hold',0,{}).result,'invalid_request');assert.equal(control('hold',0,{kind:'auth-user',userId:'invalid'}).result,'invalid_request');assert.equal(control('hold',1).result,'stale');assert.equal(status().armed,false);});
 check('hold is persisted, owner-isolated, CAS-audited and does not settle unknown results',()=>{assert.equal(control('hold',0).result,'saved');assert.equal(status().commandsHeld,true);assert.equal(status().sendersHeld,true);assert.equal(status(other).armed,false);assert.equal(business(),before);assert.equal(control('hold',0).result,'stale');});
 check('command/sender admission closes while the unknown/operation rows are unchanged',()=>{for(const kind of ['command','sender','legacy-sender'])assert.equal(sql(asService(`select natori_case_system_admit_v1('${owner}','${kind}');`)),'f');assert.equal(sql(asService(`select natori_case_system_admit_v1('${other}','command');`)),'t');});
 check('NULL/unknown admission kinds and non-READ-COMMITTED transactions fail closed',()=>{
  assert.equal(sql(asService(`select natori_case_system_admit_v1('${other}',null);`)),'f');
  assert.equal(sql(asService(`select natori_case_system_admit_v1('${other}','invalid');`)),'f');
  for(const isolation of ['repeatable read','serializable'])assert.equal(sql(`begin isolation level ${isolation};set local role service_role;select natori_case_system_admit_v1('${other}','command');commit;`),'f');
  for(const isolation of ['repeatable read','serializable'])assert.equal(JSON.parse(sql(`begin isolation level ${isolation};set local role service_role;select natori_case_system_control_v1('${owner}','resume-commands',1,'{"kind":"auth-user","userId":"${owner}"}'::jsonb);commit;`)).result,'fresh_review_required');
 });
 check('read-only rollback and separate sender resume never erase the armed record',()=>{assert.equal(control('read-only',1).result,'saved');assert.equal(status().readOnly,true);assert.equal(control('resume-senders',2).result,'commands_held');assert.equal(control('resume-commands',2).result,'saved');assert.equal(status().sendersHeld,true);assert.equal(control('resume-senders',3).result,'saved');assert.equal(status().armed,true);assert.equal(status().generation,4);assert.equal(sql(asService(`select natori_case_system_admit_v1('${owner}','legacy-sender');`)),'f');});
 check('control tables are RLS-enabled and not writable by browser/service DML; RPCs are service-only',()=>{
  assert.equal(sql("select bool_and(relrowsecurity) from pg_class where relname in ('natori_case_system_holds','natori_case_system_hold_events')"),'t');
  for(const table of ['natori_case_system_holds','natori_case_system_hold_events'])for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege('${role}','public.${table}','insert,update,delete,truncate')`),'f');
  for(const role of ['anon','authenticated'])assert.equal(sql(`select bool_or(has_function_privilege('${role}',oid,'execute')) from pg_proc where proname in ('natori_case_system_status_v1','natori_case_system_admit_v1','natori_case_system_control_v1')`),'f');
 });
 check('audit records normalize operator metadata and do not change the fixed owner dataset',()=>{
  assert.equal(control('hold',4,{kind:'auth-user',userId:other,extra:'not retained'}).result,'saved');
  assert.deepEqual(JSON.parse(sql(`select actor::text from natori_case_system_hold_events where owner_id='${owner}' and generation=5`)),{kind:'auth-user',userId:other});
  assert.equal(status(other).armed,false);assert.equal(business(),before);
 });
 assert.equal(control('resume-commands',5).result,'saved');
 // The command transaction holds shared admission first. Stop waits for it,
 // then subsequent admissions observe the new VOLATILE state after lock wait.
 const child=spawn('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],{stdio:['pipe','pipe','pipe']});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',c=>c===0?resolve():reject(Error('admission transaction failed')));});
 const admitted=new Promise(resolve=>child.stdout.once('data',resolve));child.stderr.resume();child.stdin.end(asService(`select natori_case_system_admit_v1('${owner}','command');select pg_sleep(1);`));await admitted;
 const started=Date.now();assert.equal(control('hold',6).result,'saved');await done;
 check('exclusive stop waits for admitted DB work and blocks subsequent admission without claiming provider completion',()=>{assert(Date.now()-started>500);assert.equal(status().commandsHeld,true);assert.equal(business(),before);});
 check('unknown, in-flight mail and unresolved creation retain identity, payload, lease and pending result',()=>{
  assert.equal(business(),before);
  assert.equal(sql(`select status||'/'||(payload->>'fixture') from natori_notification_jobs where id='${unknown}'`),'unknown/frozen unknown payload');
  assert.equal(sql(`select status||'/'||(claim_token is not null)::text||'/'||(send_started_at is not null)::text from natori_notification_jobs where id='${sending}'`),'sending/true/true');
  assert.equal(sql(`select status from natori_payment_link_operations where operation_id='c0000000-0000-4000-8000-000000000001'`),'pending');
 });

 check('independent: held direct UPDATE rejects and another owner remains writable',()=>{
  const r=raw(asService(`update public.natori_projects set note='must not persist' where id='${project}';`));assert.notEqual(r.status,0);assert.match(r.stderr,/natori_system_held/);
  assert.equal(sql(asService(`update public.natori_projects set note='other owner remains writable' where id='${fixture.ids[10]}';select note from public.natori_projects where id='${fixture.ids[10]}';`)),'other owner remains writable');
 });
 check('independent: nested quote acceptance under hold cannot leak a frame into caller DML',()=>{
  const r=raw(asService(`select result from public.natori_accept_quote_with_notifications_v1(repeat('9',64));update public.natori_projects set note='frame leak' where id='${factProject}';`));assert.notEqual(r.status,0);assert.match(r.stderr,/natori_system_held/);
  assert.equal(sql(`select (accepted_at is null)::text from public.natori_quotes where id='${factQuote}';`),'true');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 check('independent: valid held quote acceptance persists exact fact and notification intent',()=>{
  assert.equal(sql(asService(`select result from public.natori_accept_quote_with_notifications_v1(repeat('9',64));`)),'ok');
  assert.equal(sql(`select count(*) from public.natori_notification_jobs where notification_key='quote-accepted/${factQuote}';`),'1');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 check('independent: started notification finish persists project/activity effects during hold',()=>{
  assert.equal(sql(asService(`select public.natori_notification_finish_v1('${factMail}','d0000000-0000-4000-8000-000000000100','sent','synthetic-provider-result',null);`)),'t');
  assert.equal(sql(`select count(*) from public.natori_project_activity where project_id='${factProject}' and event_type='delivery_sent';`),'1');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 check('independent: caught fact-body exception restores scope before subsequent caller DML',()=>{
  sql(asService(`do $review$ begin begin perform public.natori_case_reconciliation_v1('${owner}','${project}','save','{"id":"not-a-uuid"}');exception when invalid_text_representation then null;end;begin update public.natori_projects set note='exception frame leak' where id='${project}';raise exception 'unexpected caller write';exception when others then if SQLERRM<>'natori_system_held' then raise;end if;end;end $review$;`));
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 check('independent: pure reconciliation read is READ ONLY-compatible without frame writes',()=>{
  assert.equal(raw(asService(`set transaction read only;select public.natori_case_reconciliation_v1('${owner}','${project}','read','{}');`)).status,0);
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });

 check('independent: fresh review rejects a later valid fact without reopening commands',()=>{
  const old=review();assert.equal(sql(asService(`select public.natori_notification_finish_v1('${sending}','d0000000-0000-4000-8000-000000000002','sent','synthetic-later-result',null);`)),'t');
  const state=status();const r=JSON.parse(sql(asService(`select public.natori_case_system_control_v2('${owner}','resume-commands',${state.generation},'{"kind":"auth-user","userId":"${owner}"}','${old.revision}',true);`)));
  assert.equal(r.result,'review_stale');assert.equal(status().commandsHeld,true);
 });
 check('independent: lease expiry alone invalidates a captured global review',()=>{
  const otherMail='e0000000-0000-4000-8000-000000000110';
  sql(asService(`insert into public.natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,status,snapshot,payload,send_started_at,claim_token,lease_expires_at) values('${otherMail}','hold/other-lease-review','${fixture.ids[10]}','b0000000-0000-4000-8000-000000000011','quote_accept_artist','sending','{}','{}',now(),'d0000000-0000-4000-8000-000000000110',clock_timestamp()+interval '800 milliseconds');`));
  const old=review();sql('select pg_sleep(1.1);');
  const state=status();const r=JSON.parse(sql(asService(`select public.natori_case_system_control_v2('${owner}','resume-commands',${state.generation},'{"kind":"auth-user","userId":"${owner}"}','${old.revision}',true);`)));
  assert.equal(r.result,'review_stale');assert.equal(status().commandsHeld,true);
 });
 check('independent: service has no private schema or body/setter EXECUTE authority',()=>{
  assert.equal(sql(`select has_schema_privilege('service_role','natori_case_guard','USAGE')`),'f');
  assert.equal(sql(`select bool_or(has_function_privilege('service_role',oid,'EXECUTE')) from pg_proc where pronamespace='natori_case_guard'::regnamespace`),'f');
 });
 check('independent: NULL command still acquires shared admission before returning',()=>{
  for(const fn of ['natori_payment_links_v1','natori_case_reconciliation_v1']){
   const lines=sql(`begin;set local role service_role;select public.${fn}('${owner}','${project}',null,'{}');select exists(select 1 from pg_locks where pid=pg_backend_pid() and locktype='advisory' and mode='ShareLock' and granted);rollback;`).split('\n');
   assert.equal(lines.at(-1),'t',fn);
  }
 });

 check('independent: delivery accept validates manifest, saves release/project/activity/intents under hold',()=>{
  const bad=sql(asService(`select result from public.natori_accept_delivery_ready_v1(repeat('e',64),'${issue.release_id}','[]',clock_timestamp());`));assert.equal(bad,'unavailable');
  assert.equal(sql(`select (accepted_at is null)::text from public.natori_delivery_releases where id='${issue.release_id}'`),'true');
  assert.equal(sql(asService(`select result from public.natori_accept_delivery_ready_v1(repeat('e',64),'${issue.release_id}',(select manifest from public.natori_delivery_releases where id='${issue.release_id}'),clock_timestamp());`)),'accepted');
  assert.equal(sql(`select status||'/'||(p.delivery_accepted_at=r.accepted_at and p.completed_at=r.accepted_at)::text from public.natori_projects p join public.natori_delivery_releases r on r.project_id=p.id where p.id='${deliveryProject}'`),'completed/true');
  assert.equal(sql(`select count(*) from public.natori_project_activity where project_id='${deliveryProject}' and event_type='delivery_accepted'`),'1');
  assert.equal(sql(`select count(*) from public.natori_notification_jobs where project_id='${deliveryProject}' and purpose in ('delivery_accept_artist','delivery_accept_client')`),'2');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 check('independent: rough OK validates capability and saves one fact/event/intent under hold',()=>{
  assert.equal(sql(asService(`select result from public.natori_record_rough_ok_v1('${fixture.ids[1]}','${roughId}',repeat('b',64));`)),'not_found');
  assert.equal(sql(asService(`select result from public.natori_record_rough_ok_v1('${fixture.ids[1]}','${roughId}',repeat('a',64));`)),'ok');
  assert.equal(sql(asService(`select result from public.natori_record_rough_ok_v1('${fixture.ids[1]}','${roughId}',repeat('a',64));`)),'already_ok');
  assert.equal(sql(`select count(*) from public.natori_rough_ok_events e join public.natori_talk_roughs r on r.id=e.rough_id and r.client_ok_at=e.client_ok_at where r.id='${roughId}'`),'1');
  assert.equal(sql(`select count(*) from public.natori_notification_jobs where notification_key='rough-ok/${roughId}'`),'1');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 check('independent: late mail event persists exact binding evidence after run expiry with duplicate/conflict fences',()=>{
  const invoke=(event,hash,request,provider)=>JSON.parse(sql(asService(`select public.natori_case_mail_event_v1('${lateRun}','independent-mail-scope','${event}',repeat('${hash}',64),'${lateMail}',repeat('${request}',64),'${provider}','email.sent',clock_timestamp());`)));
  assert.equal(invoke('synthetic-event-1','c','a','synthetic-mail-provider').result,'unmatched');
  assert.equal(invoke('synthetic-event-1','c','b','synthetic-mail-provider').result,'recorded');
  assert.equal(invoke('synthetic-event-1','c','b','synthetic-mail-provider').result,'duplicate');
  assert.equal(invoke('synthetic-event-1','d','b','synthetic-mail-provider').result,'conflict');
  assert.equal(sql(`select count(*) from public.natori_case_mail_events where job_id='${lateMail}'`),'1');
  assert.equal(sql(`select count(*) from public.natori_case_mail_provider_map where job_id='${lateMail}'`),'1');
  assert.equal(sql(`select status from public.natori_notification_jobs where id='${lateMail}'`),'sending');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 check('independent: existing reconciliation lease saves incomplete evidence without confirming or retrying its target',()=>{
  const invoke=token=>JSON.parse(sql(asService(`select public.natori_case_reconciliation_v1('${owner}','${fixture.ids[2]}','save',jsonb_build_object('id','${reconJob}','token',${token===null?'null':`'${token}'`},'generation',${claimed.generation},'evidenceId','90000000-0000-4000-8000-000000000500','facts',jsonb_build_object('state','unknown','source','synthetic_acquisition_failure','limits',jsonb_build_array('incomplete'))));`)));
  assert.equal(invoke(null).result,'stale');
  assert.equal(sql(`select count(*) from public.natori_case_reconciliation_evidence where job_id='${reconJob}'`),'0');
  assert.equal(invoke(reconToken).result,'saved');
  assert.equal(sql(`select state from public.natori_case_reconciliation_jobs where id='${reconJob}'`),'ready');
  assert.equal(sql(`select facts->>'state' from public.natori_case_reconciliation_evidence where job_id='${reconJob}'`),'unknown');
  assert.equal(sql(`select status from public.natori_notification_jobs where id='${reconTarget}'`),'unknown');
  assert.equal(sql(`select count(*) from public.natori_case_reconciliation_resolutions where job_id='${reconJob}'`),'0');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });

 check('independent: review lists pending delivery and exact outstanding upload credential without foreign owner/body/token leakage',()=>{
  const r=review();assert.equal(r.recordsComplete,true);
  assert(r.records.some(x=>x.kind==='delivery-file'&&x.id===pendingDelivery&&x.status==='pending'));
  assert(r.records.some(x=>x.kind==='upload-credential'&&x.id===credentialUpload&&x.unresolved===true));
  assert(!r.records.some(x=>x.projectId===fixture.ids[10]));
  const encoded=JSON.stringify(r.records);for(const value of [credentialIssuer,'合成署名待ち','fixture@example.invalid'])assert(!encoded.includes(value));
 });
 check('independent: held changed-workspace credential finish saves expiry only for the exact pre-stop issuer and suppresses exposure',()=>{
  const input=`jsonb_build_object('fileId','${credentialFile}','expiresAt',clock_timestamp()+interval '1 hour')`;
  assert.equal(JSON.parse(sql(credCall('credential_finish',input,'d0000000-0000-4000-8000-000000000699'))).result,'stale');
  assert.equal(sql(`select credential_issuer::text from public.natori_consultation_uploads where id='${credentialUpload}'`),credentialIssuer);
  const expires=sql(`select (clock_timestamp()+interval '1 hour')::text`);
  const registered=JSON.parse(sql(credCall('credential_finish',`jsonb_build_object('fileId','${credentialFile}','expiresAt','${expires}')`)));
  assert.equal(registered.result,'credential_registered');assert.equal(registered.expose,false);assert.equal(registered.issuer,credentialIssuer);
  assert.equal(sql(`select (credential_expires_at='${expires}'::timestamptz and credential_issuer is null and credential_started_at is null)::text from public.natori_consultation_uploads where id='${credentialUpload}'`),'true');
  assert.equal(sql(`select (signed_expires_at>='${expires}'::timestamptz+interval '5 minutes' and status='reserved')::text from public.natori_consultation_operations where project_id='${credentialProject}' and operation_id='${credentialOp}'`),'true');
  const replay=JSON.parse(sql(credCall('credential_finish',input)));assert.equal(replay.result,'stale');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
  for(const command of ['credential_begin','reserve']){
   const currentGuard=sql(`select jsonb_build_object('title',title,'clientName',client_name,'email',client_email)::text from public.natori_projects where id='${credentialProject}'`);
   const r=raw(asService(`select public.natori_consultation_operation_v1('${credentialProject}','staff','${credentialOp}',repeat('f',64),'${command}','${owner}',null,jsonb_build_object('fileId','${credentialFile}'),'d0000000-0000-4000-8000-000000000699');`));
   // Existing work guards may reject before DML; a successful registration/new admission is forbidden.
   if(r.status===0){const value=JSON.parse(r.stdout.trim());assert(!['credential_started','reserved'].includes(value.result));}else assert.match(r.stderr,/natori_system_held/);
  }
 });

 check('independent: sender-only hold blocks stop renewal, while exact pre-stop completion releases its lease under full hold',()=>{
  const input=(token=stopToken,outcome='inactive')=>`jsonb_build_object('jobId','${stopJob}','token','${token}','generation',1,'outcome','${outcome}')`;
  assert.equal(JSON.parse(sql(asService(`select public.natori_payment_links_v1('${owner}','${stopProject}','finish_stop',${input('d0000000-0000-4000-8000-000000000799')});`))).result,'stale');
  assert.equal(control('resume-commands',status().generation).result,'saved');assert.equal(status().sendersHeld,true);
  const renewed=raw(asService(`select public.natori_payment_links_v1('${owner}','${stopProject}','stop_renew',${input()});`));assert.notEqual(renewed.status,0);assert.match(renewed.stderr,/natori_system_held/);
  assert.equal(control('hold',status().generation).result,'saved');
  assert.equal(JSON.parse(sql(asService(`select public.natori_payment_links_v1('${owner}','${stopProject}','finish_stop',${input()});`))).result,'completed');
  assert.equal(sql(`select status||'/'||(lease_until is null)::text||'/'||(claim_token='${stopToken}'::uuid)::text from public.natori_payment_link_stops where id='${stopJob}'`),'completed/true/true');
  assert.equal(sql(`select state from public.natori_payment_link_attempts where id='${stopAttempt}'`),'inactive');
  assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 });
 report.success=true;
}catch(error){report.success=false;report.error=error.message;process.exitCode=1;console.error(error.message.slice(0,1000));}
finally{
 const inspect=call(['inspect',name]);if(inspect.status===0){assert.equal(JSON.parse(inspect.stdout)[0].Config.Labels['meish.hold'],run);docker(['rm','--force',name]);report.removed=true;}
 writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,removed:report.removed}));
}
