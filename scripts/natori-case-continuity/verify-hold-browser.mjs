import {chromium,expect as baseExpect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const expect=baseExpect.configure({timeout:30000});
export async function checkHoldBrowser({out,app,api,password,users,owner,other,ids,sql,check}){
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const checks=[],external=[],blockedAnalytics=[],errors=[],mark=s=>{checks.push(s);check(s);};
 const providers=()=>{try{return readFileSync(out+'/provider.jsonl','utf8').trim().split('\n').filter(Boolean).length;}catch{return 0;}};
 const status=()=>JSON.parse(sql(`select natori_case_system_status_v1('${owner}')`));
 const control=action=>JSON.parse(sql(`select natori_case_system_control_v2('${owner}','${action}',${status().generation},'{"kind":"auth-user","userId":"${users.staff.id}"}'::jsonb,${action.startsWith('resume-')?`'${JSON.parse(sql(`select natori_case_system_review_v1('${owner}')`)).revision}'`:'null'},true)`));
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if([app,api].includes(u.origin))return route.continue();if(u.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',body:''});if(['www.googletagmanager.com','va.vercel-scripts.com'].includes(u.hostname)){blockedAnalytics.push(u.hostname);return route.fulfill({status:200,contentType:'application/javascript',body:''});}external.push(u.hostname);return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  expect((await context.request.get(app+'/api/natori/admin/case-system')).status()).toBe(401);
  await page.goto(app+'/natori/dashboard');await expect(page.getByRole('button',{name:'Googleでログイン',exact:true})).toBeVisible();await page.addScriptTag({url:app+'/__case-local-auth.js'});
  const login=async email=>expect(await page.evaluate(async({email,password})=>(await window.localAuth.auth.signInWithPassword({email,password})).error?.message,{email,password})).toBeUndefined();
  await login(users.outsider.email);expect((await context.request.get(app+'/api/natori/admin/case-system')).status()).toBe(401);await page.evaluate(()=>window.localAuth.auth.signOut());await login(users.staff.email);
  expect((await context.request.get(app+'/api/natori/admin/case-system')).status()).toBe(200);
  mark('Hold real Auth: unauthenticated/nonstaff rejected; staff owner metadata through normal Cookie/middleware');
  const unknown=randomUUID();sql(`insert into natori_notification_jobs(id,notification_key,project_id,purpose,status,snapshot,payload,send_started_at) values('${unknown}','hold-browser/${unknown}','${ids[0]}','quote_accept_artist','unknown','{}','{"fixture":"retained"}',now()-interval '1 hour')`);
  await page.goto(app+`/natori/dashboard/cases?case=${ids[0]}&section=transaction&q=架空&date=2026-11-12`);
  await expect(page.getByRole('region',{name:'支払案内の操作'})).toBeVisible();
  sql(`insert into natori_projects(id,user_id,title,client_name,type,status,amount) select gen_random_uuid(),'${owner}','停止一覧の合成案件'||g,'架空依頼者','illustration','inquiry',12000 from generate_series(1,50) g`);
  expect(control('read-only').result).toBe('saved');expect(status().commandsHeld).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  const stopped='操作を停止しています。確定した記録と未確認の処理を読み取れます。';await expect(page.getByText(stopped,{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'支払案内の操作'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'結果不明の照合'})).toHaveCount(0);
  mark('Hold stale interactive tab observes persisted stop on focus and removes action/confirmation panels without retrying');
  const before=sql(`select md5(to_jsonb(p)::text) from natori_projects p where id='${ids[0]}'`),sent=providers();
  for(const [path,data] of [
   ['/api/natori/admin/case-payment',{action:'prepare',projectId:ids[0],deadline:new Date(Date.now()+86400000).toISOString()}],
   ['/api/natori/admin/projects',{id:ids[0],projectId:ids[0],status:'awaiting_payment'}],
  ]){
   const r=await context.request.fetch(app+path,{method:path.endsWith('/projects')?'PATCH':'POST',headers:{'x-requested-with':'me-ish'},data});expect(r.status()).toBe(503);expect(await r.json()).toMatchObject({error:'natori_system_held',resultUnchanged:true});
  }
  expect(sql(`select md5(to_jsonb(p)::text) from natori_projects p where id='${ids[0]}'`)).toBe(before);expect(providers()).toBe(sent);
  expect(sql(`select status||'/'||(payload->>'fixture') from natori_notification_jobs where id='${unknown}'`)).toBe('unknown/retained');
  mark('Hold new workspace POST and legacy project PATCH reject before handler; unknown/payload/provider count unchanged');
  const collection=await context.request.get(app+'/api/natori/admin/case-workspace');expect(collection.status()).toBe(200);const records=(await collection.json()).records;
  expect(records.length).toBe(Number(sql(`select count(*) from natori_projects where user_id='${owner}'`)));expect(records.length).toBeGreaterThan(50);expect(new Set(records.map(r=>r.id)).size).toBe(records.length);
  mark('Hold persisted rollback with entry flag absent retains complete owned collection beyond 50, without duplicate/foreign rows');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1050});
   for(const route of ['/natori/dashboard','/natori/projects','/natori/inquiries','/natori/estimate']){
    await page.goto(app+route+`?case=${ids[0]}&section=transaction&q=架空&date=2026-11-12`);await expect(page.getByText(stopped,{exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'支払案内の操作'})).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('case')).toBe(ids[0]);
   }
   await page.reload();await expect(page.getByText(stopped,{exact:true})).toBeVisible();await page.screenshot({path:`${out}/system-hold-${width}.png`,fullPage:true});
   mark(`Hold ${width}px: all original roots use common read-only facts with entry flag absent; target/query survive reload`);
  }
  expect(JSON.parse(sql(`select natori_case_system_status_v1('${other}')`)).armed).toBe(false);
  expect(control('resume-senders').result).toBe('commands_held');
  const reviewUrl=app+'/api/natori/admin/case-system?review=1';
  const reviewed=await context.request.get(reviewUrl);expect(reviewed.status()).toBe(200);const staleReview=await reviewed.json();
  const generation=status().generation;
  const noCsrf=await context.request.post(app+'/api/natori/admin/case-system',{data:{action:'hold',generation,revision:null,acknowledgePrior:false}});expect(noCsrf.status()).toBe(403);expect(status().generation).toBe(generation);
  const forged=await context.request.post(app+'/api/natori/admin/case-system',{headers:{'x-requested-with':'me-ish'},data:{action:'hold',generation,revision:null,acknowledgePrior:false,owner:other}});expect(forged.status()).toBe(400);expect(status().generation).toBe(generation);
  sql(`update natori_projects set title=title||' revision' where id='${ids[10]}'`);
  const stale=await context.request.post(app+'/api/natori/admin/case-system',{headers:{'x-requested-with':'me-ish'},data:{action:'resume-commands',generation,revision:staleReview.revision,acknowledgePrior:true}});expect(stale.status()).toBe(409);expect((await stale.json()).result).toBe('review_stale');expect(status().commandsHeld).toBe(true);
  mark('Hold control API: real Cookie authorization, CSRF and strict server target; changed local state rejects an old resume review');
  await page.goto(app+`/natori/dashboard?utility=settings&case=${ids[0]}`);
  const controls=page.getByRole('region',{name:'全体の停止と再開'});await expect(controls).toBeVisible();
  await expect(controls.getByText(/操作受付：停止中/)).toBeVisible();
  await expect(controls.getByRole('button',{name:'操作受付だけ再開'})).toBeDisabled();
  await expect(controls.getByRole('button',{name:'送信受付を再開'})).toBeDisabled();
  page.on('dialog',dialog=>dialog.accept());
  await controls.getByRole('checkbox').check();await controls.getByRole('button',{name:'操作受付だけ再開'}).click();
  await expect(controls.getByText(/停止状態を保存しました/)).toBeVisible();expect(status().commandsHeld).toBe(false);expect(status().sendersHeld).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByText(stopped,{exact:true})).toBeVisible();expect(providers()).toBe(sent);
  mark('Hold UI: explicit fresh-reviewed command resume stays separate; sender closed and stale workspace remains latched');
  await controls.getByRole('button',{name:'最新の停止状態を取得'}).click();await expect(controls.getByText(/操作受付：受付中/)).toBeVisible();
  await controls.getByRole('checkbox').check();await controls.getByRole('button',{name:'送信受付を再開'}).click();
  await expect(controls.getByText(/停止状態を保存しました/)).toBeVisible();expect(status().sendersHeld).toBe(false);expect(status().armed).toBe(true);
  await page.goto(app+`/natori/dashboard?case=${ids[0]}&section=transaction`);await expect(page.getByText(stopped,{exact:true})).toBeVisible();expect(providers()).toBe(sent);
  mark('Hold fully resumed record with entry flag absent still uses common read-only, never revives the raw legacy dashboard');
  await page.goto(app+`/natori/dashboard?utility=settings&case=${ids[0]}`);await expect(controls.getByText(/操作受付：受付中/)).toBeVisible();
  let controlRequests=0;
  await page.route('**/api/natori/admin/case-system',async route=>{if(route.request().method()!=='POST')return route.continue();controlRequests++;await route.fetch();return route.abort('failed');});
  await controls.getByRole('button',{name:'操作と送信を停止'}).click();await expect(controls.getByText(/自動では再実行しません/)).toBeVisible();
  expect(status().commandsHeld).toBe(true);expect(controlRequests).toBe(1);await expect(controls.getByRole('checkbox')).toHaveCount(0);
  await controls.getByRole('button',{name:'最新の停止状態を取得'}).click();await expect(controls.getByText(/操作受付：停止中/)).toBeVisible();
  expect(sql(`select status||'/'||(payload->>'fixture') from natori_notification_jobs where id='${unknown}'`)).toBe('unknown/retained');expect(providers()).toBe(sent);
  await page.screenshot({path:`${out}/system-control-390.png`,fullPage:true});
  mark('Hold lost control response: committed stop is recovered by read, no automatic retry or evidence deletion, mobile controls usable');
  expect(external).toEqual([]);expect(errors).toEqual([]);
  await context.close();writeFileSync(out+'/hold-browser-results.json',JSON.stringify({success:true,checks,external,blockedAnalytics,errors,providerRequests:providers(),limits:['SQL fact proof separate from browser; no destructive/purge/TRUNCATE execution','no provider/network calls; no real iPhone']},null,2));return {checks:checks.length};
 }finally{await browser.close();}
}
