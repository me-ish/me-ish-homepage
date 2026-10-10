import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setDefaultResultOrder} from 'node:dns';
import {createServerDiagnostics} from './server-diagnostics.mjs';
const require=createRequire('/app/package.json'),{createClient}=require('@supabase/supabase-js'),{chromium,expect}=require('@playwright/test');
setDefaultResultOrder('ipv4first');
const results=[],observations=[],check=(value,code)=>{if(!value)throw new Error(code);};
const reloadPersistence=[],screenshots=[];
const screenshotCatalog=[
 {file:'phase6a-board-desktop-before-save.png',stage:'before-save',viewportWidth:1280,viewportHeight:900},
 {file:'phase6a-board-mobile390-before-save.png',stage:'before-save',viewportWidth:390,viewportHeight:844},
 {file:'phase6a-board-desktop-after-reload.png',stage:'after-reload',viewportWidth:1280,viewportHeight:900},
 {file:'phase6a-board-mobile390-after-reload.png',stage:'after-reload',viewportWidth:390,viewportHeight:844},
];
const routeFailures=[],routeUnblocks=new Set();let cleanupPageRoutes;
const phase6aFailureCodes = new Set(["ANON_DENIED","ASSERTION_FAILED","AUTH_FIXTURE","BROWSER_FAILED","CANONICAL_CARD_STATUS","COMMIT_ORDER","CSRF_DENIED","DESTINATION_REJECTED","DETAILS_DB_COMMITTED","DETAILS_PATCH_COMMITTED","DETAILS_TASK_RESPONSE","EPHEMERAL_REQUIRED","HELD_GET_DETAILS_ROW","LATEST_TASK_DETAILS_RESPONSE","LATEST_TASK_PRESERVES_DETAILS_AND_RAW_PAYMENT","LATEST_VISIBLE_COMMITTED_REVISION","LEGACY_PAYMENT_FIXTURE","NEXT_READY","NO_AUTO_RECEIPT","OLDER_GET_LATEST_PROJECTION","OLDER_GET_NO_AUTO_RECEIPT","PROJECT_FIXTURE","REAL_TASK_RESPONSE","SAME_TASK_LATEST_REVISION","SAME_TASK_PROJECTION","STORED_UNCHECK","TASK_FIXTURE","TERMINAL_CONFLICT","TERMINAL_FIXTURE","TERMINAL_NO_TASK_WRITE","TERMINAL_RETAINED","VALID_READ","ROUTE_CLEANUP_FAILED","RELOAD_FIXTURE","RELOAD_AUTHENTICATED_GET","RELOAD_PROJECT","RELOAD_TASKS","RELOAD_RAW_PAYMENT","RELOAD_READ_ONLY","RELOAD_PERSISTENCE_FAILED","SCREENSHOT_PNG","SCREENSHOT_DIMENSIONS","SCREENSHOTS_FAILED"]);
function safePhase6aFailureCode(error) {
 const message=typeof error?.message==='string'?error.message:'';
 return phase6aFailureCodes.has(message)?message:'ASSERTION_FAILED';
}
let stage='preflight',server,browser;
const diagnostics=createServerDiagnostics({getCaseIndex:()=>stage==='preflight'?0:results.length+1,
 onUpdate:evidence=>writeFileSync('/results/phase6a-server-diagnostics.json',JSON.stringify(evidence,null,2))});
async function test(name,fn){stage=name;const failuresBefore=routeFailures.length;let failureCode=null;
 try{await fn();}catch(error){failureCode=safePhase6aFailureCode(error);}
 for(const unblock of routeUnblocks)unblock();routeUnblocks.clear();
 try{await cleanupPageRoutes?.();}catch{failureCode='ROUTE_CLEANUP_FAILED';}
 if(routeFailures.length>failuresBefore&&!failureCode)failureCode='REAL_TASK_RESPONSE';
 if(failureCode){results.push({name,status:'failed',code:failureCode});console.log(`FAIL phase6a-browser/${name}`);}
 else{results.push({name,status:'passed'});console.log(`PASS phase6a-browser/${name}`);}}
async function awaitTaskControl(control){check((await control.promise)!==false,'REAL_TASK_RESPONSE');}
function classifyRouteApiError(data){
 switch(data?.error){case 'Task update is unavailable':return 'task_unavailable';case 'Task not found':return 'task_not_found';case 'task_conflict':return 'task_conflict';case 'Unauthorized':return 'unauthorized';case 'taskKey, projectId and done are required':return 'invalid_task_request';case 'Failed to fetch projects':return 'projects_unavailable';case 'Failed to fetch tasks':return 'tasks_unavailable';default:return data===null?'invalid_json':'other';}
}
function recordRouteFailure(caseName,operation,status,data){routeFailures.push({caseName,operation,status:Number.isInteger(status)&&status>=0&&status<=599?status:0,apiError:status===0?'fetch_failed':classifyRouteApiError(data)});}
async function finishFailedRoute(route,response){try{if(response)await route.fulfill({response});else await route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic unavailable"}'});}catch{try{await route.abort('failed');}catch{}}}
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
 const compileErrors=diagnostics.codes;for(const name of ['stdout','stderr'])server[name].on('data',buffer=>diagnostics.write(name,buffer));
 let ready=false;const until=Date.now()+120000;while(Date.now()<until&&server.exitCode===null){try{if((await fetch(app+'/ja/fixture-session',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,400));}check(ready,'NEXT_READY');
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 cleanupPageRoutes=()=>page.unrouteAll({behavior:'wait'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===app?route.continue():route.abort('blockedbyclient'));
 await page.goto(app+'/ja/fixture-session');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByText('Session ready')).toBeVisible();
 let fixtureNumber=0;
 async function setup(){const title='Task browser '+(++fixtureNumber),p=await admin.from('natori_projects').insert({user_id:owner,title,client_name:'Synthetic',client_email:'client@phase6a.invalid',type:'illustration',delivery_plan:'normal',amount:12000,status:'rough',next_action:'FIRST_TASK',payment_confirmed_at:stamp,paid_at:null,paid_amount:12000}).select('id,payment_confirmed_at,paid_at,paid_amount').single();check(!p.error&&p.data,'PROJECT_FIXTURE');check(p.data.paid_at===null&&p.data.paid_amount===12000&&new Date(p.data.payment_confirmed_at).toISOString()===stamp,'LEGACY_PAYMENT_FIXTURE');const id=p.data.id;
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
 const persistedProjectFields=['id','title','client_name','client_email','amount','type','delivery_plan','priority','start_date','due_date','created_at','note','request_data','status','next_action','mutation_revision','payment_confirmed_at','paid_at','paid_amount','completed_at','delivery_accepted_at','delivered_mail_at','deleted_at'];
 const persistedTaskFields=['id','project_id','task_key','label','stage','done','sort_order','estimated_hours'];
 const timestampFields=new Set(['created_at','payment_confirmed_at','paid_at','completed_at','delivery_accepted_at','delivered_mail_at','deleted_at']);
 function projectValues(row){return Object.fromEntries(persistedProjectFields.map(key=>[key,timestampFields.has(key)&&row[key]!==null?Date.parse(row[key]):row[key]]));}
 function taskValues(rows){return rows.map(row=>Object.fromEntries(persistedTaskFields.map(key=>[key,row[key]]))).sort((a,b)=>a.task_key.localeCompare(b.task_key));}
 async function readPersistedState(f){
  const [project,tasks]=await Promise.all([admin.from('natori_projects').select(persistedProjectFields.join(',')).eq('id',f.id).single(),admin.from('natori_project_tasks').select(persistedTaskFields.join(',')).eq('project_id',f.id)]);
  check(!project.error&&project.data?.id===f.id&&!tasks.error&&Array.isArray(tasks.data),'RELOAD_FIXTURE');
  return {project:project.data,tasks:tasks.data};
 }
 async function assertRenderedState(f,p,flags){
  check(p.id===f.id,'RELOAD_PROJECT');f.title=p.title;f.card=page.getByRole('article',{name:f.title,exact:true});
  f.one=f.card.locator('button[aria-pressed]').filter({hasText:'FIRST_TASK'});f.two=f.card.locator('button[aria-pressed]').filter({hasText:'SECOND_TASK'});
  if(p.due_date!==null){const day=page.getByRole('button',{name:p.due_date+' の案件を表示',exact:true});await expect(day).toHaveCount(1);await day.click();await expect(day).toHaveAttribute('aria-pressed','true');}
  await expect(f.card).toHaveCount(1);await expect(f.card).toBeVisible();await expect(f.one).toHaveCount(1);await expect(f.two).toHaveCount(1);
  await expect(f.one).toHaveAttribute('aria-pressed',String(flags.one));await expect(f.two).toHaveAttribute('aria-pressed',String(flags.two));await expectCanonicalCard(f,p);
  await expect(f.card.getByText(p.title,{exact:true})).toHaveCount(1);await expect(f.card.getByText(p.title,{exact:true})).toBeVisible();
  await expect(f.card.getByText(p.client_name,{exact:true})).toHaveCount(1);await expect(f.card.getByText(p.client_name,{exact:true})).toBeVisible();
  const due=f.card.getByText('納期',{exact:true}).locator('..').locator(':scope > span.font-bold');const amount=f.card.getByText('金額',{exact:true}).locator('..').locator(':scope > span.font-bold');
  const [year,month,day]=(p.due_date??'').split('-').map(Number),dueLabel=p.due_date===null?'未定':new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',weekday:'short'}).format(new Date(year,month-1,day));
  const amountLabel=p.amount===null?'未定':p.amount===0?'無料':new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(p.amount);
  await expect(due).toHaveCount(1);await expect(due).toHaveText(dueLabel);await expect(amount).toHaveCount(1);await expect(amount).toHaveText(amountLabel);
  if(p.note){await expect(f.card.getByText(p.note,{exact:true})).toHaveCount(1);await expect(f.card.getByText(p.note,{exact:true})).toBeVisible();}
 }
 async function verifyReloadPersistence(f,flags,expected){
  const before=await readPersistedState(f);for(const [key,value] of Object.entries(expected))await expect(before.project[key]).toEqual(value);
  check(before.tasks.length===2&&before.tasks.every(task=>task.project_id===f.id&&Object.hasOwn(flags,task.task_key)&&task.done===flags[task.task_key]),'RELOAD_TASKS');
  await assertRenderedState(f,before.project,flags);
  const responseReady=page.waitForResponse(response=>response.url()===taskApi&&response.request().method()==='GET');void responseReady.catch(()=>{});
  await page.reload();const response=await responseReady;check(response.status()===200,'RELOAD_AUTHENTICATED_GET');const data=await response.json();
  check(Array.isArray(data.projects)&&Array.isArray(data.tasks),'RELOAD_AUTHENTICATED_GET');const projects=data.projects.filter(project=>project.id===f.id),tasks=data.tasks.filter(task=>task.project_id===f.id);
  check(projects.length===1,'RELOAD_PROJECT');await expect(projectValues(projects[0])).toEqual(projectValues(before.project));await expect(taskValues(tasks)).toEqual(taskValues(before.tasks));
  check(projects[0].paid_at===null&&projects[0].paid_amount===12000&&Date.parse(projects[0].payment_confirmed_at)===Date.parse(before.project.payment_confirmed_at),'RELOAD_RAW_PAYMENT');
  await assertRenderedState(f,projects[0],flags);const after=await readPersistedState(f);
  await expect(projectValues(after.project)).toEqual(projectValues(before.project));await expect(taskValues(after.tasks)).toEqual(taskValues(before.tasks));
  check(after.project.mutation_revision===before.project.mutation_revision,'RELOAD_READ_ONLY');
  reloadPersistence.push({caseName:stage,status:'passed',authenticatedGet:true,sameProject:true,projectMetadataMatch:true,taskRowsMatch:true,revisionMatch:true,rawPaymentMatch:true,canonicalRendered:true,readOnlyDatabaseMatch:true,revision:after.project.mutation_revision,taskCount:after.tasks.length});
  return after.project;
 }
 async function captureVerifiedBoard(f,timing,flags,p){
  for(const spec of screenshotCatalog.filter(entry=>entry.stage===timing)){
   await page.setViewportSize({width:spec.viewportWidth,height:spec.viewportHeight});await assertRenderedState(f,p,flags);
   const png=await page.screenshot({path:'/results/'+spec.file,fullPage:true,animations:'disabled',caret:'hide'});
   check(png.length>24&&png.subarray(0,8).toString('hex')==='89504e470d0a1a0a','SCREENSHOT_PNG');const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
   check(width===spec.viewportWidth&&height>=spec.viewportHeight&&height<=20000&&png.length<=10000000,'SCREENSHOT_DIMENSIONS');
   screenshots.push({file:spec.file,caseName:stage,stage:timing,viewportWidth:spec.viewportWidth,viewportHeight:spec.viewportHeight,width,height,sha256:createHash('sha256').update(png).digest('hex'),fullPage:true,sameProject:true,canonicalRendered:true});
  }
  await page.setViewportSize({width:1280,height:900});
 }
 async function holdTaskResponses(id){const firstReady=deferred(),secondReady=deferred(),firstRelease=deferred(),secondRelease=deferred(),firstDone=deferred(),secondDone=deferred();const responses=[],caseName=stage;
  const unblock=()=>{for(const control of [firstReady,secondReady,firstRelease,secondRelease,firstDone,secondDone])control.resolve(false);};routeUnblocks.add(unblock);
  await page.route('**/api/natori/admin/projects',async route=>{const request=route.request();let response,data=null,status=0;try{
    const input=request.method()==='PATCH'?request.postDataJSON():null;if(input?.kind!=='task'||input.projectId!==id)return await route.continue();
    response=await route.fetch({timeout:30000});status=response.status();data=await response.json().catch(()=>null);check(response.ok()&&data?.project,'REAL_TASK_RESPONSE');const index=responses.length;responses.push(data.project);
    observations.push({stage:caseName,status:response.status(),revision:data.project.mutationRevision,canonicalStatus:data.project.status,payloadKeys:Object.keys(input).sort()});
    (index===0?firstReady:secondReady).resolve();await(index===0?firstRelease:secondRelease).promise;await route.fulfill({response});(index===0?firstDone:secondDone).resolve();
   }catch{recordRouteFailure(caseName,'task_patch',status,data);unblock();await finishFailedRoute(route,response);}
  });return {firstReady,secondReady,firstRelease,secondRelease,firstDone,secondDone,responses};
 }
 await test('real-authentication-owner-and-csrf-task-boundaries',async()=>{const f=await setup(),anonymous=await browser.newContext();
  check((await anonymous.request.patch(taskApi,{data:{kind:'task',projectId:f.id,taskKey:'one',done:true},headers:{'x-requested-with':'me-ish'}})).status()===401,'ANON_DENIED');
  check((await context.request.patch(taskApi,{data:{kind:'task',projectId:f.id,taskKey:'one',done:true}})).status()===403,'CSRF_DENIED');await anonymous.close();
 });
 await test('real-db-different-task-responses-reversed-preserve-both-flags-and-status',async()=>{const f=await setup(),held=await holdTaskResponses(f.id);
  await f.one.click();await awaitTaskControl(held.firstReady);await f.two.click();await awaitTaskControl(held.secondReady);held.secondRelease.resolve();await expect(f.two).toHaveAttribute('aria-pressed','true');
  await awaitTaskControl(held.secondDone);held.firstRelease.resolve();await awaitTaskControl(held.firstDone);await page.unroute('**/api/natori/admin/projects');await page.waitForLoadState('networkidle');await expect(f.one).toHaveAttribute('aria-pressed','true');await expect(f.two).toHaveAttribute('aria-pressed','true');
  const p=(await admin.from('natori_projects').select('status,next_action,mutation_revision,completed_at,delivery_accepted_at').eq('id',f.id).single()).data;
  check(p?.status==='delivery_prep'&&!p.completed_at&&!p.delivery_accepted_at,'NO_AUTO_RECEIPT');await expect(f.card.getByText(p.next_action,{exact:true})).toBeVisible();check(held.responses[1].mutationRevision>held.responses[0].mutationRevision,'COMMIT_ORDER');
  await expectCanonicalCard(f,p);check(p.mutation_revision===held.responses[1].mutationRevision,'LATEST_VISIBLE_COMMITTED_REVISION');
  await verifyReloadPersistence(f,{one:true,two:true},p);
 });
 await test('real-db-same-task-reversed-replies-do-not-undo-later-uncheck',async()=>{const f=await setup(),held=await holdTaskResponses(f.id);
  await f.one.click();await awaitTaskControl(held.firstReady);await f.one.click();await awaitTaskControl(held.secondReady);held.secondRelease.resolve();await awaitTaskControl(held.secondDone);await expect(f.one).toHaveAttribute('aria-pressed','false');held.firstRelease.resolve();await awaitTaskControl(held.firstDone);await page.unroute('**/api/natori/admin/projects');await page.waitForLoadState('networkidle');
  await expect(f.one).toHaveAttribute('aria-pressed','false');const task=(await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','one').single()).data;check(task?.done===false,'STORED_UNCHECK');await expect(f.card.getByText('FIRST_TASK',{exact:true}).first()).toBeVisible();
  const projection=await admin.from('natori_projects').select('status,next_action,mutation_revision').eq('id',f.id).single();check(!projection.error&&projection.data,'SAME_TASK_PROJECTION');
  check(projection.data.mutation_revision===held.responses[1].mutationRevision,'SAME_TASK_LATEST_REVISION');await expectCanonicalCard(f,projection.data);
  await verifyReloadPersistence(f,{one:false,two:false},projection.data);
 });
 await test('older-get-released-after-newer-task-result-keeps-latest-checkbox-and-action',async()=>{const f=await setup(),readReady=deferred(),readRelease=deferred();let fail=true,heldRead=false;
  const beforeSave=await readPersistedState(f);await captureVerifiedBoard(f,'before-save',{one:false,two:false},beforeSave.project);
  const selectedDay=page.locator('button[aria-pressed="true"][aria-label$=" の案件を表示"]');
  await expect(selectedDay).toHaveCount(1);const selectedDateLabel=await selectedDay.getAttribute('aria-label');
  const selectedDate=/^(\d{4}-\d{2})-(\d{2}) の案件を表示$/.exec(selectedDateLabel??'');check(selectedDate,'ASSERTION_FAILED');
  const detailMonth=selectedDate[1],detailDueDay=selectedDate[2]==='26'?'27':'26';
  const details={title:f.title+' details B',client_name:'Synthetic details B',amount:12000,start_date:detailMonth+'-05',due_date:detailMonth+'-'+detailDueDay,note:'Synthetic details B note'};
  const detailsResponse=await context.request.patch(taskApi,{data:{kind:'project-details',projectId:f.id,patch:details},headers:{'x-requested-with':'me-ish'}});check(detailsResponse.ok(),'DETAILS_PATCH_COMMITTED');
  const beforeTask=await admin.from('natori_projects').select('title,client_name,amount,start_date,due_date,note,mutation_revision,payment_confirmed_at,paid_at,paid_amount').eq('id',f.id).single();
  check(!beforeTask.error&&beforeTask.data&&Object.entries(details).every(([key,value])=>beforeTask.data[key]===value)&&beforeTask.data.paid_at===null&&beforeTask.data.paid_amount===12000,'DETAILS_DB_COMMITTED');const taskReplies=[];
  const caseName=stage,unblockRead=()=>{readReady.resolve(false);readRelease.resolve(false);};routeUnblocks.add(unblockRead);
  await page.route('**/api/natori/admin/projects',async route=>{const request=route.request();let response,data=null,status=0;try{
   if(request.method()==='PATCH'){const input=request.postDataJSON();if(input.kind==='task'&&input.projectId===f.id&&fail){fail=false;return await route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic unavailable"}'});}if(input.kind==='task'&&input.projectId===f.id){response=await route.fetch({timeout:30000});status=response.status();data=await response.json().catch(()=>null);check(response.ok()&&data?.project,'DETAILS_TASK_RESPONSE');taskReplies.push(data.project);return await route.fulfill({response});}return await route.continue();}
   if(request.method()==='GET'&&!heldRead){heldRead=true;response=await route.fetch({timeout:30000});status=response.status();data=await response.json().catch(()=>null);const project=data?.projects?.find(p=>p.id===f.id);check(response.ok()&&project?.mutation_revision===beforeTask.data.mutation_revision&&Object.entries(details).every(([key,value])=>project[key]===value),'HELD_GET_DETAILS_ROW');readReady.resolve();await readRelease.promise;return await route.fulfill({response});}return await route.continue();
   }catch{recordRouteFailure(caseName,request.method()==='GET'?'projects_get':'task_patch',status,data);unblockRead();await finishFailedRoute(route,response);}
  });await f.one.click();await awaitTaskControl(readReady);await f.two.click();
  await expect.poll(()=>taskReplies.length).toBe(1);
  await expect(page.getByRole('article',{name:f.title,exact:true})).toHaveCount(0);
  const dueDay=page.getByRole('button',{name:details.due_date+' の案件を表示',exact:true});
  await expect(dueDay).toHaveCount(1);await dueDay.click();await expect(dueDay).toHaveAttribute('aria-pressed','true');
  f.title=details.title;f.card=page.getByRole('article',{name:f.title,exact:true});f.one=f.card.locator('button[aria-pressed]').filter({hasText:'FIRST_TASK'});f.two=f.card.locator('button[aria-pressed]').filter({hasText:'SECOND_TASK'});
  await expect(f.two).toHaveAttribute('aria-pressed','true');
  const persisted=await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','two').single();
  await expect.poll(async()=>((await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','two').single()).data?.done)).toBe(true);
  // Commit a newer action/status before releasing the older GET snapshot.
  await f.one.click();await expect.poll(async()=>((await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','one').single()).data?.done)).toBe(true);
  const fresh=await admin.from('natori_projects').select('status,next_action,mutation_revision,completed_at,delivery_accepted_at,title,client_name,amount,start_date,due_date,note,payment_confirmed_at,paid_at,paid_amount').eq('id',f.id).single();check(!fresh.error&&fresh.data,'OLDER_GET_LATEST_PROJECTION');
  check(Object.entries(details).every(([key,value])=>fresh.data[key]===value)&&fresh.data.paid_at===null&&fresh.data.paid_amount===12000&&fresh.data.payment_confirmed_at===beforeTask.data.payment_confirmed_at,'LATEST_TASK_PRESERVES_DETAILS_AND_RAW_PAYMENT');
  check(fresh.data.status==='delivery_prep'&&!fresh.data.completed_at&&!fresh.data.delivery_accepted_at,'OLDER_GET_NO_AUTO_RECEIPT');
  readRelease.resolve();await expect(page.getByRole('alert')).toBeVisible();await page.unroute('**/api/natori/admin/projects');
  await expect(f.two).toHaveAttribute('aria-pressed','true');check(!persisted.error,'VALID_READ');
  await expect(f.one).toHaveAttribute('aria-pressed','true');await expectCanonicalCard(f,fresh.data);
  await expect(f.card.getByText(details.title,{exact:true})).toHaveCount(1);await expect(f.card.getByText(details.title,{exact:true})).toBeVisible();
  const latestReply=taskReplies.at(-1);check(latestReply&&latestReply.mutationRevision===fresh.data.mutation_revision&&latestReply.title===details.title&&latestReply.clientName===details.client_name&&latestReply.amount===details.amount&&latestReply.startDate===details.start_date&&latestReply.dueDate===details.due_date&&latestReply.note===details.note&&latestReply.paidAt===null&&latestReply.paidAmount===12000&&latestReply.paymentConfirmedAt===fresh.data.payment_confirmed_at,'LATEST_TASK_DETAILS_RESPONSE');
  const reloaded=await verifyReloadPersistence(f,{one:true,two:true},fresh.data);await captureVerifiedBoard(f,'after-reload',{one:true,two:true},reloaded);
 });
 await test('terminal-response-reloads-confirmed-state-and-task-does-not-reopen',async()=>{const f=await setup();
  check(!(await admin.from('natori_projects').update({status:'completed',completed_at:stamp,delivery_accepted_at:stamp,delivered_mail_at:stamp}).eq('id',f.id)).error,'TERMINAL_FIXTURE');
  const response=page.waitForResponse(r=>r.url()===taskApi&&r.request().method()==='PATCH');void response.catch(()=>{});await f.one.click();check((await response).status()===409,'TERMINAL_CONFLICT');await expect(page.getByRole('alert')).toBeVisible();
  const p=(await admin.from('natori_projects').select('status,completed_at,delivery_accepted_at').eq('id',f.id).single()).data;check(p?.status==='completed'&&p.completed_at&&p.delivery_accepted_at,'TERMINAL_RETAINED');
  check((await admin.from('natori_project_tasks').select('done').eq('project_id',f.id).eq('task_key','one').single()).data?.done===false,'TERMINAL_NO_TASK_WRITE');
 });
 await context.close();diagnostics.flush();writeFileSync('/results/phase6a-browser.json',JSON.stringify({tests:results,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,
  engine:'Chromium 1.58.2; real Supabase sessions; no iPhone Safari acceptance',compileErrors:[...compileErrors],observations,routeFailures,reloadPersistence,screenshots},null,2));
 check(results.length===5&&results.every(r=>r.status==='passed')&&compileErrors.size===0,'BROWSER_FAILED');
 check(reloadPersistence.length===3&&reloadPersistence.every(proof=>proof.status==='passed'),'RELOAD_PERSISTENCE_FAILED');
 check(screenshots.length===4&&screenshots.every(proof=>proof.fullPage&&proof.sameProject&&proof.canonicalRendered),'SCREENSHOTS_FAILED');
 check(routeFailures.length===0,'REAL_TASK_RESPONSE');
}
main().catch(error=>{console.error(`Phase 6A browser failed: ${safePhase6aFailureCode(error)} at ${stage}; raw logs withheld`);console.error('Phase 6A server classifications: '+JSON.stringify(diagnostics.flush()));process.exitCode=1;}).finally(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(()=>{server.kill('SIGKILL');resolve();},5000))]);}});
