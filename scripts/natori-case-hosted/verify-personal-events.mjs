import {chromium,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
/** Local only. The hosted read-only runner never imports or executes this writer test. */
export async function checkPersonalEventsBrowser({out,app,api,password,owner,other,users,check,sql,run}){
 if(![app,api].every(v=>new URL(v).hostname==='localhost'))throw Error('local personal-event fixture required');
 const id='a9000000-0000-4000-8000-000000000001',unlisted='a9000000-0000-4000-8000-000000000002',foreign='a9000000-0000-4000-8000-000000000003',content={title:'合成の個人予定',date:'2026-11-12'};
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const checks=[],errors=[],external=[],mark=s=>{checks.push(s);check(s);};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if([app,api].includes(u.origin))return route.continue();if(u.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',body:''});if(['www.googletagmanager.com','va.vercel-scripts.com'].includes(u.hostname))return route.fulfill({status:200,contentType:'application/javascript',body:''});external.push(u.hostname);return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const path=app+'/api/natori/admin/events',index=app+'/api/natori/admin/case-workspace/entries?kind=events';
  const mutate=(method,data,query='')=>context.request.fetch(path+query,{method,data,headers:{'x-requested-with':'me-ish'}});
  expect((await context.request.get(path)).status()).toBe(401);
  await page.goto(app+'/admin-login',{waitUntil:'domcontentloaded',timeout:60000});await expect(page.getByRole('button',{name:'Googleでログイン',exact:true})).toBeVisible({timeout:60000});await page.addScriptTag({url:app+'/__case-local-auth.js'});
  const login=async email=>expect(await page.evaluate(async({email,password})=>(await window.localAuth.auth.signInWithPassword({email,password})).error?.message,{email,password})).toBeUndefined();
  await login(users.outsider.email);expect((await context.request.get(path)).status()).toBe(401);await page.evaluate(()=>window.localAuth.auth.signOut());await login(users.staff.email);
  sql(`insert into natori_events(id,user_id,title,date) values('${unlisted}','${owner}','未登録の予定','2026-11-12'),('${foreign}','${other}','別ownerの予定','2026-11-12')`);
  const projectState=sql(`select md5(string_agg(to_jsonb(p)::text,'|' order by id)) from natori_projects p`);
  expect((await context.request.get(path)).status()).toBe(200);expect((await(await context.request.get(path)).json()).events).toEqual([]);
  expect((await(await context.request.get(index)).json()).items).toEqual([]);
  for(const data of [{...content,title:'未承認'},{...content,owner:other}])expect((await mutate('POST',data)).status()).toBe(404);
  expect((await mutate('PATCH',{id:unlisted,title:'変更禁止'})).status()).toBe(404);expect((await mutate('DELETE',undefined,'?id='+foreign)).status()).toBe(404);
  mark('Events: real Cookie auth and strict run fixture isolate both read entries, unknown IDs and other owner; no all-owner exposure');
  const created=await mutate('POST',content);expect(created.status()).toBe(200);expect((await created.json()).event.id).toBe(id);
  const replay=await mutate('POST',content);expect(replay.status()).toBe(200);expect((await replay.json()).event.id).toBe(id);expect(sql(`select count(*) from natori_events where id='${id}'`)).toBe('1');
  expect((await mutate('PATCH',{id,date:'2027-01-01'})).status()).toBe(404);
  await page.goto(app+'/natori/dashboard?entry=schedule&date=2026-11-12',{waitUntil:'domcontentloaded',timeout:60000});const region=page.getByRole('region',{name:'個人予定',exact:true});await expect(region.getByText(content.title,{exact:true})).toBeVisible({timeout:60000});
  await expect(page.getByRole('region',{name:'新しい案件の登録',exact:true})).toHaveCount(0);await page.screenshot({path:out+'/personal-events-1440.png',fullPage:true});
  mark('Events: one frozen create ID, repeated request reads exact saved result; normal UI renders only that event and does not enable case registration');
  expect((await mutate('PATCH',{id,date:'2026-12-01',title:'合成の個人予定・移動'})).status()).toBe(200);
  await page.setViewportSize({width:390,height:844});await page.goto(app+'/natori/dashboard?entry=schedule&date=2026-12-01',{waitUntil:'domcontentloaded',timeout:60000});await expect(region.getByText('合成の個人予定・移動',{exact:true})).toBeVisible({timeout:60000});await page.reload({waitUntil:'domcontentloaded',timeout:60000});await expect(region.getByText('合成の個人予定・移動',{exact:true})).toBeVisible({timeout:60000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:out+'/personal-events-390.png',fullPage:true});
  const removed=await mutate('DELETE',undefined,'?id='+id);expect(removed.status()).toBe(200);expect((await(await context.request.get(index)).json()).items).toEqual([]);expect(sql(`select count(*) from natori_events where id in ('${unlisted}','${foreign}')`)).toBe('2');
  mark('Events: date changes cross a month, mobile reload is scoped, and DELETE removes only the single synthetic fixture');
  sql(`update natori_case_acceptance_runs set enabled=false where id='${run}'`);expect((await context.request.get(index)).status()).toBe(200);expect((await mutate('POST',content)).status()).toBe(404);
  sql(`update natori_case_acceptance_runs set enabled=true where id='${run}'`);
  sql(`select natori_case_system_control_v1('${owner}','hold',0,'{"kind":"auth-user","userId":"${users.staff.id}"}'::jsonb)`);
  expect((await mutate('PATCH',{id,title:'停止中'})).status()).toBe(503);
  expect(sql(`select md5(string_agg(to_jsonb(p)::text,'|' order by id)) from natori_projects p`)).toBe(projectState);expect(sql(`select count(*) from natori_case_mail_spends`)).toBe('0');
  const provider=()=>{try{return readFileSync(out+'/provider.jsonl','utf8').trim();}catch{return '';}};expect(provider()).toBe('');expect(external).toEqual([]);expect(errors).toEqual([]);
  await context.close();mark('Events: stopped run keeps reads, rejects new CRUD and never changes project/payment state or invokes a provider');
  writeFileSync(out+'/personal-events-results.json',JSON.stringify({success:true,checks,errors,external,providerRequests:0,syntheticEventDeletes:1,limits:['normal 53-migration schema/real local Auth/PostgREST/middleware; local gateway, no real provider/Storage/Google OAuth/iPhone','no purge, receipt retirement, payload erasure or TRUNCATE']},null,2));return{checks:checks.length};
 }finally{await browser.close();}
}
