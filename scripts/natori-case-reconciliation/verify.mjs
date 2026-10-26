// Isolated evidence for the approved receipt policy and exact formal migrations.
import {spawnSync,spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {schema,seed} from '../natori-case-payment/fixture.mjs';
import {root} from '../natori-case-local-auth/prepare.mjs';
const out=resolve(process.argv[2]??'');assert(out.startsWith('/workspace/')||out.startsWith('/tmp/'));mkdirSync(out);
const run='meish-reconciliation-'+randomBytes(5).toString('hex');
const pinned='sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f';
const report={run,scope:'normal business schema; native SQL reconciliation; Auth/Storage catalog fixtures only',checks:[],containers:[],replay:null};
const call=(args,input)=>spawnSync('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
const docker=(args,input)=>{const r=call(args,input);if(r.status!==0)throw Error(r.stderr||r.error?.message||'docker failed');return r.stdout.trim();};
const literal=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>literal(JSON.stringify(v))+'::jsonb';
const check=(name,condition)=>{assert(condition,name);report.checks.push(name);console.log(name);};
async function pg(label,work){
 const name=run+'-'+label;docker(['run','--detach','--pull','never','--network','none','--name',name,'--label','meish.receipt='+run,'--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=256m','--env','POSTGRES_HOST_AUTH_METHOD=trust',pinned,'postgres','-c','listen_addresses=127.0.0.1']);
 report.containers.push({name,removed:false});
 const raw=text=>call(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-h','127.0.0.1','-U','postgres'],text);
 const sql=text=>{const r=raw(text);if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
 try{let ready=false;for(let n=0;n<80;n++){if(raw('select 1').status===0){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert(ready,'postgres startup');
  const info=JSON.parse(docker(['inspect',name]))[0];assert.equal(info.HostConfig.NetworkMode,'none');assert.deepEqual(info.HostConfig.PortBindings??{},{});assert(info.Mounts.every(m=>m.Type==='tmpfs'));
  await work(sql,raw,name);
 }finally{const info=JSON.parse(docker(['inspect',name]))[0];assert.equal(info.Config.Labels['meish.receipt'],run);docker(['rm','--force',name]);report.containers.find(c=>c.name===name).removed=true;}
}
try {
 await pg('normal',async(sql,raw,name)=>{
  sql('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');
  sql(readFileSync(root+'/scripts/legacy-entry-read-security/fresh-bootstrap.sql','utf8'));
  const manifest=JSON.parse(readFileSync(root+'/supabase/baseline/manifest.json','utf8')),applied=[];
  for(const file of manifest.activeMigrations){sql(readFileSync(root+'/'+file,'utf8'));applied.push(file);}
  report.replay={status:'ddl_applied',applied,platform:'normal business migrations; minimal Auth/Storage catalog fixtures'};
  check('all formal business migrations replay in order without historical edits',applied.length===45);
  const owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
  sql(`insert into auth.users(id) values('${owner}'),('${other}');`);const fixtures=seed(owner,other);sql(fixtures.sql);
  const rpc=(id,cmd,input={},who=owner)=>JSON.parse(sql(`set role service_role;select natori_case_reconciliation_v1('${who}','${id}',${literal(cmd)},${json(input)});reset role;`));
  const writer=(id,cmd,input={})=>JSON.parse(sql(`set role service_role;select natori_payment_links_v1('${owner}','${id}',${literal(cmd)},${json(input)});reset role;`));
  let serial=0;const uid=()=>`c1000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
  const prep=index=>{const id=fixtures.ids[index],op=uid(),token=uid();const begun=writer(id,'begin',{operationId:op,token,hash:'a'.repeat(64),action:'issue',livemode:false,providerAccountId:'acct_r1fixture',deadline:new Date(Date.now()+86400000).toISOString()});assert.equal(begun.result,'claimed');sql(`update natori_payment_link_attempts set lease_until=null,price_started_at=now()-interval '24 hours',state='needs_review' where project_id='${id}';update natori_payment_link_operations set workspace_guard='{"receiptRetention":{"state":"retired"}}',workspace_request=null where project_id='${id}';`);return {id,op,token,a:begun.attempt};};
  const inspect=(p,kind='link')=>{const id=uid(),token=uid(),revision=rpc(p.id,'read').revision;const claim=rpc(p.id,'claim',{id,token,revision,kind,target:p.op,operator:{kind:'auth-user',userId:owner}});assert.equal(claim.result,'claimed');return {id,token,revision,claim};};
  const facts=x=>({state:'confirmed',source:'provider_retrieval',identity:x.claim.identity,checkedAt:new Date().toISOString(),complete:true,limits:[],reference:'plink_r1'+serial,price:'price_r1'+serial,url:'https://buy.stripe.com/r1'+serial,outcome:'active'});
  const save=(p,x,f)=>{const e=uid();assert.equal(rpc(p.id,'save',{id:x.id,token:x.token,generation:x.claim.generation,evidenceId:e,facts:f}).result,'saved');return e;};
  const apply=(p,x,e,r=uid())=>rpc(p.id,'apply',{id:x.id,evidenceId:e,resolutionId:r,operator:{kind:'auth-user',userId:owner}});
  const p=prep(0);const before=sql(`select md5(row_to_json(p)::text) from natori_projects p where id='${p.id}'`);rpc(p.id,'read');rpc(p.id,'read');check('GET/current read has no business mutation or provider effect',before===sql(`select md5(row_to_json(p)::text) from natori_projects p where id='${p.id}'`));
  check('foreign owner sees neither target nor evidence',rpc(p.id,'read',{},other).result==='not_found');
  const x=inspect(p);check('inspection claim fences legacy begin and Cron stop claims',writer(p.id,'begin',{operationId:uid()}).result==='needs_review'&&writer(p.id,'claim_stop',{token:uid()}).result==='busy');
  check('duplicate inspection identity does not reacquire provider work',rpc(p.id,'claim',{id:x.id,token:uid(),revision:x.revision,kind:'link',target:p.op,operator:{kind:'auth-user',userId:owner}}).result==='existing');
  const f=facts(x),e=save(p,x,f),resolution=uid();
  check('positive link evidence applies atomically without completing original operation',apply(p,x,e,resolution).result==='applied'&&sql(`select status||'/'||(reconciliation_id is not null)::text||'/'||(workspace_request is null)::text from natori_payment_link_operations where project_id='${p.id}'`)==='pending/true/true');
  check('lost apply response resolves idempotently under same resolution identity',apply(p,x,e,resolution).result==='applied'&&sql(`select count(*) from natori_case_reconciliation_resolutions where project_id='${p.id}'`)==='1');
  check('another resolution identity cannot apply same evidence twice',apply(p,x,e).result==='conflict');
  check('purged old token remains stopped in legacy writer after positive resolution',writer(p.id,'begin',{operationId:p.op}).result==='needs_review');
  check('resolved exact old preparation permits a fresh confirmation only',writer(p.id,'outbound_gate',{operationId:uid()}).result==='allowed'&&JSON.parse(sql(`select natori_case_payment_snapshot_v1('${owner}','${p.id}')`)).pending===false);
  check('common reader represents resolution without erasing original pending history',sql(`select count(*) from natori_case_snapshot_v1('${p.id}','${owner}') s where s->'sections'->'financial_link_operations'->'rows'->0->'reconciliation'->>'kind'='link_confirmed'`)==='1');
  const neg=prep(1);
  for(const [state,limit] of [['unknown','not_found'],['unknown','history_expired'],['unknown','pagination'],['unknown','multiple'],['mismatch','identity_mismatch']]){const z=inspect(neg),ev=save(neg,z,{...facts(z),state,complete:false,limits:[limit]});check(limit+' never proves failure or permits a fresh operation',apply(neg,z,ev).result==='needs_review'&&writer(neg.id,'outbound_gate',{operationId:uid()}).result==='needs_review');}
  for(const changed of [{account:'acct_other'},{livemode:true},{amount:1},{currency:'usd'},{purpose:'other'},{project:fixtures.ids[0]}]){const z=inspect(neg),ev=save(neg,z,{...facts(z),identity:{...z.claim.identity,...changed}});check('exact identity mismatch rejected '+Object.keys(changed)[0],apply(neg,z,ev).result==='needs_review');}
  const stale=prep(2),sx=inspect(stale),se=save(stale,sx,facts(sx));sql(`update natori_projects set client_email='changed@example.invalid' where id='${stale.id}'`);check('recipient/revision change invalidates previously saved evidence',apply(stale,sx,se).result==='stale');
  const lease=prep(3),lx=inspect(lease);sql(`update natori_case_reconciliation_jobs set lease_until=now()-interval '1 second' where id='${lx.id}'`);check('expired inspection lease cannot save provider result',rpc(lease.id,'save',{id:lx.id,token:lx.token,generation:lx.claim.generation,evidenceId:uid(),facts:facts(lx)}).result==='stale');
  const partial=prep(4),px=inspect(partial,'price'),pe=save(partial,px,{...facts(px),reference:'price_R1partial',outcome:'created'});check('price fact can be recovered without clearing unresolved link operation',apply(partial,px,pe).result==='applied'&&writer(partial.id,'outbound_gate',{operationId:uid()}).result==='needs_review');
  const stop=prep(5),st=inspect(stop,'stop'),ste=save(stop,st,{...facts(st),outcome:'stopped',sessionsSafe:false});check('link inactive alone cannot resolve Checkout Session uncertainty',apply(stop,st,ste).result==='needs_review');
  const stopped=inspect(stop,'stop'),ste2=save(stop,stopped,{...facts(stopped),outcome:'stopped',sessionsSafe:true});check('explicit complete stop evidence settles canonical link independently',apply(stop,stopped,ste2).result==='applied'&&sql(`select state from natori_payment_link_attempts where project_id='${stop.id}'`)==='inactive');
  const contradiction=inspect(stop,'link'),currentLink=JSON.parse(sql(`select row_to_json(a) from natori_payment_link_attempts a where project_id='${stop.id}'`));const contradictionEvidence=save(stop,contradiction,{...facts(contradiction),reference:currentLink.link_id,price:currentLink.price_id,url:currentLink.link_url});check('later active observation cannot silently reactivate a confirmed stopped link',apply(stop,contradiction,contradictionEvidence).result==='needs_review'&&sql(`select state from natori_payment_link_attempts where project_id='${stop.id}'`)==='inactive');
  const mail=prep(6),mid=uid();sql(`insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,payload,status,send_started_at) values('${mid}','r1mail','${mail.id}','${mail.a.quote_id}','payment_link_client','{}','{}','unknown',now()-interval '1 hour')`);
  const mx=inspect({...mail,op:mid},'mail');check('legacy mail account/mode remains missing rather than inferred',mx.claim.identity.account===null&&mx.claim.identity.livemode===null);const me=save(mail,mx,{...facts(mx),reference:'mail_R1',outcome:'accepted',occurredAt:new Date().toISOString()});check('legacy mail cannot be resolved without canonical provider scope',apply(mail,mx,me).result==='needs_review');
  const boundId=uid();sql(`insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,payload,status,send_started_at,provider_scope,provider_livemode) values('${boundId}','r1bound','${mail.id}','${mail.a.quote_id}','payment_link_client','{}','{}','unknown',now()-interval '1 hour','resend_test_fixture',false)`);const bound=inspect({...mail,op:boundId},'mail'),be=save(mail,bound,{...facts(bound),reference:'mail_R1',outcome:'accepted',occurredAt:new Date().toISOString()});check('bound positive mail evidence records provider acceptance only',apply(mail,bound,be).result==='applied'&&sql(`select status||'/'||provider_id from natori_notification_jobs where id='${boundId}'`)==='sent/mail_R1');
  check('mail acceptance does not resolve separate unknown link creation',writer(mail.id,'outbound_gate',{operationId:uid()}).result==='needs_review');
  const m2=uid();sql(`insert into natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,payload,status,send_started_at) values('${m2}','r1another','${p.id}','payment_link_client','{}','{}','unknown',now()-interval '1 hour')`);
  check('another unresolved notice still blocks fresh key after link resolution',writer(p.id,'outbound_gate',{operationId:uid()}).result==='needs_review');
  check('unknown notification cannot retry or claim even within provider key window',sql(`select natori_notification_retry_v1('${m2}','${owner}') is null`) ==='t'&&sql(`select count(*) from natori_notification_claim_v1('${m2}','${uid()}',true)`)==='0');

  const pay=prep(7),pl=inspect(pay),plf=facts(pl),ple=save(pay,pl,plf);assert.equal(apply(pay,pl,ple).result,'applied');
  const payment=inspect(pay,'payment'),paymentFacts={...facts(payment),reference:'cs_R1paid',outcome:'paid',link:plf.reference,paymentIntent:'pi_R1paid'},paymentEvidence=save(pay,payment,paymentFacts);
  check('retrieved paid Session updates canonical money and resolution in one transaction',apply(pay,payment,paymentEvidence).result==='applied'&&sql(`select (payment_confirmed_at is not null)::text from natori_projects where id='${pay.id}'`)==='true');
  check('provider account and ledger platform scope remain distinct',sql(`select stripe_account_scope||'/'||stripe_livemode::text||'/'||stripe_payment_intent_id from natori_payment_transactions where project_id='${pay.id}'`)==='platform/false/pi_R1paid');
  const eventToken=uid(),request={projectId:pay.id,quoteId:pay.a.quote_id,sessionId:'cs_R1paid',amount:12000,currency:'jpy',paymentStatus:'paid',paymentIntentId:'pi_R1paid'};
  const claimed=JSON.parse(sql(`select row_to_json(v) from natori_stripe_event_claim_v1('${owner}','platform',false,'evt_R1late','checkout.session.completed',${json(request)},'${eventToken}') v`));
  const completed=JSON.parse(sql(`select row_to_json(v) from natori_stripe_event_complete_v1('${owner}','platform',false,'evt_R1late','${eventToken}',${claimed.generation}) v`));
  check('late signed-inbox consumer deduplicates retrieved Session with original scope',completed.result==='completed'&&sql(`select count(*) from natori_payment_transactions where project_id='${pay.id}'`)==='1');
  const changedIntent=inspect(pay,'payment'),changedEvidence=save(pay,changedIntent,{...paymentFacts,identity:changedIntent.claim.identity,checkedAt:new Date().toISOString(),paymentIntent:'pi_other'});
  check('known PaymentIntent mismatch cannot overwrite canonical money mapping',apply(pay,changedIntent,changedEvidence).result==='needs_review'&&sql(`select stripe_payment_intent_id from natori_payment_transactions where project_id='${pay.id}'`)==='pi_R1paid');
  const stopRace=prep(8),stopId=uid(),oldToken=uid();
  sql(`insert into natori_payment_link_stops(id,project_id,owner_id,attempt_id,link_id,livemode,reason,status,claim_token,claim_generation,lease_until) values('${stopId}','${stopRace.id}','${owner}','${stopRace.a.id}','plink_R1stoprace',false,'deadline','processing','${oldToken}',2,now()-interval '1 second')`);
  const stopX=inspect(stopRace,'stop'),stopE=save(stopRace,stopX,{...facts(stopX),reference:'plink_R1stoprace',outcome:'stopped',sessionsSafe:true});
  check('complete stop proof settles old stop job and invalidates late worker claim',apply(stopRace,stopX,stopE).result==='applied'&&writer(stopRace.id,'finish_stop',{token:oldToken,generation:2,jobId:stopId,outcome:'retry'}).result==='stale'&&sql(`select status from natori_payment_link_stops where id='${stopId}'`)==='completed');
  const timeout=prep(9),timeoutId=uid(),timeoutToken=uid(),timeoutRev=rpc(timeout.id,'read').revision;
  const timeoutClaim=rpc(timeout.id,'claim',{id:timeoutId,token:timeoutToken,revision:timeoutRev,kind:'stop',mode:'stop',target:timeout.op,operator:{kind:'auth-user',userId:owner}});assert.equal(timeoutClaim.result,'claimed');
  assert.equal(rpc(timeout.id,'save',{id:timeoutId,token:timeoutToken,generation:1,evidenceId:uid(),facts:{...facts({claim:timeoutClaim}),state:'unavailable',complete:false,limits:['provider_unavailable']}}).result,'saved');
  sql(`update natori_case_reconciliation_jobs set lease_until=now()-interval '1 day' where id='${timeoutId}'`);
  check('unknown stop result keeps durable outbound and Cron fence after timeout/lease expiry',writer(timeout.id,'outbound_gate',{operationId:uid()}).result==='needs_review'&&writer(timeout.id,'claim_stop',{token:uid()}).result==='busy');
  check('new stop identity cannot repeat unknown mutation after lease expiry',rpc(timeout.id,'claim',{id:uid(),token:uid(),revision:rpc(timeout.id,'read').revision,kind:'stop',mode:'stop',target:timeout.op,operator:{kind:'auth-user',userId:owner}}).result==='needs_review');
  const pureStop=inspect(timeout,'stop'),pureE=save(timeout,pureStop,{...facts(pureStop),outcome:'stopped',sessionsSafe:true});
  check('explicit read-only stop inspection can resolve unknown mutation without repeating it',apply(timeout,pureStop,pureE).result==='applied'&&writer(timeout.id,'outbound_gate',{operationId:uid()}).result==='allowed');
  check('bound mail provenance cannot be changed after send started',raw(`update natori_notification_jobs set provider_scope='other' where id='${boundId}'`).status!==0);
  const generation=prep(11),gx=inspect(generation),ge=save(generation,gx,facts(gx));sql(`update natori_payment_link_attempts set claim_generation=claim_generation+1 where project_id='${generation.id}'`);check('late claim generation invalidates earlier evidence',apply(generation,gx,ge).result==='stale');
  const nullStart=prep(12);sql(`update natori_payment_link_attempts set price_started_at=null,link_started_at=null where project_id='${nullStart.id}'`);const ns=inspect(nullStart),ne=save(nullStart,ns,{...facts(ns),state:'unknown',complete:false,limits:['not_found']});check('NULL started_at plus empty result is not proof of non-execution',apply(nullStart,ns,ne).result==='needs_review');
  const inbound=prep(13),ix=inspect(inbound),ie=save(inbound,ix,facts(ix));sql(`select natori_confirm_manual_payment('${owner}','${inbound.id}','ラフ提出')`);check('late legitimate incoming payment remains writable and invalidates link evidence',apply(inbound,ix,ie).result==='stale');

  const reOp=uid(),reTok=uid(),reInput={operationId:reOp,token:reTok,hash:'b'.repeat(64),action:'reissue',livemode:false,providerAccountId:'acct_r1fixture',deadline:new Date(Date.now()+86400000).toISOString(),confirmed:true};
  const reBegin=writer(stopRace.id,'begin',reInput);assert.equal(reBegin.result,'claimed');const reSource=writer(stopRace.id,'reissue_source',{operationId:reOp,token:reTok,generation:reBegin.attempt.claim_generation});
  sql(`update natori_payment_link_attempts set lease_until=null where id='${reBegin.attempt.id}'`);const reAgain=writer(stopRace.id,'begin',reInput),reSourceAgain=writer(stopRace.id,'reissue_source',{operationId:reOp,token:reTok,generation:reAgain.attempt.claim_generation});
  check('reissue recovery pins previous generation instead of newest creating context',reSource.attempt.id===stopRace.a.id&&reSourceAgain.attempt.id===stopRace.a.id);
  const concurrent=prep(14),cx=inspect(concurrent),ce=save(concurrent,cx,facts(cx)),cr=uid();
  const worker=spawn('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],{stdio:['pipe','pipe','pipe']});
  const held=new Promise(resolve=>worker.stdout.once('data',resolve)),finished=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('close',code=>code===0?resolve():reject(Error('concurrent apply worker failed')));});worker.stderr.resume();
  worker.stdin.end(`begin;set role service_role;select natori_case_reconciliation_v1('${owner}','${concurrent.id}','apply',${json({id:cx.id,evidenceId:ce,resolutionId:cr,operator:{kind:'auth-user',userId:owner}})});select pg_sleep(1);commit;`);await held;
  const same=apply(concurrent,cx,ce,cr);await finished;
  check('concurrent same-resolution apply waits for project fence and commits once',same.result==='applied'&&sql(`select count(*) from natori_case_reconciliation_resolutions where project_id='${concurrent.id}'`)==='1');
  const oldLog=raw(`insert into natori_order_mail_logs(project_id,kind,to_email,amount,request_id,status,subject,body_snapshot) values('${concurrent.id}','payment','synthetic@example.invalid',12000,'${uid()}','pending','synthetic','synthetic')`);
  check('legacy mail durable gate rejects generation projects before transport even after flag rollback',oldLog.status!==0&&oldLog.stderr.includes('generation_payment_mail_writer_required'));

  const sendId=uid(),sendToken=uid();sql(`insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot) select '${sendId}','r1-send-fence',project_id,quote_id,'payment_link_client',jsonb_build_object('attemptId',id,'generation',generation,'deadline',deadline) from natori_payment_link_attempts where project_id='${concurrent.id}'`);
  check('normal payment outbox still claims and acquires the current canonical mail gate',sql(`select count(*) from natori_notification_claim_v1('${sendId}','${sendToken}',true)`)==='1'&&writer(concurrent.id,'mail_gate',{jobId:sendId,token:sendToken}).result==='allowed');
  sql(`select natori_confirm_manual_payment('${owner}','${concurrent.id}','ラフ提出')`);
  check('mail start rechecks newly recorded payment after prior mail gate',sql(`select count(*) from natori_notification_start_v1('${sendId}','${sendToken}','{}')`)==='0');
  const deliveryId=uid(),deliveryToken=uid();sql(`insert into natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,payload,status,send_started_at,claim_token,lease_expires_at) values('${deliveryId}','r1-delivery-regression','${concurrent.id}','delivery_issue_client','{}',jsonb_build_object('format','natori-delivery-aes256gcm-v1','ciphertext','synthetic-opaque','expiresAt',now()+interval '1 day'),'sending',now(),'${deliveryToken}',now()+interval '1 minute')`);
  check('unrelated delivery notification finish retains canonical delivered_mail_at effect',sql(`select natori_notification_finish_v1('${deliveryId}','${deliveryToken}','sent','mail_delivery_fixture')`)==='t'&&sql(`select delivered_mail_at is not null from natori_projects where id='${concurrent.id}'`)==='t');

  const wsId=fixtures.ids[15],wsOp=uid(),wsTok=uid();const wsSnap=JSON.parse(sql(`select natori_case_payment_snapshot_v1('${owner}','${wsId}')`));
  const {status:_status,paidAt:_paid,deletedAt:_deleted,legacyLink:_legacy,title,clientName,email,...wsIdentity}=wsSnap.project;
  const wsGuard={quote:wsSnap.quote,identity:{...wsIdentity,metadataHash:createHash('sha256').update([title,clientName,email??''].map(v=>Buffer.byteLength(v)+':'+v).join('')).digest('hex')},link:wsSnap.link,notices:[],legacyCount:0};
  const ws=(command,input)=>JSON.parse(sql(`set role service_role;select natori_case_payment_command_v1('${owner}','${wsId}',${literal(command)},${json(input)});reset role;`));
  const wb=ws('begin',{operationId:wsOp,token:wsTok,hash:'a'.repeat(64),action:'issue',livemode:false,providerAccountId:'acct_r1fixture',deadline:new Date(Date.now()+86400000).toISOString(),guard:wsGuard,receipt:{fixture:'synthetic opaque encrypted boundary'}});assert.equal(wb.result,'claimed');
  sql(`select natori_confirm_manual_payment('${owner}','${wsId}','ラフ提出');update natori_projects set client_email='changed@example.invalid' where id='${wsId}'`);
  const fence={operationId:wsOp,token:wsTok,generation:wb.attempt.claim_generation,guard:wsGuard};
  check('workspace wrapper retains late known price after incoming payment/recipient change',ws('stage',{...fence,stage:'price',value:{id:'price_R1late'}}).result==='saved');
  check('workspace wrapper retains late link and atomically queues terminal stop',ws('stage',{...fence,stage:'link',value:{id:'plink_R1late',url:'https://buy.stripe.com/R1late'}}).result==='saved'&&sql(`select state from natori_payment_link_attempts where project_id='${wsId}'`)==='stop_required'&&sql(`select count(*) from natori_payment_link_stops where project_id='${wsId}'`)==='1');
  check('late-positive exception still rejects new external stage, finish and wrong fence',ws('stage',{...fence,stage:'link_start'}).result==='confirmation_stale'&&ws('finish',fence).result==='confirmation_stale'&&ws('stage',{...fence,generation:999,stage:'price',value:{id:'price_wrong'}}).result==='stale');
  const immutable=raw(`update natori_case_reconciliation_evidence set facts='{}' where id='${e}'`);check('evidence history is append-only',immutable.status!==0&&immutable.stderr.includes('reconciliation_history_immutable'));
  check('R1 RPCs are invoker, empty search path and service-only execute',sql("select bool_and(not prosecdef and proconfig=ARRAY['search_path=\"\"']::text[] and has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE') and not exists(select 1 from aclexplode(proacl) where grantee=0 and privilege_type='EXECUTE')) from pg_proc where proname in ('natori_case_reconciliation_v1','natori_case_reconciliation_revision_v1','natori_case_reconciliation_identity_v1','natori_case_outbound_blocked_v1')")==='t');
 });report.success=true;
}catch(error){report.success=false;report.error=error.message;process.exitCode=1;console.error(error.message.slice(0,2500));}
finally{writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,allOwnedContainersRemoved:report.containers.every(c=>c.removed)}));}
