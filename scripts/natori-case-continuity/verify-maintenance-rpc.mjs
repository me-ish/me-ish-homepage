import {chromium,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
/** Approved synthetic gateway mode only. Stop on any denied/uncertain operation; no alternate route. */
export async function checkMaintenanceRpc({out,app,api,password,owner,other,service,users,sql,check,requests}){
 if(![app,api].every(v=>new URL(v).hostname==='localhost'))throw Error('loopback fixture required');
 const project='a0000000-0000-4000-8000-000000000008',quote='b0000000-0000-4000-8000-000000000008';
 const report={scope:'approved narrow maintenance gateway; normal schema and synthetic data only',target:{project,quote,owner,from:'client8@example.invalid',to:'changed@example.invalid'},passed:[],blocked:[],unrun:['zero-target purge','old retry prevention','one expired dummy payload purge'],rpcAttempts:0,effects:{notificationPayloadsErased:0}};
 const mark=s=>{report.passed.push(s);check(s);};
 const providerEvidence=()=>{try{return readFileSync(out+'/provider.jsonl','utf8').trim().split('\n').filter(Boolean).map(JSON.parse);}catch{return [];}};
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const rpcPath='/rest/v1/rpc/natori_delivery_purge_payloads_v1';
 try{
  const isolation=JSON.parse(readFileSync(out+'/isolation.json','utf8'));expect(isolation.network).toContain('network-none');expect(isolation.hostBindings).toContain('none on containers');
  expect(sql(`select count(*) from natori_projects where id='${project}' and user_id='${owner}' and client_email='client8@example.invalid' and active_quote_id='${quote}'`)).toBe('1');
  expect(sql(`select count(*) from natori_quotes where id='${quote}' and project_id='${project}' and user_id='${owner}'`)).toBe('1');
  mark('Maintenance isolation: fresh network-none/tmpfs normal 53-migration DB, exact synthetic owner/project/quote verified before operations');
  const context=await browser.newContext({serviceWorkers:'block'}),external=[];
  await context.route('**/*',route=>{const u=new URL(route.request().url());if([app,api].includes(u.origin))return route.continue();if(u.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',body:''});if(['www.googletagmanager.com','va.vercel-scripts.com'].includes(u.hostname))return route.fulfill({status:200,contentType:'application/javascript',body:''});external.push(u.hostname);return route.abort();});
  const page=await context.newPage();await page.goto(app+'/admin-login',{waitUntil:'domcontentloaded',timeout:60000});await page.addScriptTag({url:app+'/__case-local-auth.js'});
  expect(await page.evaluate(async({email,password})=>(await window.localAuth.auth.signInWithPassword({email,password})).error?.message,{email:users.staff.email,password})).toBeUndefined();
  const eligible=()=>sql(`select count(*) from natori_notification_jobs n join natori_projects p on p.id=n.project_id where p.user_id='${owner}' and n.purpose='delivery_issue_client' and n.payload->>'purged' is distinct from 'true' and (n.payload->>'expiresAt')::timestamptz<=clock_timestamp()`);
  const jobs=()=>JSON.parse(sql('select coalesce(jsonb_agg(to_jsonb(j) order by id),\'[]\') from natori_notification_jobs j'));
  const purge=async(expected,label)=>{
   expect(eligible()).toBe(String(expected));
   const response=await context.request.post(api+rpcPath,{headers:{apikey:service,Authorization:'Bearer '+service},data:{p_owner_id:owner},maxRetries:0,maxRedirects:0,timeout:60000});
   report.rpcAttempts=requests.filter(r=>r.method==='POST'&&r.path===rpcPath).length;
   if(response.status()!==200){report.blocked.push({action:'POST '+rpcPath,status:response.status(),stage:label,outcome:response.status()>=400&&response.status()<500?'denied':'uncertain'});return false;}
   const result=await response.json();expect(result).toBe(expected);return true;
  };
  const initial=jobs();
  if(!await purge(0,'zero-target'))return {passed:report.passed.length,blocked:report.blocked,unrun:report.unrun};
  expect(jobs()).toEqual(initial);report.unrun.shift();report.zeroTargetResult=0;
  mark('Maintenance zero target: exact service POST reaches DB and returns 0; notification ledger unchanged');
  const payment=app+'/api/natori/admin/case-payment';
  const prepared=await context.request.post(payment,{headers:{'x-requested-with':'me-ish'},data:{action:'prepare',projectId:project,deadline:new Date(Date.now()+3*86400000).toISOString()},maxRetries:0,timeout:60000});expect(prepared.status()).toBe(200);const preview=(await prepared.json()).preview;expect(preview.kind).toBe('initial');expect(preview.to).toEqual(['client8@example.invalid']);
  const confirmed=await context.request.post(payment,{headers:{'x-requested-with':'me-ish'},data:{action:'confirm',projectId:project,operationId:preview.operationId,token:preview.token},maxRetries:0,timeout:60000});expect(confirmed.status()).toBe(200);
  const view=(await(await context.request.get(payment+'?projectId='+project)).json()).view;expect(view.phase).toBe('failed');expect(view.canRetry).toBe(true);const job=view.jobs[0].id;report.target.job=job;
  const oldJob=jobs().find(j=>j.id===job);expect(oldJob.payload.workspace).toBe('natori-case-payment-v1');expect(oldJob.payload.format).toBe('natori-delivery-aes256gcm-v1');
  expect(sql(`select count(*) from natori_payment_link_operations where project_id='${project}' and notification_id='${job}' and workspace_guard is not null`)).toBe('1');
  sql(`update natori_projects set client_email='changed@example.invalid' where id='${project}'`);expect(eligible()).toBe('0');
  const providerBefore=providerEvidence().length,rpcBeforeRetry=requests.filter(r=>r.method==='POST'&&r.path===rpcPath).length;
  const retry=await context.request.post(app+'/api/natori/admin/notifications',{headers:{'x-requested-with':'me-ish'},data:{id:job},maxRetries:0,timeout:60000});
  const calls=requests.filter(r=>r.method==='POST'&&r.path===rpcPath);expect(calls).toHaveLength(rpcBeforeRetry+1);report.rpcAttempts=calls.length;report.oldRetryAppStatus=retry.status();report.gatewayStatuses=calls.map(r=>r.status);
  if(calls.at(-1)?.status!==200){report.blocked.push({action:'POST '+rpcPath,status:calls.at(-1)?.status??'not reached',stage:'old-retry',outcome:'denied-or-uncertain'});return{passed:report.passed.length,blocked:report.blocked,unrun:report.unrun};}
  expect([200,409]).toContain(retry.status());if(retry.status()===409)expect((await retry.json()).error).toBe('retry_unavailable');
  expect(providerEvidence()).toHaveLength(providerBefore);expect(jobs().find(j=>j.id===job)).toEqual(oldJob);
  for(const j of jobs().filter(j=>j.notification_key===oldJob.notification_key&&j.id!==job)){expect(j.payload).toEqual(oldJob.payload);expect(j.send_started_at).toBeNull();expect(j.status).not.toBe('sent');}
  const changed=(await(await context.request.get(payment+'?projectId='+project)).json()).view;expect(changed.phase).toBe('blocked');expect(changed.canPrepare).toBe(false);expect(changed.canRetry).toBe(false);
  report.unrun.shift();report.oldRetryProviderCallsAdded=0;report.setupProviderDoubleCalls=providerBefore;
  mark('Maintenance old retry: real workspace failed notice retains frozen quote/recipient; changed recipient stays blocked through legacy API, with no additional mock provider call');
  const payloadId='e9100000-0000-4000-8000-000000000001';report.payloadTarget=payloadId;
  const definitions=[{id:payloadId,p:'a0000000-0000-4000-8000-000000000001',purpose:'delivery_issue_client',expired:true},{id:'e9100000-0000-4000-8000-000000000002',p:'a0000000-0000-4000-8000-000000000001',purpose:'delivery_issue_client',expired:false},{id:'e9100000-0000-4000-8000-000000000003',p:'a0000000-0000-4000-8000-000000000011',purpose:'delivery_issue_client',expired:true},{id:'e9100000-0000-4000-8000-000000000004',p:'a0000000-0000-4000-8000-000000000002',purpose:'payment_link_client',expired:true}];
  expect(sql(`select count(*) from natori_projects where id='${definitions[2].p}' and user_id='${other}'`)).toBe('1');
  for(const row of definitions)sql(`insert into natori_notification_jobs(id,notification_key,project_id,purpose,status,snapshot,payload,provider_id,send_started_at) values('${row.id}','approved-maintenance/payload/${row.id}','${row.p}','${row.purpose}','unknown','{"fixture":"keep-snapshot"}',jsonb_build_object('format','natori-delivery-aes256gcm-v1','ciphertext','synthetic-ciphertext','iv','synthetic-iv','tag','synthetic-tag','expiresAt',now()${row.expired?'-':'+'}interval '1 day','fixture','preserve-metadata'),'synthetic-provider-reference',now()-interval '2 days')`);
  expect(sql(`select count(*) from natori_notification_jobs where id='${payloadId}' and lease_expires_at is null and claim_token is null`)).toBe('1');
  const before=jobs(),target=before.find(j=>j.id===payloadId);
  // A lost response may follow a committed purge. Do not report zero until reconciled.
  report.effects.notificationPayloadsErased=null;
  if(!await purge(1,'one-expired-payload'))return{passed:report.passed.length,blocked:report.blocked,unrun:report.unrun};
  const after=jobs(),saved=after.find(j=>j.id===payloadId),expected={...target,payload:{...target.payload,ciphertext:'',iv:'',tag:'',purged:true}};
  expect(saved).toEqual(expected);expect(after.filter(j=>j.id!==payloadId)).toEqual(before.filter(j=>j.id!==payloadId));expect(eligible()).toBe('0');expect(providerEvidence()).toHaveLength(providerBefore);expect(external).toEqual([]);
  report.effects.notificationPayloadsErased=1;report.unrun.shift();report.gatewayStatuses=requests.filter(r=>r.method==='POST'&&r.path===rpcPath).map(r=>r.status);expect(report.gatewayStatuses).toEqual([200,200,200]);report.externalProviderRequests=0;report.success=true;
  mark('Maintenance one-row purge: exactly one expired lease-free dummy ciphertext/iv/tag cleared; status unknown, snapshot/key/provider metadata and all other notifications unchanged');
  await context.close();return{passed:report.passed.length,blocked:report.blocked,unrun:report.unrun};
 }catch(error){report.success=false;report.error=error.message.slice(0,1500);throw error;}
 finally{report.rpcAttempts=requests.filter(r=>r.method==='POST'&&r.path===rpcPath).length;writeFileSync(out+'/maintenance-rpc-results.json',JSON.stringify(report,null,2));await browser.close();}
}
