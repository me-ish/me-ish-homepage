import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {root} from '../natori-case-local-auth/prepare.mjs';
import {seed} from '../natori-case-payment/fixture.mjs';
const out=resolve(process.argv[2]??'');assert(out.startsWith('/workspace/')||out.startsWith('/tmp/'));mkdirSync(out);
const run='meish-case-hold-'+randomBytes(5).toString('hex'),name=run+'-db';
const report={scope:'normal business schema; synthetic SQL only; Auth/Storage catalog fixtures; no providers',checks:[],removed:false};
const call=(args,input)=>spawnSync('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
const docker=(args,input)=>{const r=call(args,input);if(r.status!==0)throw Error(r.stderr||'docker failed');return r.stdout.trim();};
const raw=s=>call(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],s);
const sql=s=>{const r=raw(s);if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
const check=(label,fn)=>{fn();report.checks.push(label);console.log(label);};
const owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const asService=s=>'begin;set local role service_role;'+s+'commit;';
const status=(o=owner)=>JSON.parse(sql(asService(`select natori_case_system_status_v1('${o}')`)));
const control=(action,g,actor={kind:'auth-user',userId:owner})=>JSON.parse(sql(asService(`select natori_case_system_control_v1('${owner}','${action}',${g},'${JSON.stringify(actor)}'::jsonb);`)));
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
 const business=()=>sql(`select md5(string_agg(value,'|' order by value)) from (${tables.map(t=>`select '${t}'||coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]') value from public.${t} r`).join(' union all ')}) t`);const before=business();
 writeFileSync(out+'/catalog.json',sql(`select jsonb_agg(jsonb_build_object('oid',p.oid,'name',p.proname,'signature',p.oid::regprocedure::text,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'acl',p.proacl,'source',p.prosrc,'language',l.lanname,'volatility',p.provolatile,'config',p.proconfig) order by p.proname) from pg_proc p join pg_language l on l.oid=p.prolang where p.pronamespace='public'::regnamespace and p.proname like 'natori_%'`));
 check('normal migration replay succeeds with no business backfill',()=>{assert.equal(migrations.length,51);assert.equal(status().armed,false);});
 check('status remains a pure READ ONLY RPC, with exact owner and no data writes',()=>{assert.equal(raw(asService('set transaction read only;'+`select natori_case_system_status_v1('${owner}');`)).status,0);assert.equal(business(),before);});
 check('empty/invalid actor and stale generation cannot hold or resume; actor identity does not select the owner',()=>{assert.equal(control('hold',0,{}).result,'invalid_request');assert.equal(control('hold',0,{kind:'auth-user',userId:'invalid'}).result,'invalid_request');assert.equal(control('hold',1).result,'stale');assert.equal(status().armed,false);});
 check('hold is persisted, owner-isolated, CAS-audited and does not settle unknown results',()=>{assert.equal(control('hold',0).result,'saved');assert.equal(status().commandsHeld,true);assert.equal(status().sendersHeld,true);assert.equal(status(other).armed,false);assert.equal(business(),before);assert.equal(control('hold',0).result,'stale');});
 check('command/sender admission closes while the unknown/operation rows are unchanged',()=>{for(const kind of ['command','sender','legacy-sender'])assert.equal(sql(asService(`select natori_case_system_admit_v1('${owner}','${kind}');`)),'f');assert.equal(sql(asService(`select natori_case_system_admit_v1('${other}','command');`)),'t');});
 check('NULL/unknown admission kinds and non-READ-COMMITTED transactions fail closed',()=>{
  assert.equal(sql(asService(`select natori_case_system_admit_v1('${other}',null);`)),'f');
  assert.equal(sql(asService(`select natori_case_system_admit_v1('${other}','invalid');`)),'f');
  for(const isolation of ['repeatable read','serializable'])assert.equal(sql(`begin isolation level ${isolation};set local role service_role;select natori_case_system_admit_v1('${other}','command');commit;`),'f');
  for(const isolation of ['repeatable read','serializable'])assert.equal(JSON.parse(sql(`begin isolation level ${isolation};set local role service_role;select natori_case_system_control_v1('${owner}','resume-commands',1,'{"kind":"auth-user","userId":"${owner}"}'::jsonb);commit;`)).result,'invalid_request');
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
 report.success=true;
}catch(error){report.success=false;report.error=error.message;process.exitCode=1;console.error(error.message.slice(0,1000));}
finally{
 const inspect=call(['inspect',name]);if(inspect.status===0){assert.equal(JSON.parse(inspect.stdout)[0].Config.Labels['meish.hold'],run);docker(['rm','--force',name]);report.removed=true;}
 writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,removed:report.removed}));
}
