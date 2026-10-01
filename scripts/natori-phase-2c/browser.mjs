import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setDefaultResultOrder} from 'node:dns';
const require=createRequire('/app/package.json'),{createClient}=require('@supabase/supabase-js'),{chromium,expect}=require('@playwright/test');
setDefaultResultOrder('ipv4first');
const results=[],apiObservations=[],check=(ok,code)=>{if(!ok)throw new Error(code);};let stage='preflight',server,browser;
async function test(name,fn){stage=name;try{await fn();results.push({name,status:'passed'});console.log(`PASS phase2c-browser/${name}`);}catch(e){results.push({name,status:'failed',code:/^[A-Z_0-9]+$/.test(e?.message??'')?e.message:'ASSERTION_FAILED'});console.log(`FAIL phase2c-browser/${name}`);}}
async function main(){
 check(process.env.PHASE_N_BROWSER==='ephemeral','EPHEMERAL_REQUIRED');const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));
 check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin),'DESTINATION_REJECTED');const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8'));
 const admin=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}}),password=randomBytes(32).toString('hex'),email='phase2c-owner@phase0b-browser.invalid';
 const auth=await admin.auth.admin.createUser({email,password,email_confirm:true});check(!auth.error&&auth.data.user,'AUTH_FIXTURE');const owner=auth.data.user.id;
 const project=await admin.from('natori_projects').insert({user_id:owner,title:'Browser quote',client_name:'Synthetic',client_email:'client@phase2a.invalid',type:'illustration',status:'inquiry',request_data:null}).select('id').single();check(!project.error&&project.data,'PROJECT_FIXTURE');const id=project.data.id;
 const quoteToken=randomBytes(24).toString('base64url');
 const quote=await admin.from('natori_quotes').insert({project_id:id,user_id:owner,version:1,title:'Browser payment',client_name:'Synthetic',to_email:'client@phase2c.invalid',amount:12000,subject:'Quote',body_snapshot:'Synthetic',token_hash:createHash('sha256').update(quoteToken).digest('hex'),expires_at:new Date(Date.now()+86400000).toISOString(),accepted_at:new Date().toISOString()}).select('id').single();check(!quote.error&&quote.data,'QUOTE_FIXTURE');
 check(!(await admin.from('natori_projects').update({status:'awaiting_payment',payment_quote_id:quote.data.id,active_quote_id:quote.data.id,quote_accepted_at:new Date().toISOString(),quote_accepted_amount:12000,quoted_amount:12000}).eq('id',id)).error,'ACCEPTED_FIXTURE');
 const app='http://localhost:3000';server=spawn(process.execPath,['--require','/phase2c-browser/provider-preload.cjs','/app/node_modules/next/dist/bin/next','dev','--hostname','localhost','--port','3000'],{cwd:'/app',env:{PATH:'/runtime-bin:/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',NODE_ENV:'development',NODE_OPTIONS:'--dns-result-order=ipv4first',NEXT_TELEMETRY_DISABLED:'1',PHASE_N_BROWSER:'ephemeral',PHASE_0B_BROWSER:'ephemeral',PHASE_2A_BROWSER:'ephemeral',PHASE_2C_BROWSER:'ephemeral',NATORI_PAYMENT_LINK_INTEGRITY_ENABLED:'1',NATORI_PAYMENT_INTEGRITY_ENABLED:'1',NATORI_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_'+randomBytes(32).toString('hex'),NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,NATORI_DASHBOARD_KEY:randomBytes(32).toString('hex'),NATORI_OWNER_USER_ID:owner,NATORI_OWNER_EMAILS:email,NEXT_PUBLIC_SITE_URL:app,NATORI_ACCEPTANCE_OUTBOX_ENABLED:'1',NATORI_NOTIFICATION_SENDING_ENABLED:'0',NATORI_QUOTE_INTEGRITY_ENABLED:'1',NATORI_DELIVERY_NOTIFICATION_KEY:randomBytes(32).toString('hex'),RESEND_API_KEY:randomBytes(32).toString('hex'),NATORI_ORDER_MAIL_FROM:'Phase 2A <sender@phase2a.invalid>',NATORI_PORTFOLIO_CONTACT_TO:'artist@phase2a.invalid',NATORI_MAIL_BCC:''},stdio:['ignore','pipe','pipe']});
 let fixtureAdapterApplied=false;const errors=new Set();for(const stream of [server.stdout,server.stderr])stream.on('data',b=>{if(b.toString().includes('PHASE2C_FIXTURE_ADAPTER'))fixtureAdapterApplied=true;for(const code of ['Module not found','Failed to compile','SyntaxError','EADDRINUSE'])if(b.toString().includes(code))errors.add(code);});
 let ready=false;const deadline=Date.now()+120000;while(Date.now()<deadline&&server.exitCode===null){try{const response=await fetch(`${app}/ja/fixture-session`,{signal:AbortSignal.timeout(2000)});if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}check(ready,'NEXT_READY');
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==app)return route.abort('blockedbyclient');return route.continue();});
 await page.goto(`${app}/ja/fixture-session`);await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByText('Session ready')).toBeVisible();
 await test('actual-session-anonymous-and-csrf-boundaries',async()=>{const anon=await browser.newContext();const a=await anon.request.post(`${app}/api/natori/admin/payment-link`,{data:{projectId:id,operationId:randomUUID(),action:'issue'},headers:{'x-requested-with':'me-ish'}});check(a.status()===401,'ANON_DENIED');const denied=await context.request.post(`${app}/api/natori/admin/payment-link`,{data:{projectId:id,operationId:randomUUID(),action:'issue'}});check(denied.status()===403,'CSRF_DENIED');await anon.close();});
 const quotePage=await context.newPage(),quoteUrl=app+'/ja/natori/quote/'+quoteToken;
 const publicDeadline=()=>quotePage.getByText('現在の支払期限',{exact:true}).locator('..').locator('dd');
 const formattedDeadline=iso=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))+'（日本時間）';
 const rejectedOperations=[];
 const observeApi=(response,data,request)=>{const codes=['completed','invalid_request','invalid_deadline','invalid_state','busy','retry_same_operation','temporarily_unavailable','not_configured','conflict','needs_review'];apiObservations.push({stage,status:response.status(),result:codes.includes(data.result)?data.result:'other',rejected:data.operationState==='rejected',operationMatches:data.operationId===request.operationId});};
 await test('definitive-expired-deadline-409-unfreezes-edits',async()=>{
  await page.goto(app+'/ja/fixture-payment-link/'+id);await expect(page.getByText('案内未発行',{exact:true})).toBeVisible();
  await page.getByLabel('新しい支払期限').fill('2000-01-01T12:00');await page.getByLabel('支払案内の本文').fill('Rejected individual comment KEEP');
  const responsePromise=page.waitForResponse(r=>r.url()===app+'/api/natori/admin/payment-link'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'選んだ操作を実行'}).click();const response=await responsePromise,data=await response.json(),request=response.request().postDataJSON();
  observeApi(response,data,request);check(response.status()===409&&data.operationState==='rejected'&&data.operationId===request.operationId,'DEFINITIVE_REJECTION');
  rejectedOperations.push(request.operationId);await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('新しい支払期限')).toBeEnabled();await expect(page.getByLabel('支払案内の本文')).toBeEnabled();
  await expect(page.getByLabel('支払案内の本文')).toHaveValue('Rejected individual comment KEEP');
  check(await page.evaluate(projectId=>sessionStorage.getItem('natori-payment-link-operation/'+projectId),id)===null,'REJECTED_CACHE_CLEARED');
  check((await admin.from('natori_payment_link_attempts').select('id').eq('project_id',id)).data?.length===0,'NO_REJECTED_GENERATION');
 });
 await test('lost-rejection-reload-reconciles-and-preserves-editable-draft',async()=>{
  await page.getByLabel('新しい支払期限').fill('2000-01-02T12:00');await page.getByLabel('支払案内の件名').fill('Saved rejected subject');await page.getByLabel('支払案内の本文').fill('Saved rejected comment KEEP');
  let rejected;
  await page.route('**/api/natori/admin/payment-link',async r=>{if(r.request().method()!=='POST')return r.continue();rejected=r.request().postDataJSON();const response=await r.fetch(),data=await response.json();check(response.status()===409&&data.operationState==='rejected'&&data.operationId===rejected.operationId,'LOST_DEFINITIVE_REJECTION');await r.abort('failed');});
  await page.getByRole('button',{name:'選んだ操作を実行'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('支払案内の本文')).toBeDisabled();await page.unroute('**/api/natori/admin/payment-link');
  rejectedOperations.push(rejected.operationId);let lookup;
  await page.route('**/api/natori/admin/payment-link?*',r=>{lookup=new URL(r.request().url()).searchParams.get('operationId');return r.continue();});
  await page.reload();await expect(page.getByRole('alert')).toBeVisible();check(lookup===rejected.operationId,'RESTORED_OPERATION_LOOKUP');await page.unroute('**/api/natori/admin/payment-link?*');
  await expect(page.getByLabel('新しい支払期限')).toBeEnabled();await expect(page.getByLabel('支払案内の本文')).toBeEnabled();
  await expect(page.getByLabel('支払案内の件名')).toHaveValue('Saved rejected subject');await expect(page.getByLabel('支払案内の本文')).toHaveValue('Saved rejected comment KEEP');
  check(await page.evaluate(projectId=>sessionStorage.getItem('natori-payment-link-operation/'+projectId),id)===null,'RELOADED_REJECTION_CACHE_CLEARED');
 });
 let frozen;
 await test('actual-issue-ack-loss-restores-and-replays-one-generation',async()=>{
  await page.goto(`${app}/ja/fixture-payment-link/${id}`);await expect(page.getByText('案内未発行',{exact:true})).toBeVisible();
  await page.getByLabel('新しい支払期限').fill(new Date(Date.now()+5*86400000+12600000).toISOString().slice(0,16));
  await page.getByLabel('支払案内の本文').fill('Individual comment KEEP {支払いリンク}');
  await page.route('**/api/natori/admin/payment-link',async r=>{if(r.request().method()!=='POST')return r.continue();frozen=r.request().postDataJSON();const response=await r.fetch();check(response.ok(),'REAL_ISSUE');await r.abort('failed');});
  await page.getByRole('button',{name:'選んだ操作を実行'}).click();await expect(page.getByRole('alert')).toBeVisible();await page.unroute('**/api/natori/admin/payment-link');
  await page.reload();await expect(page.getByLabel('支払案内の本文')).toHaveValue('Individual comment KEEP {支払いリンク}');await expect(page.getByLabel('支払案内の本文')).toBeDisabled();
  let replay;await page.route('**/api/natori/admin/payment-link',async r=>{if(r.request().method()==='POST')replay=r.request().postDataJSON();return r.continue();});
  await page.getByRole('button',{name:'同じ操作で再試行'}).click();await expect(page.getByText('リンク有効',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'同じ操作で再試行'})).toHaveCount(0);check(JSON.stringify(replay)===JSON.stringify(frozen),'SAME_REQUEST');check(!rejectedOperations.includes(frozen.operationId),'NEW_OPERATION_AFTER_REJECTION');await page.unroute('**/api/natori/admin/payment-link');
  check((await admin.from('natori_payment_link_attempts').select('id').eq('project_id',id)).data?.length===1,'ONE_GENERATION');check((await admin.from('natori_notification_jobs').select('id').eq('project_id',id)).data?.length===1,'ONE_NOTICE');
 });
 await test('public-quote-shows-current-custom-deadline-and-historical-accepted-terms',async()=>{
  const attempt=(await admin.from('natori_payment_link_attempts').select('deadline').eq('project_id',id).single()).data;
  await quotePage.goto(quoteUrl);await expect(quotePage.getByText('承諾時のお支払条件',{exact:true})).toBeVisible();
  await expect(publicDeadline()).toContainText(formattedDeadline(attempt.deadline));await expect(publicDeadline()).not.toContainText('7日以内');
  await expect(quotePage.getByText('支払い案内メール送信日から7日以内',{exact:true})).toBeVisible();
  check(await quotePage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'PUBLIC_MOBILE_NO_OVERFLOW');
 });
 await test('renotify-keeps-deadline-and-url-in-actual-db',async()=>{
  const before=(await admin.from('natori_payment_link_attempts').select('deadline,link_url,generation').eq('project_id',id).single()).data;
  await page.getByLabel('支払リンク操作').selectOption('renotify');await page.getByLabel('支払案内の本文').fill('Resend comment');await page.getByRole('button',{name:'選んだ操作を実行'}).click();
  await expect(page.getByRole('button',{name:'同じ操作で再試行'})).toHaveCount(0);await expect(page.getByRole('button',{name:'選んだ操作を実行'})).toBeEnabled();
  const after=(await admin.from('natori_payment_link_attempts').select('deadline,link_url,generation').eq('project_id',id).single()).data;
  check(JSON.stringify(before)===JSON.stringify(after),'DEADLINE_URL_PRESERVED');await quotePage.reload();await expect(publicDeadline()).toContainText(formattedDeadline(before.deadline));await expect(quotePage.getByText('承諾時のお支払条件',{exact:true})).toBeVisible();check((await admin.from('natori_notification_jobs').select('id').eq('project_id',id)).data?.length===2,'NEW_NOTICE');
 });
 await test('explicit-extension-changes-revision-without-implicit-mail',async()=>{
  const before=(await admin.from('natori_payment_link_attempts').select('deadline').eq('project_id',id).single()).data;
  await page.getByLabel('支払リンク操作').selectOption('extend');await page.getByLabel('新しい支払期限').fill(new Date(Date.now()+8*86400000).toISOString().slice(0,16));
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'選んだ操作を実行'}).click();await expect(page.getByRole('button',{name:'選んだ操作を実行'})).toBeEnabled();
  const after=(await admin.from('natori_payment_link_attempts').select('deadline,deadline_revision').eq('project_id',id).single()).data;
  check(after?.deadline_revision===2,'EXTENSION_REVISION');check(after?.deadline!==before?.deadline,'EXTENSION_DEADLINE_CHANGED');await quotePage.reload();await expect(publicDeadline()).toContainText(formattedDeadline(after.deadline));await expect(publicDeadline()).not.toContainText(formattedDeadline(before.deadline));await expect(quotePage.getByText('承諾時のお支払条件',{exact:true})).toBeVisible();check((await admin.from('natori_notification_jobs').select('id').eq('project_id',id)).data?.length===2,'NO_IMPLICIT_MAIL');
 });
 await test('failed-authoritative-read-blocks-actions-and-mobile-overflow',async()=>{
  await page.route('**/api/natori/admin/payment-link?*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic"}'}));await page.reload();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'選んだ操作を実行'})).toBeDisabled();await page.unroute('**/api/natori/admin/payment-link?*');await page.reload();await expect(page.getByText('リンク有効',{exact:true})).toBeVisible();check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'MOBILE_NO_OVERFLOW');
 });
 await test('actual-close-records-stop-and-blocks-new-issue',async()=>{
  const closed=await context.request.patch(`${app}/api/natori/admin/projects`,{data:{kind:'close',projectId:id,reason:'Synthetic terminal'},headers:{'x-requested-with':'me-ish'}});check(closed.status()===200,'CLOSED');await page.reload();await expect(page.getByText('終了済み',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'選んだ操作を実行'})).toBeDisabled();
  check((await admin.from('natori_payment_link_stops').select('status').eq('project_id',id)).data?.some(j=>j.status==='pending'),'STOP_TASK');
 });
 await context.close();writeFileSync('/results/phase2c-browser.json',JSON.stringify({tests:results,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,engine:'Chromium 1.58.2; 390px viewport, not iPhone Safari',compileErrors:[...errors],fixtureAdapterApplied,apiObservations},null,2));check(results.length===9&&results.every(r=>r.status==='passed')&&errors.size===0&&fixtureAdapterApplied,'BROWSER_FAILED');
}
main().catch(()=>{console.error(`Phase 2C browser failed at ${stage}; raw logs withheld`);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(()=>{server.kill('SIGKILL');r();},5000))]);}});
