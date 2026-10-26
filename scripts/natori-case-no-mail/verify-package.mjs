// Offline proof of the exact operation overlays. No keys or real target access.
import {mkdirSync,writeFileSync,symlinkSync,readFileSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {buildOperationPackage} from './package.mjs';
import {dedicated,integrityFlags,assertOperationPlatform} from './hosted-gate.mjs';
import {plan as initial} from '../natori-case-initial-preview/plan.mjs';
const root=resolve(import.meta.dirname,'../..'),out=resolve(process.argv[2]??'');
if(!out.startsWith('/tmp/')&&!out.startsWith('/workspace/'))throw Error('fresh local output required');mkdirSync(out);
const start=new Date(Date.now()-60000).toISOString(),end=new Date(Date.now()+23*3600000).toISOString();
const plan={version:1,purpose:'hosted-no-mail-read-only',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),target:{...initial.target,run:'88888888-8888-4888-8888-888888888888',startsAt:start,endsAt:end},owner:dedicated.owner,stripe:{account:dedicated.account,mode:'test'},mail:{scope:'synthetic-offline-no-mail',allowedTo:[],maxAttempts:0},fixtures:{staff:initial.actors.staff,outsider:initial.actors.outsider,projects:[initial.projects.registered],foreignProject:initial.projects.foreign}};
const manifest=buildOperationPackage(out+'/package',plan),app=out+'/full-app';mkdirSync(app);
execFileSync('tar',['-xzf',out+'/package/application-source.tar.gz','-C',app]);symlinkSync(root+'/node_modules',app+'/node_modules','dir');
writeFileSync(out+'/offline-fonts.cjs',`module.exports=new Proxy({}, {get(){return "@font-face {font-family:'Zen Maru Gothic';src:local('Arial');} @font-face {font-family:'Lilita One';src:local('Arial');}"}});`);
const marker=JSON.stringify(plan.target),env={PATH:dirname(process.execPath)+':'+process.env.PATH,LANG:'C.UTF-8',NODE_ENV:'production',CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require='+root+'/scripts/natori-case-preview/deny-network.cjs',NEXT_FONT_GOOGLE_MOCKED_RESPONSES:out+'/offline-fonts.cjs',
 VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',VERCEL_PROJECT_ID:dedicated.project,SUPABASE_URL:dedicated.url,NEXT_PUBLIC_SUPABASE_URL:dedicated.url,NEXT_PUBLIC_SITE_URL:dedicated.origin,
 NATORI_CASE_ACCEPTANCE_TARGET:marker,NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET:marker,NATORI_OWNER_USER_ID:plan.owner,NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT:dedicated.account,NATORI_CASE_ACCEPTANCE_MAIL_SCOPE:plan.mail.scope,NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT:end,
 NATORI_CASE_ACCEPTANCE_NO_MAIL:'1',NATORI_NOTIFICATION_SENDING_ENABLED:'0',NATORI_CASE_DASHBOARD_PREVIEW_ENABLED:'1',NATORI_CASE_PAYMENT_WORKSPACE_ENABLED:'1',NATORI_STRIPE_MODE:'test',NATORI_STAFF_EMAILS:initial.actors.staff.email+',info@me-ish.art',...Object.fromEntries(integrityFlags.map(k=>[k,'1'])),
 STRIPE_SECRET_KEY:'rk_test_offline_synthetic_not_real',STRIPE_WEBHOOK_SECRET:'whsec_offline_synthetic_not_real',NATORI_DELIVERY_NOTIFICATION_KEY:'a'.repeat(64),SUPABASE_SERVICE_ROLE_KEY:'offline-synthetic-not-a-key',NEXT_PUBLIC_SUPABASE_ANON_KEY:'offline-synthetic-not-a-key'};
assertOperationPlatform(env,plan);
const started=Date.now(),child=spawn('npm',['run','build'],{cwd:app,env,stdio:['ignore','pipe','pipe']});let log='';
for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=data;process.stdout.write(data);});
const exitCode=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',done);});
writeFileSync(out+'/build.log',log);writeFileSync(out+'/result.json',JSON.stringify({success:exitCode===0,exitCode,node:process.version,elapsedMs:Date.now()-started,manifest,network:'all Socket.connect denied; no external requests',databaseWrites:0,deploymentRequests:0,limits:['synthetic credentials only','hosted DB preflight separately tested with fake transport; not executed by this offline build','not Google OAuth/service acceptance']},null,2)+'\n');
process.exitCode=exitCode??1;
