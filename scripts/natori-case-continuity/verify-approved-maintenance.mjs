import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {root} from '../natori-case-local-auth/prepare.mjs';
import {seed} from '../natori-case-payment/fixture.mjs';
const out=resolve(process.argv[2]??'');assert(out.startsWith('/workspace/')||out.startsWith('/tmp/'));mkdirSync(out);
const run='meish-maintenance-'+randomBytes(5).toString('hex'),name=run+'-db';
const report={scope:'approved synthetic receipt retirement and empty fixture-table TRUNCATE only; no purge RPC/alternate route',checks:[],effects:{retiredReceipts:0,notificationPayloadsErased:0,truncateRowsRemoved:0},removed:false};
const call=(args,input)=>spawnSync('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
const docker=(args,input)=>{const r=call(args,input);if(r.status!==0)throw Error(r.stderr||'local Docker failed');return r.stdout.trim();};
const raw=s=>call(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],s);
const sql=s=>{const r=raw(s);if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
const svc=s=>'begin;set local role service_role;'+s+';commit;';
const mark=s=>{report.checks.push(s);console.log(s);};
const owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
try{
 docker(['run','--detach','--pull','never','--network','none','--name',name,'--label','meish.maintenance='+run,'--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=256m','--env','POSTGRES_HOST_AUTH_METHOD=trust','sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f','postgres','-c','listen_addresses=127.0.0.1']);
 for(let n=0;n<80&&raw('select 1').status!==0;n++)await new Promise(r=>setTimeout(r,100));
 const inspect=JSON.parse(docker(['inspect',name]))[0];assert.equal(inspect.HostConfig.NetworkMode,'none');assert.deepEqual(inspect.HostConfig.PortBindings??{},{});assert(inspect.Mounts.every(m=>m.Type==='tmpfs'));
 report.isolation={network:'none',publishedPorts:0,mounts:'tmpfs only',image:inspect.Image};
 sql('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');sql(readFileSync(root+'/scripts/legacy-entry-read-security/fresh-bootstrap.sql','utf8'));
 const files=JSON.parse(readFileSync(root+'/supabase/baseline/manifest.json','utf8')).activeMigrations;assert.equal(files.length,53);for(const f of files)sql(readFileSync(root+'/'+f,'utf8'));
 sql(`insert into auth.users(id) values('${owner}'),('${other}');`);const f=seed(owner,other);sql(f.sql);
 const project=f.ids[0],quote='b0000000-0000-4000-8000-000000000001',op='c9000000-0000-4000-8000-000000000001',attempt='f9000000-0000-4000-8000-000000000001',job='e9000000-0000-4000-8000-000000000001';
 report.target={owner,project,quote,operation:op,attempt,job};
 // Actual function input contains opaque synthetic ciphertext only; no credential or real key.
 for(const [n,p,o] of [[1,project,owner],[2,f.ids[1],owner],[11,f.ids[10],other]]){
  const aid=`f9000000-0000-4000-8000-${String(n).padStart(12,'0')}`,oid=`c9000000-0000-4000-8000-${String(n).padStart(12,'0')}`,q=`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  sql(`insert into natori_payment_link_attempts(id,project_id,owner_id,quote_id,generation,amount,livemode,provider_account_id,state,deadline,price_id,price_started_at,link_started_at,claim_token,claim_generation,lease_until)
   values('${aid}','${p}','${o}','${q}',1,12000,false,'acct_maintenance','creating',now()+interval '3 days','price_Maintenance${n}',now()-interval '24 hours',${n===2?'null':"now()-interval '23 hours 1 second'"},'d9000000-0000-4000-8000-000000000001',1,${n===1?"now()+interval '2 minutes'":'null'});
   insert into natori_payment_link_operations(project_id,operation_id,request_hash,action,attempt_id,expected_revision,status,workspace_guard,workspace_request)
   values('${p}','${oid}',repeat('a',64),'issue','${aid}',1,'pending',jsonb_build_object('quote',jsonb_build_object('id','${q}','version',2,'amount',12000,'acceptedAt',now()),'identity',jsonb_build_object('id','${p}','owner','${o}','metadataHash',repeat('b',64))),jsonb_build_object('format','natori-delivery-aes256gcm-v1','ciphertext','approved-synthetic-receipt','iv','synthetic','tag','synthetic','expiresAt',now()+interval '3 days'));`);
 }
 sql(`insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,status,snapshot,payload,send_started_at) values('${job}','approved-maintenance/unknown','${project}','${quote}','payment_link_client','unknown','{}','{"fixture":"unknown-mail-must-remain"}',now()-interval '1 day');update natori_payment_link_operations set notification_id='${job}' where project_id='${project}' and operation_id='${op}';`);
 const tables=JSON.parse(sql(`select jsonb_agg(relname order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'natori_%' and relname not in ('natori_case_system_holds','natori_case_system_hold_events')`));
 const untouched=()=>sql(`select md5(string_agg(value,'|' order by value)) from (${tables.map(t=>`select '${t}'||coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]') value from public.${t} r ${t==='natori_payment_link_operations'?`where operation_id<>'${op}'`:t==='natori_payment_link_attempts'?`where id<>'${attempt}'`:''}`).join(' union all ')}) t`);
 const rest=untouched(),beforeOp=JSON.parse(sql(`select to_jsonb(o) from natori_payment_link_operations o where operation_id='${op}'`)),beforeAttempt=JSON.parse(sql(`select to_jsonb(a) from natori_payment_link_attempts a where id='${attempt}'`));
 assert.equal(sql(`select count(*) from natori_payment_link_operations o where project_id='${project}' and status='pending' and public.natori_case_payment_receipt_reason_v1('${owner}',project_id,operation_id) is not null`),'1');
 assert.equal(sql(`select count(*) from natori_projects where id='${project}' and user_id='${owner}' and active_quote_id='${quote}'`),'1');
 mark('Isolation/target: fresh network-none/tmpfs normal 53-migration DB; exact owner/project/quote and one eligible old receipt; no production/provider/credentials');
 const retire=()=>JSON.parse(sql(svc(`select natori_case_payment_receipts_retire_v1('${owner}','${project}',1)`)));
 assert.deepEqual(retire(),{retired:0,deferred:1,remaining:1,oldestEligibleAt:JSON.parse(sql(svc(`select natori_case_payment_receipts_retire_v1('${owner}','${project}',1)`))).oldestEligibleAt});
 assert.equal(sql(`select workspace_request is not null from natori_payment_link_operations where operation_id='${op}'`),'t');assert.equal(untouched(),rest);
 mark('Receipt with live lease: deferred, no body erased; known-price/unstarted-link and foreign-owner control receipts unchanged');
 sql(`update natori_payment_link_attempts set lease_until=now()-interval '1 second' where id='${attempt}'`);
 const leaseExpired=JSON.parse(sql(`select to_jsonb(a) from natori_payment_link_attempts a where id='${attempt}'`));
 assert.equal(JSON.parse(sql(svc(`select natori_case_system_control_v1('${owner}','hold',0,'{"kind":"auth-user","userId":"${owner}"}'::jsonb)`))).result,'saved');
 const result=retire();assert.equal(result.retired,1);assert.equal(result.deferred,0);assert.equal(result.remaining,0);report.effects.retiredReceipts=1;
 const afterOp=JSON.parse(sql(`select to_jsonb(o) from natori_payment_link_operations o where operation_id='${op}'`)),afterAttempt=JSON.parse(sql(`select to_jsonb(a) from natori_payment_link_attempts a where id='${attempt}'`));
 assert.equal(afterOp.workspace_request,null);assert.equal(afterOp.status,'pending');assert.equal(afterOp.workspace_guard.receiptRetention.state,'retired');assert.equal(afterOp.workspace_guard.receiptRetention.reason,'link_creation_unresolved');assert.match(afterOp.workspace_guard.receiptRetention.guardHash,/^[a-f0-9]{64}$/);
 for(const k of Object.keys(beforeOp).filter(k=>!['workspace_request','workspace_guard'].includes(k)))assert.deepEqual(afterOp[k],beforeOp[k],k);
 for(const k of Object.keys(leaseExpired).filter(k=>!['state','review_reason','updated_at'].includes(k)))assert.deepEqual(afterAttempt[k],leaseExpired[k],k);
 assert.equal(afterAttempt.state,'needs_review');assert.equal(afterAttempt.review_reason,'idempotency_retention_elapsed');assert.equal(untouched(),rest);
 mark('Exactly one receipt retired under hold: body null, pending operation/request hash/IDs/provider account/price/claim/key inputs and unknown notification retained; only allowed target fields changed');
 for(const command of ['begin','stage','finish'])assert.equal(JSON.parse(sql(svc(`select natori_case_payment_command_v1('${owner}','${project}','${command}','{"operationId":"${op}","receipt":${JSON.stringify(beforeOp.workspace_request)}}'::jsonb)`))).result,'receipt_retired');
 assert.equal(retire().retired,0);assert.equal(untouched(),rest);assert.equal(sql('select count(*) from natori_case_guard.frames'),'0');
 const snapshot=JSON.parse(sql(svc(`select natori_case_payment_snapshot_v1('${owner}','${project}','${op}')`)));assert.equal(snapshot.operation.status,'pending');assert.equal(snapshot.operation.request,null);assert.equal(snapshot.operation.retirementReason,'link_creation_unresolved');
 mark('Retired receipt replay/lookup: old begin/stage/finish refuse; repeat maintenance has zero effects, unknown remains pending and fact frame is restored');
 // Sole TRUNCATE target: a new empty fixture, not a business table or real data.
 sql('create table public.case_maintenance_empty_fixture(id integer);create trigger natori_000_system_lock before insert or update or delete or truncate on public.case_maintenance_empty_fixture for each statement execute function natori_case_guard.statement_guard();');
 assert.equal(sql('select count(*) from public.case_maintenance_empty_fixture'),'0');
 assert.equal(sql("select count(*) from pg_constraint where conrelid='public.case_maintenance_empty_fixture'::regclass or confrelid='public.case_maintenance_empty_fixture'::regclass"),'0');
 assert.equal(sql("select count(*) from pg_inherits where inhrelid='public.case_maintenance_empty_fixture'::regclass or inhparent='public.case_maintenance_empty_fixture'::regclass"),'0');
 assert.equal(sql("select relispartition from pg_class where oid='public.case_maintenance_empty_fixture'::regclass"),'f');
 const held=raw('begin;TRUNCATE ONLY public.case_maintenance_empty_fixture;rollback;');assert.notEqual(held.status,0);assert(held.stderr.includes('natori_system_held'));assert.equal(sql('select count(*) from public.case_maintenance_empty_fixture'),'0');
 mark('TRUNCATE held: exact empty fixture has no FK/inheritance/partition; real statement guard rejects before removal, no CASCADE or identity restart');
 const review=JSON.parse(sql(svc(`select natori_case_system_review_v1('${owner}')`))),generation=review.generation;
 assert.equal(JSON.parse(sql(svc(`select natori_case_system_control_v2('${owner}','resume-commands',${generation},'{"kind":"auth-user","userId":"${owner}"}'::jsonb,'${review.revision}',true)`))).result,'saved');
 const fresh=JSON.parse(sql(svc(`select natori_case_system_review_v1('${owner}')`)));assert.equal(JSON.parse(sql(svc(`select natori_case_system_control_v2('${owner}','resume-senders',${fresh.generation},'{"kind":"auth-user","userId":"${owner}"}'::jsonb,'${fresh.revision}',true)`))).result,'saved');
 assert.equal(raw('begin;TRUNCATE ONLY public.case_maintenance_empty_fixture;rollback;').status,0);assert.equal(sql('select count(*) from public.case_maintenance_empty_fixture'),'0');assert.equal(untouched(),rest);
 mark('TRUNCATE open: same verified-empty fixture succeeds inside ROLLBACK, zero rows removed and business controls unchanged; not a business-table ACL claim');
 report.unrun=['delivery purge RPC and expired notification erasure: gateway route handled separately; no native fallback'];report.success=true;
}catch(error){report.success=false;report.error=error.message;process.exitCode=1;console.error(error.message.slice(0,1500));}
finally{
 try{const found=call(['inspect',name]);if(found.status===0){assert.equal(JSON.parse(found.stdout)[0].Config.Labels['meish.maintenance'],run);docker(['rm','--force',name]);}report.removed=true;}catch(error){report.cleanupError=error.message;process.exitCode=1;}
 writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,effects:report.effects,removed:report.removed}));
}
