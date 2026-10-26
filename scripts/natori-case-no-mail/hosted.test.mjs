import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {dedicated,integrityFlags,assertOperationPlan,assertOperationPlatform,operationDecision} from './hosted-gate.mjs';
import {operationPreflight} from './hosted-preflight.mjs';
import {buildOperationPackage} from './package.mjs';
const root=resolve(import.meta.dirname,'../..'),now=Date.parse('2026-10-25T08:00:00Z');
function plan() {return {version:1,purpose:'hosted-no-mail-read-only',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 target:{profile:'hosted',ref:dedicated.ref,project:dedicated.project,url:dedicated.url,origin:dedicated.origin,run:'88888888-8888-4888-8888-888888888888',startsAt:'2026-10-25T07:00:00Z',endsAt:'2026-10-26T07:00:00Z'},owner:dedicated.owner,
 stripe:{account:dedicated.account,mode:'test'},mail:{scope:'synthetic-no-mail-operations',allowedTo:[],maxAttempts:0},
 fixtures:{staff:{id:'6e0e3666-01b2-4ca4-a98a-2a7be9c020a2',email:'natori-readonly-staff@example.invalid'},outsider:{id:'2be65488-a1dd-47a7-9344-27b9bdb4aa4a',email:'natori-readonly-outsider@example.invalid'},projects:['e1627560-76b7-4f7a-9641-88610fa66f96'],foreignProject:'a0f1ef44-997a-44b6-b2d0-09fc5e374920'}};}
function env(p=plan()) {return {VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',VERCEL_PROJECT_ID:dedicated.project,SUPABASE_URL:dedicated.url,NEXT_PUBLIC_SUPABASE_URL:dedicated.url,NEXT_PUBLIC_SITE_URL:dedicated.origin,
 NATORI_CASE_ACCEPTANCE_TARGET:JSON.stringify(p.target),NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET:JSON.stringify(p.target),NATORI_OWNER_USER_ID:p.owner,NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT:dedicated.account,NATORI_CASE_ACCEPTANCE_MAIL_SCOPE:p.mail.scope,NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT:p.target.endsAt,
 NATORI_CASE_ACCEPTANCE_NO_MAIL:'1',NATORI_NOTIFICATION_SENDING_ENABLED:'0',NATORI_CASE_DASHBOARD_PREVIEW_ENABLED:'1',NATORI_CASE_PAYMENT_WORKSPACE_ENABLED:'1',NATORI_STRIPE_MODE:'test',NATORI_STAFF_EMAILS:p.fixtures.staff.email+',info@me-ish.art',...Object.fromEntries(integrityFlags.map(k=>[k,'1'])),
 STRIPE_SECRET_KEY:'rk_test_synthetic_not_real',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_not_real',NATORI_DELIVERY_NOTIFICATION_KEY:'a'.repeat(64),SUPABASE_SERVICE_ROLE_KEY:'synthetic-not-a-working-service-key'};}
const context=(pathname,method='GET',time=now)=>({origin:dedicated.origin,pathname,method,now:time});
test('operation plan cannot expand beyond 6 owned fixtures or 24 hours',()=>{
 const p=plan();p.fixtures.projects=Array(7).fill(p.fixtures.projects[0]);assert.throws(()=>assertOperationPlan(p));
 const extended=plan();extended.target.endsAt='2026-10-26T07:00:01Z';assert.throws(()=>assertOperationPlan(extended));
});
test('explicit Preview operation gate permits ordinary authorization and never depends on NODE_ENV',()=>{
 assertOperationPlatform({...env(),NODE_ENV:'production'},plan(),now);
 for(const [path,method]of [['/admin-login','GET'],['/auth/callback','GET'],['/natori/dashboard/cases','GET'],['/api/natori/admin/case-payment','POST'],['/api/natori/admin/case-system','POST']])assert.equal(operationDecision(env(),plan(),context(path,method)),null);
});
for(const [name,value]of [['VERCEL_ENV','production'],['VERCEL_ENV',undefined],['VERCEL_TARGET_ENV','production'],['VERCEL_TARGET_ENV',undefined],['VERCEL_PROJECT_ID','prj_other'],['SUPABASE_URL','https://lvnfspyainrxtztjytbo.supabase.co'],['NEXT_PUBLIC_SITE_URL','https://me-ish.art'],['NATORI_CASE_ACCEPTANCE_NO_MAIL','0'],['NATORI_NOTIFICATION_SENDING_ENABLED','1'],['RESEND_API_KEY','synthetic-unwanted'],['NATORI_CASE_RELEASE_ENABLED','1'],['NATORI_DASHBOARD_KEY','synthetic-unwanted'],['NATORI_STAFF_EMAILS','other@example.invalid'],['NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT','2026-10-27T00:00:00Z']])test(`operation early gate rejects ${name}/${value??'missing'}`,()=>{
 const changed={...env(),[name]:value};assert.throws(()=>assertOperationPlatform(changed,plan(),now));
 for(const method of ['GET','POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal(operationDecision(changed,plan(),context('/api/natori/admin/case-payment',method)),503);
});
test('24h expiry closes retained staff sessions but lets signed late facts reach ordinary verification',()=>{
 const p=plan(),end=Date.parse(p.target.endsAt);
 for(const path of ['/admin-login','/auth/callback','/natori/dashboard/cases','/_next/static/file.js','/api/natori/admin/case-system','/api/natori/admin/case-payment'])for(const method of ['GET','POST'])assert.equal(operationDecision(env(p),p,context(path,method,end)),503);
 for(const path of ['/api/webhook/stripe','/api/natori/quote/accept','/api/natori/delivery/accept'])assert.equal(operationDecision(env(p),p,context(path,'POST',end)),null);
 assert.equal(operationDecision(env(p),p,{...context('/api/webhook/stripe','POST'),origin:'https://other.vercel.app'}),503);
 assert.equal(operationDecision(env(p),p,context('/admin-login','GET',Date.parse(p.target.startsAt)-1)),503);
});
test('all Cron methods and Resend webhook remain disabled while the target is active',()=>{
 for(const path of ['/api/cron/natori-payment-expiry','/api/cron/close-monthly-payout','/api/webhook/resend'])for(const method of ['GET','HEAD','POST','OPTIONS'])assert.equal(operationDecision(env(),plan(),context(path,method)),404);
});
function transportFixture(p,mutate=()=>{}) {let calls=0;return {count:()=>calls,transport:async(url,options)=>{
 assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
 if(url==='https://api.stripe.com/v1/account'){calls++;assert.equal(options.headers.Authorization,'Bearer '+env(p).STRIPE_SECRET_KEY);return Response.json({id:dedicated.account});}
 assert.equal(new URL(url).origin,dedicated.url);
 const run={id:p.target.run,owner_id:p.owner,project_ref:p.target.ref,origin:p.target.origin,provider_scope:p.mail.scope,stripe_account:p.stripe.account,starts_at:p.target.startsAt,ends_at:p.target.endsAt,enabled:true,allowed_to:[],human_to:[],mail_limit:12,human_limit:0,used:0,human_used:0};mutate(run);
 const rows=[[run],p.fixtures.projects.map(project_id=>({project_id})),[...p.fixtures.projects.map(id=>({id,user_id:p.owner,deleted_at:null})),{id:p.fixtures.foreignProject,user_id:p.fixtures.outsider.id,deleted_at:null}]];
 return Response.json(rows[calls++]);
 }};}
test('build preflight uses 3 bounded DB reads and one own-account GET, without writes',async()=>{
 const p=plan(),f=transportFixture(p);assert.deepEqual(await operationPreflight(env(p),p,f.transport,()=>now),{confirmed:true,mailAttempts:0,mutations:0,providerReads:1});assert.equal(f.count(),4);
});
test('account permission failure, wrong account and redirect abort before any Stripe object write',async()=>{
 for(const [response,error]of [[new Response('{}',{status:403}),'permission'],[Response.json({id:'acct_other'}),'mismatch'],[new Response('{}',{status:302}),'unconfirmed']]){
  const p=plan(),f=transportFixture(p),transport=(url,options)=>url==='https://api.stripe.com/v1/account'?response:f.transport(url,options);
  await assert.rejects(operationPreflight(env(p),p,transport,()=>now),new RegExp('operation_stripe_account_'+error));assert.equal(f.count(),3);
 }
});
for(const [name,change]of [['recipient',r=>r.allowed_to.push('person@example.invalid')],['human limit',r=>r.human_limit=12],['spend',r=>r.used=1],['disabled',r=>r.enabled=false],['account',r=>r.stripe_account='acct_other']])test(`preflight refuses ${name} without provider operations`,async()=>{
 const p=plan(),f=transportFixture(p,change);await assert.rejects(operationPreflight(env(p),p,f.transport,()=>now));assert.equal(f.count(),3);
});
test('unsupported key/absent signing or receipt key refuses before any database request',async()=>{
 for(const changes of [{STRIPE_SECRET_KEY:'sk_live_synthetic'},{STRIPE_WEBHOOK_SECRET:''},{NATORI_DELIVERY_NOTIFICATION_KEY:''}]){
  const p=plan(),f=transportFixture(p);await assert.rejects(operationPreflight({...env(p),...changes},p,f.transport,()=>now));assert.equal(f.count(),0);
 }
});
test('operation package is secret-free, no Cron/setup writes, immutable normal business routes and fixed Google callback',()=>{
 const parent=mkdtempSync(tmpdir()+'/natori-operation-package-'),out=parent+'/package',p=plan();const m=buildOperationPackage(out,p,now);
 assert.equal(m.mailAttempts,0);assert.equal(m.setupWrites,0);assert.equal(m.deployed,false);
 const request=JSON.parse(readFileSync(out+'/deployment-request.json','utf8'));assert.equal(request.target,undefined);assert.equal(request.project,dedicated.project);assert.ok(Object.values(request.projectSettings).filter(x=>typeof x==='string').every(x=>x.length<=256));
 const overlays=JSON.parse(readFileSync(out+'/archive-members.json','utf8')).overlays;
 assert.deepEqual(JSON.parse(overlays['vercel.json']).crons,[]);
 assert.ok(overlays['src/middleware.ts'].includes('operationDecision'));
 const middleware=readFileSync(root+'/src/middleware.ts','utf8'),entry='export default async function middleware(request: NextRequest) {';
 assert.ok(overlays['src/middleware.ts'].includes(middleware.slice(middleware.indexOf(entry)+entry.length,middleware.indexOf('export const config = {'))));
 assert.equal(overlays['src/middleware.ts'].includes('initialReadonlyDecision'),false);
 assert.ok(overlays['src/app/auth/callback/route.ts'].includes('await supabase.auth.exchangeCodeForSession(code)'));
 assert.equal(Object.keys(overlays).some(k=>k.startsWith('src/app/api/')),false);
 assert.equal(readFileSync(out+'/preview-build.cjs','utf8').includes('scripts/natori-case-no-mail/hosted-preflight.mjs'),true);
 assert.equal(readFileSync(out+'/preview-build.cjs','utf8').includes('/setup.mjs'),false);
 const raw=readFileSync(out+'/archive-members.json','utf8');for(const key of ['STRIPE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','NATORI_DELIVERY_NOTIFICATION_KEY'])assert.equal(raw.includes(env(p)[key]),false);
 const names=execFileSync('tar',['-tzf',out+'/application-source.tar.gz'],{encoding:'utf8'}).split('\n');assert.equal(names.some(n=>/(^|\/)\.env(?:\.|$)|\.git\//.test(n)),false);
 for(const file of ['src/features/natori/server/requireNatoriAdmin.ts','src/app/api/natori/admin/case-payment/route.ts','src/app/api/webhook/stripe/route.ts'])assert.deepEqual(execFileSync('tar',['-xOf',out+'/application-source.tar.gz',file]),readFileSync(root+'/'+file));
});
