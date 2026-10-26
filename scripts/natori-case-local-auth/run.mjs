import {spawnSync,spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync,existsSync} from 'node:fs';
import {createServer,request as httpRequest,Agent} from 'node:http';
import {Duplex} from 'node:stream';
import net from 'node:net';
import {randomBytes,createHmac,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {prepare,buildBrowserBootstrap,root} from './prepare.mjs';
import {seedSql,literal} from './seed.mjs';
import {checkBrowser} from './verify-browser.mjs';
import {schema as paymentSchema,seed as paymentSeed} from '../natori-case-payment/fixture.mjs';
import {checkReconciliationBrowser} from '../natori-case-reconciliation/verify-browser.mjs';
import {storageDouble} from '../natori-case-work/storage-double.mjs';
import {checkWorkBrowser} from '../natori-case-work/verify-browser.mjs';
import {checkPaymentBrowser} from '../natori-case-payment/verify.mjs';
import {maintenancePurgeAllowed} from '../natori-case-continuity/maintenance-gateway.mjs';
const maintenanceOnly=process.argv.includes('--maintenance-only');
if(maintenanceOnly&&(!process.argv.includes('--normal-schema')||!process.argv.includes('--payment')||['--acceptance','--work','--reconciliation','--administration','--entry-preview','--hold-only','--events-only','--production-build'].some(v=>process.argv.includes(v))))throw Error('maintenance requires dedicated normal-schema/payment gateway only');
const acceptance=process.argv.includes('--acceptance');
const eventsOnly=process.argv.includes('--events-only');
if(eventsOnly&&(!acceptance||!process.argv.includes('--normal-schema')||!process.argv.includes('--payment')||process.argv.includes('--work')||process.argv.includes('--reconciliation')))throw Error('events-only requires dedicated acceptance normal-schema payment fixture');
const administration=process.argv.includes('--administration');
const holdOnly=process.argv.includes('--hold-only');
const continuityOnly=process.argv.includes('--continuity-only'),scaleOnly=process.argv.includes('--scale-only');
if((continuityOnly||scaleOnly)&&!administration)throw Error('focused continuity/scale requires administration');
if(continuityOnly&&scaleOnly)throw Error('one focused mode at a time');
const historyOnly=process.argv.includes('--history-only');if(historyOnly&&!administration)throw Error('history-only requires administration');
const screenOnly=process.argv.includes('--screen-only');if(screenOnly&&!administration)throw Error('screen-only requires administration');
const entryPreview=process.argv.includes('--entry-preview');
const entryReadOnly=process.argv.includes('--entry-read-only');if(entryReadOnly&&!entryPreview)throw Error('entry-read-only requires entry-preview');
const productionBuild=process.argv.includes('--production-build');if(productionBuild&&!acceptance)throw Error('production-build test requires explicit acceptance target');
const work=process.argv.includes('--work');const storage=work?storageDouble():null;
const payment=process.argv.includes('--payment');
const noMail=process.argv.includes('--no-mail');
const reconciliation=process.argv.includes('--reconciliation');
const normal=process.argv.includes('--normal-schema');if(work&&(!normal||!payment))throw Error('R2 acceptance requires normal-schema payment harness');if(reconciliation&&(!normal||!payment))throw Error('R1 acceptance requires existing normal-schema payment harness');if(normal&&!payment)throw Error('normal schema acceptance requires payment fixtures');
if(noMail&&(!acceptance||!normal||!payment||!work||administration||entryPreview||reconciliation||productionBuild))throw Error('no-mail requires dedicated acceptance/normal-schema/payment/work mode');
if(holdOnly&&(!normal||!payment||administration||entryPreview||acceptance||work||reconciliation||productionBuild))throw Error('hold-only requires dedicated normal-schema/payment mode');
if(administration&&(!normal||!payment||acceptance||entryPreview||work||reconciliation||productionBuild))throw Error('administration requires its dedicated normal-schema/payment mode');
if(entryPreview&&(!normal||!payment||acceptance||work||reconciliation||productionBuild))throw Error('entry-preview requires its dedicated normal-schema/payment read-only browser mode');

const out=resolve(process.argv[2]??'');
if(!out.startsWith('/workspace/')&&!out.startsWith('/tmp/'))throw Error('new local output directory required');
mkdirSync(out); // Refuse to overwrite another run or its evidence.
const run='meish-local-auth-'+randomBytes(5).toString('hex');
const names={db:run+'-db',auth:run+'-auth',rest:run+'-rest'};
const images={db:'sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f',
 auth:'supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
 rest:'postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf'};
const api='http://localhost:4193',appUrl='http://localhost:4195';
const encryptionKey=randomBytes(32).toString('hex');
const secret=randomBytes(48).toString('hex'),dbPassword=randomBytes(24).toString('hex'),password=randomBytes(24).toString('hex'),sharedKey=randomBytes(24).toString('hex');
const jwt=role=>{const body=Buffer.from(JSON.stringify({role,aud:'authenticated',iss:'local-case-acceptance',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');const start=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+body;return start+'.'+createHmac('sha256',secret).update(start).digest('base64url');};
const anon=jwt('anon'),service=jwt('service_role'),privateValues=[encryptionKey,secret,dbPassword,password,sharedKey,anon,service];
const redact=value=>privateValues.reduce((text,value)=>text.replaceAll(value,'[local credential redacted]'),String(value)).replace(/(?:set-)?cookie: [^\r\n]+/gi,'cookie: [redacted]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[JWT redacted]');
const checks=[],requests=[],containers=[],relays=new Set();let gateway,next,logFd,browserResult,scaleFault;
const check=label=>{checks.push(label);console.log(label);};
const docker=(args,input)=>{
 const result=spawnSync('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
 if(result.status!==0)throw Error(redact(result.stderr||result.error?.message||'Docker operation failed'));
 return (result.stdout+(args[0]==='logs'?result.stderr:'')).trim();
};
const sql=text=>docker(['exec','-i',names.db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','postgres','-d','case_acceptance'],text);
const wait=ms=>new Promise(done=>setTimeout(done,ms));
async function ready(test,label){for(let attempt=0;attempt<80;attempt++){try{if(await test())return;}catch{}await wait(250);}throw Error(label+' did not become ready');}
const ownedContainer=name=>{const info=JSON.parse(docker(['inspect',name]))[0];assert.equal(info.Config.Labels['meish.local-auth'],run);return info;};
const runContainer=(kind,extra)=>{docker(['run','--detach','--pull','never','--name',names[kind],'--network',kind==='db'?'none':'container:'+names.db,'--label','meish.local-auth='+run,'--memory',kind==='db'?'512m':'256m','--cpus','1',...extra]);containers.push(names[kind]);};
// Actual HTTP bytes through a local Docker exec stream. Both servers and DB
// share one network-none namespace; there is no host port mapping or egress.
function backendRequest(kind,options,callback) {
 const child=spawn('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock','exec','-i',names.auth,'nc','127.0.0.1',kind==='auth'?'9999':'3000'],{env:{PATH:process.env.PATH,LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
 relays.add(child);child.stderr.resume();
 const socket=Duplex.from({writable:child.stdin,readable:child.stdout});
 socket.setKeepAlive=()=>socket;socket.setNoDelay=()=>socket;socket.setTimeout=()=>socket;
 socket.on('close',()=>{if(child.exitCode===null)child.kill('SIGTERM');});
 child.on('error',error=>socket.destroy(error));child.on('exit',code=>{relays.delete(child);if(code)socket.destroy(Error('local backend connection failed'));});
 const agent=new Agent({keepAlive:false});agent.createConnection=()=>socket;
 return httpRequest({hostname:'127.0.0.1',port:kind==='auth'?9999:3000,agent,...options},callback);
}
const backendHealth=(kind,path)=>new Promise((done,reject)=>{const req=backendRequest(kind,{path,method:'GET'},res=>{res.resume();res.on('end',()=>done(res.statusCode<500));});req.on('error',reject);req.end();});
const checksum=()=>sql(`SELECT md5(string_agg(v,'|' ORDER BY v)) FROM (${[...readFileSync(root+'/scripts/natori-case-app-read/fixture-schema.sql','utf8').matchAll(/create table (natori_[a-z_]+)/g)].map(([,t])=>`SELECT '${t}'||COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text)::text,'[]') v FROM public.${t} r`).join(' UNION ALL ')}) rows;`);
try{
 for(const port of [4193,4195])await new Promise((done,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(done));});
 for(const image of Object.values(images))docker(['image','inspect',image]);
 const {app,envelopes}=await prepare(out);
 if((reconciliation||continuityOnly)&&!acceptance){writeFileSync(app+'/src/features/natori/server/caseReconciliationProvider.ts',readFileSync(root+'/scripts/natori-case-reconciliation/provider-fixture.ts','utf8').replace('../../src/features/natori/lib/caseReconciliation','../lib/caseReconciliation'));const proof=JSON.parse(readFileSync(out+'/preparation.json','utf8'));proof.substitutions.push('R1 provider factory only: deterministic local fixture, no SDK or network; all R1 service/API/UI/DB code unchanged');writeFileSync(out+'/preparation.json',JSON.stringify(proof,null,2));}
 if(payment){const path=app+'/next.config.mjs';writeFileSync(path,readFileSync(path,'utf8').replace('export default withNextIntl(nextConfig);',"nextConfig.serverExternalPackages=[...(nextConfig.serverExternalPackages??[]),'stripe'];nextConfig.experimental={...nextConfig.experimental,esmExternals:false};export default withNextIntl(nextConfig);"));}
 check('Preparation: full tracked app copied without .env files; middleware/auth/read sources byte-identical');
 runContainer('db',['--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=256m','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=case_acceptance',images.db,'postgres','-c','listen_addresses=127.0.0.1',...(scaleOnly?['-c','shared_preload_libraries=pg_stat_statements','-c','pg_stat_statements.track=all']:[])]);
 await ready(()=>{sql('SELECT 1');return true;},'PostgreSQL');
 if(scaleOnly)sql('create extension pg_stat_statements;');
 sql(`CREATE ROLE supabase_auth_admin LOGIN PASSWORD ${literal(dbPassword)};
  CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
  CREATE SCHEMA extensions;CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
  GRANT USAGE ON SCHEMA public,extensions TO supabase_auth_admin;
  ALTER ROLE supabase_auth_admin SET search_path=auth,public,extensions;`);
 runContainer('auth',['--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=16m','--cap-drop','ALL','--security-opt','no-new-privileges',
  '--env','GOTRUE_API_HOST=127.0.0.1','--env','GOTRUE_API_PORT=9999','--env','API_EXTERNAL_URL='+api+'/auth/v1',
  '--env','GOTRUE_DB_DRIVER=postgres','--env',`GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${dbPassword}@127.0.0.1:5432/case_acceptance`,
  '--env','GOTRUE_DB_NAMESPACE=auth','--env','GOTRUE_SITE_URL='+appUrl,'--env','GOTRUE_URI_ALLOW_LIST='+appUrl+'/**',
  '--env','GOTRUE_DISABLE_SIGNUP=true','--env','GOTRUE_EXTERNAL_EMAIL_ENABLED=true','--env','GOTRUE_MAILER_AUTOCONFIRM=true',
  '--env','GOTRUE_EXTERNAL_PHONE_ENABLED=false','--env','GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false','--env','GOTRUE_JWT_SECRET='+secret,
  '--env','GOTRUE_JWT_EXP='+(acceptance||entryPreview||administration||holdOnly?'3600':'30'),'--env','GOTRUE_JWT_AUD=authenticated','--env','GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated','--env','GOTRUE_JWT_ADMIN_ROLES=service_role',
  '--env','GOTRUE_JWT_ISSUER='+api+'/auth/v1','--env','GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true','--env','GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10',
  '--env','GOTRUE_SMTP_HOST=127.0.0.1','--env','GOTRUE_SMTP_PORT=1','--env','GOTRUE_SMTP_ADMIN_EMAIL=disabled@example.invalid',images.auth]);
 await ready(()=>backendHealth('auth','/health'),'GoTrue');
 check('Auth: actual pinned GoTrue started and ran its own Auth-schema migrations; no provider or SMTP service available');
 const replay=[];
 if(normal){
  sql('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');
  // GoTrue owns its actual users/uid/email objects; only Storage catalog is substituted.
  const platform=readFileSync(root+'/scripts/legacy-entry-read-security/fresh-bootstrap.sql','utf8').replace('CREATE SCHEMA auth;','').replace('CREATE TABLE auth.users (id uuid PRIMARY KEY);','').replace(/CREATE FUNCTION auth\.(?:uid|email)\(\)[\s\S]*?\$\$;/g,'');sql(platform);
  for(const file of JSON.parse(readFileSync(root+'/supabase/baseline/manifest.json','utf8')).activeMigrations){const source=readFileSync(root+'/'+file,'utf8');sql(source);replay.push({file,sha256:createHash('sha256').update(source).digest('hex')});}
  writeFileSync(out+'/normal-schema-replay.json',JSON.stringify({applied:replay,auth:'real GoTrue schema',storage:'minimal catalog fixture; Storage service not exercised'},null,2));
  check('Normal business schema: all formal migrations applied in order, real Auth schema; Storage catalog remains a fixture');
 }else sql(payment?paymentSchema():readFileSync(root+'/scripts/natori-case-app-read/fixture-schema.sql','utf8'));
 sql(`CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD ${literal(dbPassword)};GRANT anon,authenticated,service_role TO authenticator;
  CREATE TABLE public.admin_emails(email text PRIMARY KEY);ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.admin_emails TO service_role;`);
 const migrationPath=root+'/supabase/migrations/20261020224935_natori_case_workspace_read.sql',migration=readFileSync(migrationPath,'utf8');
 if(!normal)sql(migration);writeFileSync(out+'/applied-migration.sql',migration);
 runContainer('rest',['--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
  '--env',`PGRST_DB_URI=postgres://authenticator:${dbPassword}@127.0.0.1:5432/case_acceptance`,'--env','PGRST_SERVER_HOST=127.0.0.1','--env','PGRST_DB_SCHEMAS=public','--env','PGRST_DB_ANON_ROLE=anon',
  '--env','PGRST_DB_CONFIG=false','--env','PGRST_JWT_SECRET='+secret,'--env','PGRST_JWT_AUD=authenticated',images.rest]);
 await ready(()=>backendHealth('rest','/'),'PostgREST');
 for(const name of containers){const info=ownedContainer(name);assert.deepEqual(info.HostConfig.PortBindings??{},{});assert(info.Mounts.every(m=>m.Type==='tmpfs'));assert(info.HostConfig.NetworkMode==='none'||info.HostConfig.NetworkMode.startsWith('container:'));}
 writeFileSync(out+'/isolation.json',JSON.stringify({run,images,network:'one shared network-none namespace, no external interface',hostBindings:'none on containers; gateway and app bind 127.0.0.1 only',transport:'Docker exec nc passes actual HTTP bytes; custom local gateway, not hosted Kong/Envoy',mounts:'tmpfs only; no host mounts',application:'full tracked source in local copy; no original environment files'},null,2));

 gateway=createServer((req,res)=>{
  const url=new URL(req.url,api),auth=url.pathname.startsWith('/auth/v1/'),rest=url.pathname.startsWith('/rest/v1/');
  const metric={method:req.method,path:url.pathname,grantType:url.searchParams.get('grant_type')??undefined};requests.push(metric);
  const started=performance.now();let responseBytes=0;res.on('finish',()=>{if(maintenanceOnly)metric.status=res.statusCode;if(scaleOnly){metric.milliseconds=performance.now()-started;metric.responseBytes=responseBytes;metric.status=res.statusCode;}});
  res.setHeader('Access-Control-Allow-Origin',appUrl);res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-signature,tus-resumable,upload-length,upload-offset,upload-metadata,upload-concat,x-upsert');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Cache-Control','no-store');
  const deny=(status,message)=>{if(res.writableEnded)return;if(res.headersSent){res.destroy();return;}res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({message}));};
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(storage&&url.pathname.startsWith('/storage/v1/')&&([anon,service].includes(req.headers.apikey)||url.pathname.startsWith('/storage/v1/object/sign/')&&req.method==='GET'||url.pathname.startsWith('/storage/v1/upload/resumable')&&req.headers['x-signature'])){void storage(req,res);return;}
  if(![anon,service].includes(req.headers.apikey))return deny(403,'local gateway key required');
  if(!auth&&!rest)return deny(404,'local endpoints only');
  const suffix=url.pathname.slice(auth?'/auth/v1'.length:'/rest/v1'.length);
  if(auth&&!/^\/(?:health|token|user|logout|admin\/users(?:\/[0-9a-f-]+)?)$/.test(suffix))return deny(403,'provider and email routes disabled in isolation');
  // Admission is a separate fixed endpoint. The legacy business allowlists,
  // remain unchanged; the approved maintenance exception below is exact and mode-bound.
  const admission=payment&&req.headers.apikey===service&&req.method==='POST'&&(suffix==='/rpc/natori_case_system_admit_v1'||((holdOnly||noMail)&&suffix==='/rpc/natori_case_system_control_v2'));
  const stripeFactAdmission=noMail&&req.headers.apikey===service&&req.method==='POST'&&/^\/rpc\/natori_stripe_event_(?:claim|complete)_v1$/.test(suffix);
  const eventAdmission=eventsOnly&&req.headers.apikey===service&&suffix==='/natori_events'&&['POST','PATCH','DELETE'].includes(req.method);
  const maintenanceAdmission=maintenancePurgeAllowed({maintenanceOnly,normal,payment,method:req.method,suffix,query:url.search,apiKey:req.headers.apikey,authorization:req.headers.authorization,serviceKey:service});
  if(rest&&!admission&&!stripeFactAdmission&&!eventAdmission&&!maintenanceAdmission&&!['GET','HEAD'].includes(req.method)&&!(administration&&req.headers.apikey===service&&req.method==='POST'&&/^\/rpc\/natori_(?:quote_issue_recovery_v1|case_admin_replay_v1|case_admin_command_v1|case_context_command_v1|case_issue_quote_v1|case_renotify_quote_v1|save_estimate_draft_v1|case_work_command_v1)$/.test(suffix))&&!(administration&&req.headers.apikey===service&&((suffix==='/natori_user_profiles'&&req.method==='POST')||(suffix==='/natori_pricing_configs'&&['POST','PATCH'].includes(req.method))))&&!(entryPreview&&!entryReadOnly&&req.headers.apikey===service&&suffix==='/natori_events'&&['POST','PATCH','DELETE'].includes(req.method))&&!(work&&req.headers.apikey===service&&(/^\/rpc\/natori_(?:case_work_command_v1|case_delivery_v1|rough_ok_list_v1|case_consultation_operation_v1|consultation_operation_v1|delivery_(?:reserve|finalize|purge_payloads)_v1|record_rough_ok_v1|acknowledge_rough_ok_v1|retry_rough_ok_notification_v1|accept_delivery_ready_v1)$/.test(suffix)||suffix==='/natori_talk_roughs'))&&!(payment&&req.method==='POST'&&/^\/rpc\/natori_(?:case_reconciliation_v1|case_payment_command_v1|case_payment_receipts_retire_v1|case_acceptance_(?:context|mail|send)_v1|case_mail_(?:event|evidence)_v1|notification_(?:claim|start|finish|retry)_v1)$/.test(suffix)))return deny(405,'local operation not allowlisted');
  if(scaleOnly&&scaleFault&&suffix==='/rpc/natori_case_entry_page_v1'&&url.searchParams.get('p_kind')==='events'&&url.searchParams.get('p_offset')==='50'){
   const fault=scaleFault;scaleFault=null;
   if(fault==='unavailable')return deny(503,'synthetic later-page outage');
   if(fault==='changed')sql(`update natori_events set note='synthetic revision change' where id=(select id from natori_events where user_id='${owner}' order by id limit 1)`);
  }
  const headers={...req.headers,host:'127.0.0.1',connection:'close'};
  const proxy=backendRequest(auth?'auth':'rest',{path:suffix+url.search,method:req.method,headers},upstream=>{
   res.writeHead(upstream.statusCode??502,{...upstream.headers,'Access-Control-Allow-Origin':appUrl,'Access-Control-Allow-Credentials':'true'});upstream.on('error',()=>res.destroy());if(scaleOnly)upstream.on('data',chunk=>{responseBytes+=chunk.length;});upstream.pipe(res);
  });
  proxy.on('error',()=>deny(502,'local backend unavailable'));req.pipe(proxy);
 });
 await new Promise((done,reject)=>{gateway.once('error',reject);gateway.listen(4193,'127.0.0.1',done);});
 const admin=async(path,body)=>{const r=await fetch(api+'/auth/v1'+path,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.ok,true,'local Auth admin request failed: '+r.status);return r.json();};
 const users={};for(const kind of ['owner','staff','outsider'])users[kind]=await admin('/admin/users',{email:kind+'@example.invalid',password,email_confirm:true});
 const owner=users.owner.id,other=users.outsider.id;assert(owner&&other&&users.staff.id!==owner);
 const seed=payment?paymentSeed(owner,other):seedSql(envelopes,owner,other);sql(seed.sql);const initialChecksum=checksum();
 const acceptanceRun='88888888-8888-4888-8888-888888888888',acceptanceSecret='whsec_'+Buffer.from('synthetic-webhook-fixture-key-only').toString('base64');
 const acceptanceTarget=JSON.stringify({profile:'local',ref:'local',project:'local-fixture',url:api,origin:appUrl,run:acceptanceRun,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString()});
 if(acceptance){sql(`insert into natori_case_acceptance_runs(id,owner_id,project_ref,origin,provider_scope,stripe_account,starts_at,ends_at,enabled,allowed_to,human_to,sender,reply_to,mail_limit,human_limit) values('${acceptanceRun}','${owner}','local','${appUrl}','resend-case-fixture','acct_casefixture',${literal(JSON.parse(acceptanceTarget).startsAt)}::timestamptz,${literal(JSON.parse(acceptanceTarget).endsAt)}::timestamptz,true,ARRAY[${[...seed.ids.map((_,i)=>'client'+(i+1)+'@example.invalid'),'reply@example.invalid'].map(literal)}],ARRAY[]::text[],'Local <mail@example.invalid>','reply@example.invalid',30,0);insert into natori_case_acceptance_projects(run_id,project_id) values ${seed.ids.filter((_,i)=>i!==10&&i!==15).map(id=>`('${acceptanceRun}','${id}')`).join(',')};`);}
 if(noMail)sql(`update natori_case_acceptance_runs set allowed_to=ARRAY[]::text[],human_to=ARRAY[]::text[],mail_limit=12,human_limit=0 where id='${acceptanceRun}' and owner_id='${owner}'`);
 check('Data API: actual PostgREST + formal migration + synthetic Auth users and owned/foreign fixture cases ready');
 await buildBrowserBootstrap(app,api,anon,acceptance?acceptanceTarget:"");
 logFd=openSync(out+'/next-dev.log','w');
 const appEnv={PATH:process.env.PATH,LANG:'C.UTF-8',NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,SUPABASE_URL:api,...(acceptance?{NATORI_CASE_ACCEPTANCE_TARGET:acceptanceTarget,NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET:acceptanceTarget,NATORI_CASE_ACCEPTANCE_MAIL_SCOPE:'resend-case-fixture',NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT:'acct_casefixture',NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET:acceptanceSecret}:{}),NATORI_OWNER_USER_ID:owner,NATORI_STAFF_EMAILS:users.staff.email,NATORI_DASHBOARD_KEY:sharedKey,NEXT_PUBLIC_SITE_URL:appUrl,NEXT_FONT_GOOGLE_MOCKED_RESPONSES:out+'/offline-fonts.cjs',...(payment?{CASE_PAYMENT_LOCAL:'ephemeral',CASE_PAYMENT_EVIDENCE:out+'/provider.jsonl',NATORI_DELIVERY_INTEGRITY_ENABLED:'1',NATORI_CASE_PAYMENT_WORKSPACE_ENABLED:'1',NATORI_PAYMENT_LINK_INTEGRITY_ENABLED:'1',NATORI_ACCEPTANCE_OUTBOX_ENABLED:'1',NATORI_QUOTE_INTEGRITY_ENABLED:'1',NATORI_PAYMENT_INTEGRITY_ENABLED:'1',NATORI_NOTIFICATION_SENDING_ENABLED:'1',NATORI_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_local_synthetic',RESEND_API_KEY:'synthetic-unused',NATORI_ORDER_MAIL_FROM:'Local <mail@example.invalid>',NATORI_PORTFOLIO_CONTACT_TO:'reply@example.invalid',NATORI_DELIVERY_NOTIFICATION_KEY:encryptionKey}:{}),NODE_OPTIONS:'--require='+out+'/allow-loopback.cjs'+(payment?' --require='+root+'/scripts/natori-case-payment/provider-preload.cjs':'')};
 if(noMail){appEnv.NATORI_CASE_ACCEPTANCE_NO_MAIL='1';appEnv.NATORI_NOTIFICATION_SENDING_ENABLED='0';appEnv.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED='1';appEnv.STRIPE_WEBHOOK_SECRET='whsec_no_mail_synthetic';delete appEnv.RESEND_API_KEY;delete appEnv.NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET;}
 if(eventsOnly){appEnv.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED='1';appEnv.NATORI_CASE_ACCEPTANCE_EVENTS=JSON.stringify({run:acceptanceRun,owner,firstDate:'2026-11-01',lastDate:'2026-12-31',operations:['create','update','delete'],fixtures:[{id:'a9000000-0000-4000-8000-000000000001',create:{title:'合成の個人予定',date:'2026-11-12',note:null}}]});}
 if(administration)appEnv.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED=historyOnly||scaleOnly?'read-only':'1';
 if(scaleOnly){appEnv.CASE_SCALE_OUT=out;appEnv.NODE_OPTIONS+=' --require='+root+'/scripts/natori-case-continuity/memory-probe.cjs';}
 if(entryPreview)appEnv.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED=entryReadOnly?'read-only':'1';
 if(productionBuild){
  appEnv.NODE_ENV='production';
  const built=spawn(process.execPath,[root+'/node_modules/next/dist/bin/next','build'],{cwd:app,env:appEnv,stdio:['ignore',logFd,logFd]});
  const status=await new Promise((done,reject)=>{built.once('error',reject);built.once('exit',done);});
  if(status!==0)throw Error('isolated production build failed; see redacted next-dev.log');
  if(existsSync(out+'/provider.jsonl')&&readFileSync(out+'/provider.jsonl','utf8').trim())throw Error('provider requested during build');
  check('Production build: dedicated local target compiled with NODE_ENV=production and no provider operation');
 }
 next=spawn(process.execPath,[root+'/node_modules/next/dist/bin/next',productionBuild?'start':'dev','--hostname','127.0.0.1','--port','4195'],{cwd:app,detached:true,env:appEnv,stdio:['ignore',logFd,logFd]});
 writeFileSync(out+'/owned-process.json',JSON.stringify({pid:next.pid,processGroup:next.pid,cwd:app,port:4195,run},null,2));
 await ready(async()=>{const r=await fetch(appUrl+'/api/natori/admin/case-workspace');return r.status===401;},'full Next application');
 check('Application: unchanged full Next application and normal middleware started with loopback-only settings');
 browserResult=noMail?await(await import('../natori-case-no-mail/verify-browser.mjs')).checkNoMailBrowser({out,app:appUrl,api,password,owner,other,users,check,sql,ids:seed.ids,run:acceptanceRun,secret:appEnv.STRIPE_WEBHOOK_SECRET}):maintenanceOnly?await(await import('../natori-case-continuity/verify-maintenance-rpc.mjs')).checkMaintenanceRpc({out,app:appUrl,api,password,owner,other,service,users,check,sql,requests}):eventsOnly?await(await import('../natori-case-hosted/verify-personal-events.mjs')).checkPersonalEventsBrowser({out,app:appUrl,api,password,owner,other,users,check,sql,run:acceptanceRun}):holdOnly?await(await import('../natori-case-continuity/verify-hold-browser.mjs')).checkHoldBrowser({out,app:appUrl,api,password,owner,other,users,check,sql,ids:seed.ids}):administration?await(await import('../natori-case-administration/verify-browser.mjs')).checkAdministrationBrowser({out,app:appUrl,api,password,owner,other,users,check,sql,ids:seed.ids,screenOnly,historyOnly,continuityOnly,scaleOnly,metrics:requests,setScaleFault:value=>{scaleFault=value;}}):entryPreview?await(await import('../natori-case-entries/verify-browser.mjs')).checkEntryBrowser({out,app:appUrl,api,password,owner,other,users,check,sql,ids:seed.ids,readOnly:entryReadOnly}):acceptance?await (await import('../natori-case-acceptance/verify-browser.mjs')).checkAcceptanceBrowser({out,app:appUrl,api,anon,password,owner,users,check,sql,ids:seed.ids,run:acceptanceRun,secret:acceptanceSecret}):process.argv.includes('--work-only')?{}:await (payment?checkPaymentBrowser:checkBrowser)({out,app:appUrl,api,anon,service,password,sharedKey,owner,other,users,ids:seed.ids,titles:seed.titles,check,requests,sql,stopRest:()=>docker(['stop','--time','1',names.rest]),startRest:async()=>{docker(['start',names.rest]);await ready(()=>backendHealth('rest','/'),'restarted PostgREST');}});
 if(work&&!noMail)browserResult.work=await checkWorkBrowser({out,app:appUrl,api,anon,password,owner,other,users,check,sql,ids:seed.ids});
 if(reconciliation&&!acceptance)browserResult.reconciliation=await checkReconciliationBrowser({out,app:appUrl,api,anon,password,owner,other,users,check,sql});
 if(!payment){assert.equal(checksum(),initialChecksum);assert(requests.filter(r=>r.path.startsWith('/rest/v1/')).every(r=>['GET','OPTIONS'].includes(r.method)));
 }
 if(!payment)check('No business mutations: all Data API operations GET and business checksum unchanged; Auth session writes remain confined to synthetic Auth schema');
 const maintenancePassed=!maintenanceOnly||browserResult.blocked.length===0;
 if(!maintenancePassed)process.exitCode=2;
 writeFileSync(out+'/results.json',JSON.stringify({success:maintenancePassed,executionCompleted:true,acceptance:normal?'normal business schema/real local Auth/PostgREST/app; Storage catalog and Stripe/Resend substitutes':payment?'workspace payment: reduced schema/real local Auth/PostgREST/app, synthetic Stripe/Resend':'limited schema/local-password acceptance; not full service acceptance',checks,browser:browserResult,requests,images,migrationSha256:createHash('sha256').update(migration).digest('hex'),businessChecksum:initialChecksum,
  unverified:[...(normal?[]:['normal business schema, constraints, triggers, grants and full migration replay']),'Google OAuth provider login and PKCE callback; password bootstrap only','hosted platform/gateway configuration',...(productionBuild?['hosted preview target runtime; production profile remains closed']:['production build runtime']),'iPhone hardware','Storage service/catalog equivalence, email, payments and existing mutation workflows']},null,2));
 console.log(JSON.stringify({success:maintenancePassed,executionCompleted:true,checks:checks.length,normalBusinessSchema:normal,auth:'actual GoTrue/PostgREST/middleware; platform/provider substitutes remain'}));
}catch(error){writeFileSync(out+'/results.json',JSON.stringify({success:false,error:redact(error.message),checks,requests},null,2));console.error(redact(error.stack).slice(0,2500));process.exitCode=1;}
finally{
 if(next?.pid){try{process.kill(-next.pid,'SIGTERM');}catch{}await Promise.race([new Promise(done=>{if(next.exitCode!==null)done();else next.once('exit',done);}),wait(2000)]);}
 if(gateway)await new Promise(done=>gateway.close(done));for(const child of relays)child.kill('SIGTERM');if(logFd!==undefined){closeSync(logFd);writeFileSync(out+'/next-dev.log',redact(readFileSync(out+'/next-dev.log','utf8')));}
 const removed=[];
 for(const name of [...containers].reverse()){
  try{ownedContainer(name);const logs=docker(['logs','--tail','60',name]);writeFileSync(out+'/'+name.replace(run+'-','')+'-tail.log',redact(logs));docker(['rm','--force',name]);removed.push(name);}catch(error){writeFileSync(out+'/cleanup-error.log',redact(error.message));process.exitCode=1;}
 }
 writeFileSync(out+'/cleanup.json',JSON.stringify({run,ownedContainersRemoved:removed,createdContainers:containers.length,separateNetworkCreated:false,nextTerminationRequested:Boolean(next?.pid)},null,2));
}
