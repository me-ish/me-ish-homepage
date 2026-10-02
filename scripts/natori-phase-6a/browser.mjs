import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setDefaultResultOrder} from 'node:dns';
const require=createRequire('/app/package.json'),{createClient}=require('@supabase/supabase-js'),{chromium,expect}=require('@playwright/test');
setDefaultResultOrder('ipv4first');
const results=[],observations=[],check=(value,code)=>{if(!value)throw new Error(code);};
const phase6aFailureCodes = new Set(["ANON_DENIED","ASSERTION_FAILED","AUTH_FIXTURE","BROWSER_FAILED","CANONICAL_CARD_STATUS","COMMIT_ORDER","CSRF_DENIED","DESTINATION_REJECTED","EPHEMERAL_REQUIRED","LATEST_VISIBLE_COMMITTED_REVISION","NEXT_READY","NO_AUTO_RECEIPT","OLDER_GET_LATEST_PROJECTION","OLDER_GET_NO_AUTO_RECEIPT","PROJECT_FIXTURE","REAL_TASK_RESPONSE","SAME_TASK_LATEST_REVISION","SAME_TASK_PROJECTION","STORED_UNCHECK","TASK_FIXTURE","TERMINAL_CONFLICT","TERMINAL_FIXTURE","TERMINAL_NO_TASK_WRITE","TERMINAL_RETAINED","VALID_READ"]);
function safePhase6aFailureCode(error) {
 const message=typeof error?.message==='string'?error.message:'';
 return phase6aFailureCodes.has(message)?message:'ASSERTION_FAILED';
}
let stage='preflight',server,browser;
async function test(name,fn){stage=name;try{await fn();results.push({name,status:'passed'});console.log(`PASS phase6a-browser/${name}`);}
 catch(error){results.push({name,status:'failed',code:safePhase6aFailureCode(error)});console.log(`FAIL phase6a-browser/${name}`);}}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
async function main(){
 check(process.env.PHASE_N_BROWSER==='ephemeral','EPHEMERAL_REQUIRED');
 const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));
 check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin),'DESTINATION_REJECTED');
 const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8'));
 const admin=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}}),password=randomBytes(32).toString('hex'),email='phase6a-owner@phase0b-browser.invalid';
 const auth=await admin.auth.admin.createUser({email,password,email_confirm:true});check(!auth.error&&auth.data.user,'AUTH_FIXTURE');const owner=auth.data.user.id;
 const app='http://localhost:3000',stamp=new Date().toISOString();
 server=spawn(process.execPath,['/app/node_modules/next/dist/bin/next','dev','--hostname','localhost','--port','3000'],{cwd:'/app',env:{PATH:'/runtime-bin:/usr/local/bin:/usr/bin:/bin',TMPDIR:'/tmp',NODE_ENV:'development',NODE_OPTIONS:'--dns-result-order=ipv4first',NEXT_TELEMETRY_DISABLED:'1',
  PHASE_N_BROWSER:'ephemeral',PHASE_0B_BROWSER:'ephemeral',PHASE_6A_BROWSER:'ephemeral',NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,
  NATORI_DASHBOARD_KEY:randomBytes(32).toString('hex'),NATORI_OWNER_USER_ID:owner,NATORI_OWNER_EMAILS:email,NEXT_PUBLIC_SITE_URL:app,NATORI_NOTIFICATION_SENDING_ENABLED:'0',RESEND_API_KEY:'',STRIPE_SECRET_KEY:''},stdio:['ignore','pipe','pipe']});
 const compileErrors=new Set();for(const stream of [server.stdout,server.stderr])stream.on('data',buffer=>{for(const code of ['Module not found','Failed to compile','SyntaxError','EADDRINUSE'])if(buffer.toString().includes(code))compileErrors.add(code);});
 let ready=false;const until=Date.now()+120000;while(Date.now()<until&&server.exitCode===null){try{if((await fetch(app+'/ja/fixture-session',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,400));}check(ready,'NEXT_READY');
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 await context.route('**/*',route=>new URL(route.request().url()).origin===app?route.continue():route.abort('blockedbyclient'));
 await page.goto(app+'/ja/fixture-session');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByText('Session ready')).toBeVisible();
 let fixtureNumber=0;
 async function setup(){const title='Task browser '+(++fixtureNumber),p=await admin.from('natori_projects').insert({user_id:owner,title,client_name:'Synthetic',client_email:'client@phase6a.invalid',type:'illustration',amount:12000,status:'rough',next_action:'FIRST_TASK',payment_confirmed_at:stamp,paid_at:stamp,paid_amount:12000}).select('id').single();check(!p.error&&p.data,'PROJECT_FIXTURE');const id=p.data.id;
  check(!(await admin.from('natori_project_tasks').insert([{project_id:id,task_key:'one',label:'FIRST_TASK',stage:'rough',done:false,sort_order:1},{project_id:id,task_key:'two',label:'SECOND_TASK',stage:'lineart',done:false,sort_order:2}])).error,'TASK_FIXTURE');
  await page.goto(app+'/ja/fixture-task-board');const card=page.getByRole('article',{name:title,exact:true});await expect(card).toBeVisible();await expect(card.locator('button[aria-pressed]').filter({hasText:'FIRST_TASK'})).toBeVisible();return {id,title,card,one:card.locator('button[aria-pressed]').filter({hasText:'FIRST_TASK'}),two:card.locator('button[aria-pressed]').filter({hasText:'SECOND_TASK'})};
 }
 const taskApi=app+'/api/natori/admin/projects';
 async function expectCanonicalCard(f,p){
  check(p&&['rough','lineart','delivery_prep'].includes(p.status),'CANONICAL_CARD_STATUS');
  const action=f.card.getByText('次やること',{exact:true}).locator('..').locator(':scope > p');
  await expect(action).toHaveCount(1);await expect(action).toHaveText(p.next_action);
  const label={rough:'ラフ',lineart:'線画',delivery_prep:'納品準備'}[p.status];
  const header=f.card.getByText(f.title,{exact:true}).locator('..').locator('..');
  const badge=header.locator(':scope > div.shrink-0 > div');
  await expect(badge).toHaveCount(1);await expect(badge).toHaveText(label);await expect(badge).toBeVisible();
 }
 async function holdTaskResponses(id){const firstReady=deferred(),secondReady=deferred(),firstRelease=deferred(),secondRelease=deferred(),firstDone=deferred(),secondDone=deferred();const responses=[];
  await page.route('**/api/natori/admin/projects',async route=>{const request=route.request(),input=request.method()==='PATCH'?request.postDataJSON():null;if(input?.kind!=='task'||input.projectId!==id)return route.continue();
   const response=await route.fetch(),data=await response.json();check(response.ok()&&data.project,'REAL_TASK_RESPONSE');const index=responses.length;responses.push(data.project);
   observations.push({stage,status:response.status(),revision:data.project.mutationRevision,canonicalStatus:data.project.status,payloadKeys:Object.keys(input).sort()});
   (index===0?firstReady:secondReady).resolve();await(index===0?firstRelease:secondRelease).promise;await route.fulfill({response});(index===0?firstDone:secondDone).resolve();
  });return {firstReady,secondReady,firstRelease,secondRelease,firstDone,secondDone,responses};
 }
 await test('real-authentication-owner-and-csrf-task-boundaries',async()=>{const f=await setup(),anonymous=await browser.newContext();
  check((await anonymous.request.patch(taskApi,{data:{kind:'task',projectId:f.id,taskKey:'one',done:true},headers:{'x-requested-with':'me-ish'}})).status()===401,'ANON_DENIED');
  check((await context.request.patch(taskApi,{data:{kind:'task',projectId:f.id,taskKey:'one',done:true}})).status()===403,'CSRF_DENIED');await anonymous.close();
 });
 await test('real-db-different-task-responses-reversed-preserve-both-flags-and-status',async()=>{const f=await setup(),held=await holdTaskResponses(f.id);
  await f.one.click();await held.firstReady.promise;await f.two.click();await held.secondReady.promise;held.secondRelease.resolve();await expect(f.two).toHaveAttribute('aria-pressed','true');
  await held.secondDone.promise;held.firstRelease.resolve();await held.firstDone.promise;await page.unroute('**/api/natori/admin/projects');await page.waitForLoadState('networkidle');await expect(f.one).toHaveAttribute('aria-pressed','true');await expect(f.two).toHaveAttribute('aria-pressed','true');
  const p=(await admin.from('natori_projects').select('status,next_action,mutation_revision,completed_at,delivery_accepted_at').eq('id',f.id).single()).data;
  check(p?.status==='delivery_prep'&&!p.completed_at&&!p.delivery_accepted_at,'NO_AUTO_RECEIPT');await expect(f.card.getByText(p.next_action,{exact:true})).toBeVisible();check(held.responses[1].mutationRevision>held.responses[0].mutationRevision,'COMMIT_ORDER');
  await expectCanonicalCard(f,p);check(p.mutation_revision===held.responses[1].mutationRevision,'LATEST_VISIBLE_COMMITTED_REVISION');
 });
 await test('real-db-same-task-reversed-replies-do-not-undo-later-uncheck',async()=>{const f=await setup(),held=await holdTaskResponses(f.id);
  await f.one.click();await held.firstReady.promise;await f.one.click();await held.secondReady.promise;held.secondRelease.resolve();await held.secondDone.promise;await expect(f.one).toHaveAttribute('aria-pressed','false');held.firstRelease.resolve();await held.firstDone.promise;await page.unroute('**/api/natori/admin/projects');await page.waitForLoadState('networkidle');
  await expect(f.one).toHaveAttribute('aria-pressed','false');const task=(await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','one').single()).data;check(task?.done===false,'STORED_UNCHECK');await expect(f.card.getByText('FIRST_TASK',{exact:true}).first()).toBeVisible();
  const projection=await admin.from('natori_projects').select('status,next_action,mutation_revision').eq('id',f.id).single();check(!projection.error&&projection.data,'SAME_TASK_PROJECTION');
  check(projection.data.mutation_revision===held.responses[1].mutationRevision,'SAME_TASK_LATEST_REVISION');await expectCanonicalCard(f,projection.data);
 });
 await test('older-get-released-after-newer-task-result-keeps-latest-checkbox-and-action',async()=>{const f=await setup(),readReady=deferred(),readRelease=deferred();let fail=true,heldRead=false;
  await page.route('**/api/natori/admin/projects',async route=>{const request=route.request();if(request.method()==='PATCH'){const input=request.postDataJSON();if(input.kind==='task'&&input.projectId===f.id&&fail){fail=false;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic unavailable"}'});}return route.continue();}
   if(request.method()==='GET'&&!heldRead){heldRead=true;const response=await route.fetch();readReady.resolve();await readRelease.promise;return route.fulfill({response});}return route.continue();
  });await f.one.click();await readReady.promise;await f.two.click();await expect(f.two).toHaveAttribute('aria-pressed','true');
  const persisted=await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','two').single();
  await expect.poll(async()=>((await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','two').single()).data?.done)).toBe(true);
  // Commit a newer action/status before releasing the older GET snapshot.
  await f.one.click();await expect.poll(async()=>((await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','one').single()).data?.done)).toBe(true);
  const fresh=await admin.from('natori_projects').select('status,next_action,mutation_revision,completed_at,delivery_accepted_at').eq('id',f.id).single();check(!fresh.error&&fresh.data,'OLDER_GET_LATEST_PROJECTION');
  check(fresh.data.status==='delivery_prep'&&!fresh.data.completed_at&&!fresh.data.delivery_accepted_at,'OLDER_GET_NO_AUTO_RECEIPT');
  readRelease.resolve();await expect(page.getByRole('alert')).toBeVisible();await page.unroute('**/api/natori/admin/projects');
  await expect(f.two).toHaveAttribute('aria-pressed','true');check(!persisted.error,'VALID_READ');
  await expect(f.one).toHaveAttribute('aria-pressed','true');await expectCanonicalCard(f,fresh.data);
 });
 await test('terminal-response-reloads-confirmed-state-and-task-does-not-reopen',async()=>{const f=await setup();
  check(!(await admin.from('natori_projects').update({status:'completed',completed_at:stamp,delivery_accepted_at:stamp,delivered_mail_at:stamp}).eq('id',f.id)).error,'TERMINAL_FIXTURE');
  const response=page.waitForResponse(r=>r.url()===taskApi&&r.request().method()==='PATCH');await f.one.click();check((await response).status()===409,'TERMINAL_CONFLICT');await expect(page.getByRole('alert')).toBeVisible();
  const p=(await admin.from('natori_projects').select('status,completed_at,delivery_accepted_at').eq('id',f.id).single()).data;check(p?.status==='completed'&&p.completed_at&&p.delivery_accepted_at,'TERMINAL_RETAINED');
  check((await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','one').single()).data?.done===false,'TERMINAL_NO_TASK_WRITE');
 });
 await context.close();writeFileSync('/results/phase6a-browser.json',JSON.stringify({tests:results,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,
  engine:'Chromium 1.58.2; real Supabase sessions; no iPhone Safari acceptance',compileErrors:[...compileErrors],observations},null,2));
 check(results.length===5&&results.every(r=>r.status==='passed')&&compileErrors.size===0,'BROWSER_FAILED');
}
main().catch(()=>{console.error(`Phase 6A browser failed at ${stage}; raw logs withheld`);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(()=>{server.kill('SIGKILL');resolve();},5000))]);}});
