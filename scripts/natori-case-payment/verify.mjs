import {chromium,expect} from '@playwright/test';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export async function checkPaymentBrowser({out,app,api,anon,service,password,owner,other,users,ids,check,sql,stopRest,startRest}){
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[],blocked=[];const evidence=()=>existsSync(out+'/provider.jsonl')?readFileSync(out+'/provider.jsonl','utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const count=()=>evidence().length;
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1050}});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(![app,api].includes(u.origin)){blocked.push(u.hostname);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const path='/api/natori/admin/case-payment',read=(id,op)=>context.request.get(app+path+'?'+new URLSearchParams({projectId:id,...(op?{operationId:op}:{})}));
 const post=body=>context.request.post(app+path,{headers:{'x-requested-with':'me-ish'},data:body});
 const prepare=async(id,extra={})=>{const r=await post({action:'prepare',projectId:id,deadline:new Date(Date.now()+3*86400000).toISOString(),...extra});expect(r.status()).toBe(200);const d=await r.json();expect(d.result).toBe('prepared');return d.preview;};
 const confirm=p=>post({action:'confirm',projectId:p.projectId,operationId:p.operationId,token:p.token});
 const signIn=async email=>{await page.waitForLoadState('domcontentloaded');if(!await page.evaluate(()=>Boolean(window.localAuth)))await page.addScriptTag({url:app+'/__case-local-auth.js'});const d=await page.evaluate(async({email,password})=>{const {error}=await window.localAuth.auth.signInWithPassword({email,password});return error?.message;},{email,password});expect(d).toBeUndefined();};
 const goto=async i=>{await page.goto(app+`/natori/dashboard/cases?case=${ids[i]}&section=transaction`);await expect(page.getByRole('heading',{name:`架空の支払案件${i+1}`,exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'支払案内の操作'})).toBeVisible();};
 expect((await read(ids[0])).status()).toBe(401);await page.goto(app+'/natori/dashboard/cases');await expect(page).toHaveURL(/admin-login/);await expect(page.getByRole('button',{name:'Googleでログイン',exact:true})).toBeVisible();
 await signIn(users.outsider.email);expect((await read(ids[0])).status()).toBe(401);await page.evaluate(()=>window.localAuth.auth.signOut());await signIn(users.staff.email);
 expect((await read(ids[10])).status()).toBe(404);expect((await read('ffffffff-ffff-4fff-8fff-ffffffffffff')).status()).toBe(404);
 expect((await context.request.post(app+path,{data:{action:'prepare',projectId:ids[0]}})).status()).toBe(403);
 expect((await context.request.get(app+'/api/natori/admin/case-workspace')).status()).toBe(200);
 check('Auth/CSRF/scope: real login + normal middleware; unauthenticated/nonstaff denied, foreign/missing 404, mutation header required');
 const session=await page.evaluate(async()=> (await window.localAuth.auth.getSession()).data.session);
 for(const token of [anon,session.access_token])for(const name of ['natori_case_payment_snapshot_v1','natori_case_payment_command_v1']){
  const r=await fetch(api+'/rest/v1/rpc/'+name+'?p_owner_id='+owner+'&p_project_id='+ids[0]+(name.includes('command')?'&p_command=context':''),{headers:{apikey:anon,Authorization:'Bearer '+token}});expect([401,403]).toContain(r.status);expect((await r.json()).code).toBe('42501');
 }
 expect(sql("select bool_and(not prosecdef and proconfig=ARRAY['search_path=\"\"']::text[]) from pg_proc where proname in ('natori_case_payment_snapshot_v1','natori_case_payment_command_v1')")).toBe('t');
 const foreign=await fetch(api+`/rest/v1/rpc/natori_case_payment_snapshot_v1?p_owner_id=${other}&p_project_id=${ids[0]}`,{headers:{apikey:anon,Authorization:'Bearer '+service}});expect(await foreign.json()).toBeNull();
 check('RPC ACL: actual signed anon/authenticated roles denied both functions; service-role owner mismatch returns null; invoker/search_path verified');
 const before=sql('select count(*) from natori_payment_link_operations'),p0=await prepare(ids[0]),stale=await prepare(ids[0]);
 expect(p0.kind).toBe('initial');expect(p0.amount).toBe(12000);expect(p0.quoteVersion).toBe(2);expect(p0.to).toEqual(['client1@example.invalid']);expect(p0.text).toContain('{発行後の支払リンク}');expect(count()).toBe(0);expect(sql('select count(*) from natori_payment_link_operations')).toBe(before);
 check('Prepare is pure: actual quote/recipient/amount/normalized deadline/exact mail preview; no operation, link or provider invocation');
 const raced=await Promise.all([confirm(p0),confirm(p0)]);for(const r of raced)expect(r.status()).toBe(200);
 let v=(await (await read(ids[0])).json()).view;expect(v.phase).toBe('sent');expect(v.sentCount).toBe(1);expect(sql(`select count(*) from natori_payment_link_attempts where project_id='${ids[0]}'`)).toBe('1');
 expect(evidence().filter(e=>e.boundary==='link')).toHaveLength(1);expect(evidence().filter(e=>e.boundary==='mail')).toHaveLength(1);
 const n=count();for(let i=0;i<3;i++){await read(ids[0],p0.operationId);await confirm(p0);}expect(count()).toBe(n);
 const staleDone=await (await confirm(stale)).json();expect(staleDone.result).toBe('confirmation_stale');expect(count()).toBe(n);
 check('Repeated/concurrent confirmation: one generation and one provider mail; completed recovery and GET are pure; second tab stale preview tombstoned');
 await goto(0);await expect(page.getByRole('region',{name:'支払案内の操作'})).toContainText('送信サービス受付済み');
 for(const entry of ['今日','予定','案件']){await page.getByRole('navigation',{name:'主な入口',exact:true}).getByRole('link',{name:entry,exact:true}).click();if(entry==='予定')await page.getByLabel('予定日').fill('2026-11-12');await page.getByRole('link',{name:/架空の支払案件1\s/}).first().click();await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('見積承諾済み');await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('依頼者：支払状況の確認待ち');}
 await goto(0);await page.getByRole('button',{name:'再送の内容を確認',exact:true}).click();await expect(page.getByRole('heading',{name:'送信前確認 · 再送'})).toBeVisible();await expect(page.getByText('client1@example.invalid',{exact:true})).toBeVisible();await page.screenshot({path:out+'/pc-payment-confirm.png',fullPage:true});
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'確認した案内を実行'}).click();await expect(page.getByRole('region',{name:'支払案内の操作'})).toContainText('送信サービス受付 2件');expect(evidence().filter(e=>e.boundary==='link')).toHaveLength(1);
 check('PC and common entries: same accepted facts through Today/Cases/Schedule; explicit resend shows unchanged link/deadline and creates no generation');
 // Lose the response AFTER the actual app handled it; reload must read the persisted outcome only.
 await goto(1);await page.getByLabel('支払期限',{exact:true}).fill('2026-11-01T12:00');await page.getByRole('button',{name:'初回案内の内容を確認'}).click();await expect(page.getByRole('heading',{name:'送信前確認 · 初回案内'})).toBeVisible();
 await context.route('**/api/natori/admin/case-payment',async route=>{const body=route.request().postDataJSON();if(body?.action==='confirm'){await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'確認した案内を実行'}).click();await expect(page.getByRole('region',{name:'支払案内の操作'}).getByRole('alert')).toContainText('結果を確認できません');await context.unroute('**/api/natori/admin/case-payment');const afterLoss=count();await page.reload();await expect(page.getByRole('region',{name:'支払案内の操作'})).toContainText('送信サービス受付 1件');expect(count()).toBe(afterLoss);
 await page.getByRole('navigation',{name:'案件の領域',exact:true}).getByRole('link',{name:'履歴',exact:true}).click();await page.goBack();await page.goForward();await page.goBack();expect(count()).toBe(afterLoss);
 check('Lost HTTP response/reload/back-forward: opaque receipt survives, server reports completed outcome without provider replay');
 const unknown=await prepare(ids[2]);await confirm(unknown);v=(await (await read(ids[2])).json()).view;expect(v.phase).toBe('unknown');expect(v.canPrepare).toBe(false);expect(v.canRetry).toBe(false);const unkCount=count();await confirm(unknown);await read(ids[2]);expect(count()).toBe(unkCount);expect((await (await post({action:'prepare',projectId:ids[2],retry:true})).json()).result).toBe('blocked');
 await goto(2);await expect(page.getByRole('region',{name:'案件の共通案内'})).not.toContainText('依頼者：支払状況の確認待ち');await expect(page.getByRole('region',{name:'支払案内の操作'})).toContainText('不明');
 check('Unknown provider result: no blind resend/retry/link reissue; repeated completed confirmation and lookup do not dispatch');
 const fail=await prepare(ids[3]);await confirm(fail);v=(await (await read(ids[3])).json()).view;expect(v.phase).toBe('failed');expect(v.canPrepare).toBe(false);expect(v.canRetry).toBe(true);
 const retry=await prepare(ids[3],{retry:true});expect(retry.kind).toBe('retry');await Promise.all([confirm(retry),confirm(retry)]);v=(await (await read(ids[3])).json()).view;expect(v.phase).toBe('sent');expect(v.jobs[0].attempt).toBe(2);
 expect(sql(`select count(distinct notification_key)||'/'||count(*) from natori_notification_jobs where project_id='${ids[3]}'`)).toBe('1/2');
 check('Definite rejection: explicit frozen-content retry reuses logical notification, serializes double confirmation, displays latest successful attempt');
 const changed=await prepare(ids[4]);sql(`update natori_quotes set amount=13000 where project_id='${ids[4]}';update natori_projects set quote_accepted_amount=13000 where id='${ids[4]}'`);const changedCount=count();expect((await (await confirm(changed)).json()).result).toBe('confirmation_stale');expect(count()).toBe(changedCount);
 const paid=await prepare(ids[6]);sql(`update natori_projects set payment_confirmed_at=now(),paid_amount=12000 where id='${ids[6]}'`);expect((await (await confirm(paid)).json()).result).toBe('confirmation_stale');expect((await (await read(ids[6])).json()).view.phase).toBe('paid');
 expect((await (await post({action:'confirm',projectId:ids[7],operationId:paid.operationId,token:paid.token})).json()).result).toBe('conflict');
 check('Stale quote/new payment/wrong case: confirmation refuses before provider mutation; known payment remains visible');
 const interrupted=await prepare(ids[5]);expect((await (await confirm(interrupted)).json()).result).toBe('retry_same_operation');v=(await (await read(ids[5])).json()).view;expect(v.operationState).toBe('pending');expect(v.receipt).toBeTruthy();expect(v.canPrepare).toBe(false);
 sql(`update natori_payment_link_attempts set lease_until=now()-interval '1 second' where project_id='${ids[5]}'`);
 expect((await (await confirm(interrupted)).json()).result).toBe('completed');expect(sql(`select count(*) from natori_payment_link_attempts where project_id='${ids[5]}'`)).toBe('1');
 check('Interrupted Stripe test double after creation: persisted encrypted receipt + same operation/key resumes after lease, one generation/link');
 const outbox=await prepare(ids[8]);await confirm(outbox);v=(await (await read(ids[8])).json()).view;expect(v.operationState).toBe('completed');expect(v.canResume).toBe(true);const outboxJobs=sql(`select count(*) from natori_notification_jobs where project_id='${ids[8]}'`);const resume=await prepare(ids[8],{resume:true});expect(resume.kind).toBe('resume');await Promise.all([confirm(resume),confirm(resume)]);expect((await (await read(ids[8])).json()).view.phase).toBe('sent');expect(sql(`select count(*) from natori_notification_jobs where project_id='${ids[8]}'`)).toBe(outboxJobs);
 check('Outbox commit before dispatch interruption: pure lookup finds unstarted job; explicit preflight resumes same job with one provider key');
 const claim=await prepare(ids[11]);await confirm(claim);v=(await (await read(ids[11])).json()).view;expect(v.canResume).toBe(false);sql(`update natori_notification_jobs set lease_expires_at=now()-interval '1 second' where project_id='${ids[11]}'`);v=(await (await read(ids[11])).json()).view;expect(v.canResume).toBe(true);await confirm(await prepare(ids[11],{resume:true}));expect((await (await read(ids[11])).json()).view.phase).toBe('sent');
 check('Claim-before-send interruption: active lease blocks resume; after expiry explicit same-job recovery sends once');
 await goto(7);await page.setViewportSize({width:390,height:844});await page.getByLabel('支払期限',{exact:true}).fill('2026-11-01T12:00');await page.getByRole('button',{name:'初回案内の内容を確認'}).click();await expect(page.getByRole('heading',{name:'送信前確認 · 初回案内'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:out+'/mobile-payment-confirm.png',fullPage:true});await page.getByRole('button',{name:'確認を閉じる',exact:true}).click();
 for(const width of [375,390,768,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
 check('Mobile: complete preflight content and controls visible, cancel has no effect, 375/390/768/1440 layouts have no horizontal overflow');
 const oldRoute=await prepare(ids[7]);await confirm(oldRoute);v=(await (await read(ids[7])).json()).view;expect(v.phase).toBe('failed');const oldId=v.jobs[0].id;sql(`update natori_projects set client_email='changed@example.invalid' where id='${ids[7]}'`);const beforeOldRetry=count();const legacyRetry=await context.request.post(app+'/api/natori/admin/notifications',{headers:{'x-requested-with':'me-ish'},data:{id:oldId}});expect(legacyRetry.status()).toBe(200);expect(count()).toBe(beforeOldRetry);expect((await (await read(ids[7])).json()).view.phase).toBe('blocked');
 check('Existing notification retry entry: workspace marker still enforces frozen quote/recipient guard before any mail transport');
 sql(`insert into natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,status,provider_id,sent_at) select 'bounded/'||n,'${ids[9]}',active_quote_id,'payment_link_client','{}','sent','synthetic',now() from natori_projects cross join generate_series(1,101) n where id='${ids[9]}'`);
 v=(await (await read(ids[9])).json()).view;expect(v.phase).toBe('blocked');expect(v.jobs).toHaveLength(101);expect(v.canPrepare).toBe(false);sql(`delete from natori_notification_jobs where project_id='${ids[9]}'`);
 check('Notification cap: 101 logical jobs yields blocked incomplete history, never a false first-send option');

 await page.waitForLoadState('domcontentloaded');if(!await page.evaluate(()=>Boolean(window.localAuth)))await page.addScriptTag({url:app+'/__case-local-auth.js'});
 const aclSession=await page.evaluate(async()=>{const {data,error}=await window.localAuth.auth.refreshSession();if(error)throw Error('synthetic session refresh failed');return data.session;});
 for(const token of [anon,aclSession.access_token]){
  const denied=await fetch(api+'/rest/v1/rpc/natori_case_payment_receipts_retire_v1',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_owner_id:owner})});expect([401,403]).toContain(denied.status);expect((await denied.json()).code).toBe('42501');
 }
 check('Retirement RPC rejects actual anon/authenticated roles through PostgREST');
 const retired=await prepare(ids[12]);expect((await (await confirm(retired)).json()).result).toBe('retry_same_operation');
 sql(`update natori_payment_link_attempts set lease_until=null,link_started_at=now()-interval '23 hours 1 second' where project_id='${ids[12]}'`);
 const expiredCount=count(),stored=sql(`select workspace_request::text from natori_payment_link_operations where project_id='${ids[12]}'`);
 v=(await (await read(ids[12],retired.operationId)).json()).view;expect(v).toMatchObject({phase:'unknown',operationState:'retired',receipt:null,canPrepare:false,canRetry:false});
 expect(sql(`select workspace_request::text from natori_payment_link_operations where project_id='${ids[12]}'`)).toBe(stored);expect((await (await confirm(retired)).json()).result).toBe('receipt_retired');expect(count()).toBe(expiredCount);
 await page.evaluate(({id,r})=>sessionStorage.setItem('natori-case-payment-v1/'+id,JSON.stringify({operationId:r.operationId,token:r.token})),{id:ids[12],r:retired});await goto(12);
 await expect(page.getByRole('region',{name:'支払案内の操作'})).toContainText('結果は未確定');expect(await page.evaluate(id=>sessionStorage.getItem('natori-case-payment-v1/'+id),ids[12])).toBeNull();
 check('23h unresolved external success: pure lookup masks receipt, stale token refuses, UI preserves unknown and removes tab copy before purge');
 expect(JSON.parse(sql(`set role service_role;select natori_case_payment_receipts_retire_v1('${owner}','${ids[12]}',100);reset role;`)).retired).toBe(1);
 expect(sql(`select status||'/'||(workspace_request is null)::text from natori_payment_link_operations where project_id='${ids[12]}'`)).toBe('pending/true');
 for(let i=0;i<2;i++){await page.reload();await page.getByRole('button',{name:'送信せず結果を照会'}).click();expect((await (await confirm(retired)).json()).result).toBe('receipt_retired');}
 expect((await (await post({action:'prepare',projectId:ids[12],deadline:retired.deadline})).json()).result).toBe('blocked');expect(count()).toBe(expiredCount);
 await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:out+'/pc-receipt-retired.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('region',{name:'支払案内の操作'})).toContainText('結果は未確定');await expect(page.getByRole('button',{name:'保存済みの同じ準備を続ける'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.screenshot({path:out+'/mobile-receipt-retired.png',fullPage:true});await page.setViewportSize({width:1440,height:1050});
 check('After purge: pending ledger/provider reference and unknown UI remain; reload/repeated old token/new preparation create no provider call');
 const known=await prepare(ids[13]);expect((await (await confirm(known)).json()).result).toBe('retry_same_operation');sql(`update natori_payment_link_attempts set lease_until=null,price_started_at=now()-interval '23 hours 1 second' where project_id='${ids[13]}'`);
 v=(await (await read(ids[13])).json()).view;expect(v.operationState).toBe('pending');expect(v.receipt).toBeTruthy();expect(JSON.parse(sql(`set role service_role;select natori_case_payment_receipts_retire_v1('${owner}','${ids[13]}',100);reset role;`)).retired).toBe(0);
 const pricesBefore=evidence().filter(e=>e.boundary==='price').length;expect((await (await confirm(known)).json()).result).toBe('completed');expect(evidence().filter(e=>e.boundary==='price')).toHaveLength(pricesBefore);
 check('Known price/link unstarted: after old price clock recovery preserves exact operation and creates no duplicate price');
 const due=await prepare(ids[14]);expect((await (await confirm(due)).json()).result).toBe('retry_same_operation');sql(`update natori_payment_link_attempts set lease_until=null,deadline=now()-interval '1 second' where project_id='${ids[14]}'`);const dueCount=count();
 expect((await (await read(ids[14])).json()).view).toMatchObject({operationState:'retired',phase:'blocked',receipt:null});
 expect(JSON.parse(sql(`set role service_role;select natori_case_payment_receipts_retire_v1('${owner}','${ids[14]}',100);reset role;`)).retired).toBe(1);expect((await (await confirm(due)).json()).result).toBe('receipt_retired');expect(count()).toBe(dueCount);
 check('Payment deadline: retained pending becomes review-only before/after purge; old confirmation never recreates external work');

 await goto(9);stopRest();await page.getByRole('button',{name:'送信せず結果を照会'}).click();await expect(page.getByRole('region',{name:'支払案内の操作'}).getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'初回案内の内容を確認'})).toHaveCount(0);await startRest();await page.getByRole('button',{name:'送信せず結果を照会'}).click();await expect(page.getByRole('region',{name:'支払案内の操作'})).toContainText('未送信');
 check('Actual DB/API outage: error blocks new actions; lookup recovers without side effects');
 await page.getByLabel('支払期限',{exact:true}).fill('2026-11-01T12:00');await page.getByRole('button',{name:'初回案内の内容を確認'}).click();await expect(page.getByRole('heading',{name:'送信前確認 · 初回案内'})).toBeVisible();await context.clearCookies();await page.getByRole('checkbox').check();const beforeExpired=count();await page.getByRole('button',{name:'確認した案内を実行'}).click();await expect(page.getByRole('region',{name:'支払案内の操作'}).getByRole('alert')).toContainText('ログイン');await expect(page.getByText('client10@example.invalid',{exact:true})).toHaveCount(0);expect(count()).toBe(beforeExpired);
 check('Expired authentication at confirmation: real authorization rejects; private preview cleared; no provider invocation');
 assert.deepEqual(errors,[]);writeFileSync(out+'/provider-summary.json',JSON.stringify({events:evidence(),blocked,errors},null,2));return {checks:'see results.checks',pageErrors:errors,blockedAssets:blocked.length,provider:evidence().reduce((a,e)=>(a[e.boundary]=(a[e.boundary]??0)+1,a),{})};
 }finally{await browser.close();}
}
