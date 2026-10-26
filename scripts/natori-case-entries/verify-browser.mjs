import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:15000});
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {checkEntryPages} from './verify-pages.mjs';

export async function checkEntryBrowser({out,app,api,password,users,owner,other,ids,sql,check,readOnly=false}) {
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const checks=[],errors=[],writes=[],external=[],mark=label=>{checks.push(label);check(label);};
 const providerCount=()=>{try{return readFileSync(out+'/provider.jsonl','utf8').trim().split('\n').filter(Boolean).length;}catch{return 0;}};
 let eventsAllowed=false;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
  await context.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url());
   if(![app,api].includes(u.origin)){if(u.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',body:''});external.push(u.hostname);return route.abort();}
   if(u.origin===app&&u.pathname.startsWith('/api/')&&req.method()!=='GET'&&!(eventsAllowed&&u.pathname==='/api/natori/admin/events')){writes.push(u.pathname);return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  expect((await context.request.get(app+'/api/natori/admin/case-workspace')).status()).toBe(401);
  expect((await context.request.get(app+'/api/natori/admin/case-workspace/entries?kind=events')).status()).toBe(401);
  await page.goto(app+'/natori/dashboard');await expect(page.getByRole('button',{name:'Googleでログイン',exact:true})).toBeVisible();
  await page.waitForLoadState('domcontentloaded');await page.addScriptTag({url:app+'/__case-local-auth.js'});
  const login=async email=>{const result=await page.evaluate(async({email,password})=>(await window.localAuth.auth.signInWithPassword({email,password})).error?.message,{email,password});expect(result).toBeUndefined();};
  await login(users.outsider.email);expect((await context.request.get(app+'/api/natori/admin/case-workspace')).status()).toBe(401);await page.evaluate(()=>window.localAuth.auth.signOut());
  await login(users.staff.email);mark('R4 real local Auth: unauthenticated/nonstaff denied; synthetic staff uses normal Cookie and authorization');
  await page.goto(app+'/natori/dashboard');await expect(page.getByText('導線の検証プレビューです。',{exact:false})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'主な入口',exact:true}).getByRole('link',{name:'通知',exact:true})).toBeVisible();
  mark('R4 explicit server flag opens common four-entry preview at original dashboard root');
  await page.goto(app+`/natori/projects?project=${ids[0]}&q=架空&filter=staff&date=2026-11-12&month=2026-11`);
  const guidance=page.getByRole('region',{name:'案件の共通案内'});
  await expect(guidance).toContainText('見積承諾済み');mark('R4 original projects bookmark resolves the same project without weakening access or accepting a return URL');
  if(readOnly){
   await expect(page.getByText('操作を停止しています。確定した記録と未確認の処理を読み取れます。',{exact:true})).toBeVisible();
   await page.goto(app+`/natori/dashboard/cases?case=${ids[0]}&section=transaction`);
   await expect(page.getByText('照会のみの画面です。送信・発行・外部照合・解決の保存は停止しています。',{exact:true})).toBeVisible();
   await expect(page.getByRole('region',{name:'支払案内の操作'})).toHaveCount(0);await expect(page.getByRole('region',{name:'結果不明の照合'})).toHaveCount(0);
   await expect(page.getByRole('region',{name:'既存操作の統合'})).toHaveCount(0);await expect(page.getByRole('region',{name:'新しい案件の登録'})).toHaveCount(0);
   expect((await context.request.get(app+'/api/natori/admin/case-administration?projectId='+ids[0])).status()).toBe(200);
   expect((await context.request.post(app+'/api/natori/admin/case-administration',{headers:{'x-requested-with':'me-ish'},data:{}})).status()).toBe(404);
   mark('R4 pause view: common facts remain visible through root/projects/direct case, with every command panel omitted');
  }
  for(const status of ['quoted','awaiting_payment']){
   sql(`update natori_projects set status='${status}' where id='${ids[0]}'`);
   for(const entry of ['today','cases','schedule','notifications']){
    await page.goto(app+`/natori/dashboard?entry=${entry}&case=${ids[0]}&date=2026-11-12&month=2026-11`);
    await expect(guidance).toContainText('見積承諾済み');await expect(guidance).toContainText('担当者：支払案内の状況を確認');
    await expect(guidance).not.toContainText('依頼者：支払状況の確認待ち');
    expect(sql(`select count(*) from natori_notification_jobs where project_id='${ids[0]}'`)).toBe('0');
    mark(`R4 ${entry}/${status}: accepted quote without a payment notice remains staff work, never client payment waiting`);
   }
  }
  const job=randomUUID();sql(`insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,status)
   select '${job}','r4-synthetic/${job}',project_id,id,'quote_accept_artist',jsonb_build_object('amount',amount,'acceptedAt',accepted_at),'unknown' from natori_quotes where project_id='${ids[0]}'`);
  const tables=sql("select tablename from pg_tables where schemaname='public' and tablename like 'natori_%' order by tablename").split('\n');
  const checksum=()=>createHash('sha256').update(sql(tables.map(t=>`select '${t}'||coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]') from public.${t} r`).join(';'))).digest('hex');
  const before=checksum(),beforeProvider=providerCount();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1050});
   await page.goto(app+'/natori/dashboard?entry=notifications&q=支払案件1&filter=staff&month=2026-11');
   const notice=page.locator(`#index-notice-${job}`);await expect(notice).toBeVisible();await notice.click();
   await expect(page.getByRole('complementary',{name:'選択した通知'})).toContainText(job);
   await expect(page.getByRole('complementary',{name:'選択した通知'})).toContainText('過去の版・条件');
   await expect(page).toHaveURL(new RegExp('notice='+job));await page.reload();
   await expect(page.getByRole('complementary',{name:'選択した通知'})).toContainText(job);
   await page.getByRole('link',{name:'← 通知へ戻る',exact:true}).click();
   await expect(page.getByRole('searchbox')).toHaveValue('支払案件1');await expect(page.getByLabel('対応で絞り込む')).toHaveValue('staff');
   await expect(notice).toBeFocused();await notice.click();await page.goBack();await expect(notice).toBeVisible();await page.goForward();
   await expect(page.getByRole('complementary',{name:'選択した通知'})).toContainText(job);
   mark(`R4 ${width}px exact notification/terms and filter/selection survive reload, back and forward without resend`);
   const nav=page.getByRole('navigation',{name:width<1024?'スマホの主な入口':'主な入口',exact:true});
   await nav.getByRole('link',{name:'予定',exact:true}).click();await page.getByLabel('表示月').fill('2026-11');
   await page.getByRole('button',{name:/2026-11-12 登録納期/}).click();await page.getByRole('searchbox').fill('支払案件1');
   await page.getByLabel('対応で絞り込む').selectOption('staff');
   await page.locator(`#case-${ids[0]}`).click();await expect(guidance).toContainText('見積承諾済み');
   await nav.getByRole('link',{name:'予定',exact:true}).click();
   await expect(page.getByLabel('表示月')).toHaveValue('2026-11');await expect(page.getByLabel('予定日')).toHaveValue('2026-11-12');
   await expect(page.getByRole('searchbox')).toHaveValue('支払案件1');await expect(page.locator(`#case-${ids[0]}`)).toBeFocused();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:out+`/r4-${width}.png`,fullPage:true});mark(`R4 ${width}px calendar month/day/search/filter and same-entry selection return consistently`);
  }
  for(const foreign of [ids[10],'ffffffff-ffff-4fff-8fff-ffffffffffff']){
   await page.goto(app+'/natori/dashboard?case='+foreign);await expect(page.getByRole('heading',{name:'この表示で案件を確認できません'})).toBeVisible();
  }
  expect(checksum()).toBe(before);expect(providerCount()).toBe(beforeProvider);expect(writes).toEqual([]);
  mark('R4 navigation is business-read-only: all normal-schema business rows unchanged; no writer/provider calls; foreign/missing case indistinguishable');
  const readBody=await(await context.request.get(app+'/api/natori/admin/case-workspace')).json();expect(readBody.records.every(r=>r.id!==ids[10])).toBe(true);
  expect(sql(`select count(*) from natori_projects where user_id='${other}'`)).not.toBe('0');
  await checkEntryPages({out,page,context,app,owner,other,ids,sql,mark,readOnly,allowEvents:value=>{eventsAllowed=value;},providerCount});
  const eventUrl=app+'/api/natori/admin/case-workspace/entries?kind=events';
  const failEvents=route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic_partial_read_failure"}'});
  await context.route(eventUrl,failEvents);await page.goto(app+'/natori/dashboard?entry=schedule&month=2027-01&date=2027-01-01');
  await expect(page.getByRole('button',{name:'予定・通知を再取得',exact:true})).toBeVisible();
  await expect(page.getByText('この日に個人予定はありません。',{exact:true})).toHaveCount(0);
  await context.unroute(eventUrl,failEvents);await page.getByRole('button',{name:'予定・通知を再取得',exact:true}).click();
  await expect(page.getByRole('region',{name:'個人予定',exact:true})).toContainText('架空個人予定1005');
  mark('R4 injected auxiliary 503 stays unknown instead of empty; explicit retry restores real local API data');
  await page.close();await context.clearCookies();expect((await context.request.get(app+'/api/natori/admin/case-workspace')).status()).toBe(401);
  const knownAnalytics=new Set(['www.googletagmanager.com','va.vercel-scripts.com']);
  const unexpected=external.filter(host=>!knownAnalytics.has(host));
  expect(errors).toEqual([]);expect(unexpected).toEqual([]);mark('R4 session removal hides access; no browser errors; known analytics attempts blocked before network, no unexpected external targets');
  const result={checks:checks.length,readOnly,errors,blockedExternalAttempts:external,unexpected,writes,source:'formal business migrations; real local GoTrue/PostgREST/Next middleware; synthetic data only',unverified:['Google OAuth','physical iPhone','actual Stripe/Resend/Storage','cloud deployment','hosted acceptance personal events','actual hosted analytics exclusion']};
  writeFileSync(out+'/r4-browser.json',JSON.stringify(result,null,2));await context.close();return result;
 }finally{await browser.close();}
}
