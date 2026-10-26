import {chromium, expect as baseExpect} from '@playwright/test';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHmac, randomUUID} from 'node:crypto';
const expect=baseExpect.configure({timeout:30000});

// Uses the existing network-none Auth/DB/API harness and provider/Storage doubles.
// Never follows the generated test payment URL or sends any email.
export async function checkNoMailBrowser({out,app,api,password,owner,users,check,sql,ids,run,secret}) {
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const boundaries=()=>{try{return readFileSync(out+'/provider.jsonl','utf8').split('\n').filter(Boolean).map(JSON.parse);}catch{return[];}};
 const errors=[],unexpected=[],checks=[],mark=s=>{checks.push(s);check(s);};
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if([app,api].includes(u.origin))return route.continue();
   if(u.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',body:''});
   if(['www.googletagmanager.com','va.vercel-scripts.com'].includes(u.hostname))return route.fulfill({status:200,contentType:'application/javascript',body:''});
   unexpected.push(u.hostname);return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const payment='/api/natori/admin/case-payment',system='/api/natori/admin/case-system';
  const post=(path,data)=>context.request.post(app+path,{headers:{'x-requested-with':'me-ish'},data});
  expect((await context.request.get(app+payment+'?projectId='+ids[0])).status()).toBe(401);
  await page.goto(app+'/__case-local-bootstrap.html');await page.waitForFunction(()=>Boolean(window.localAuth));
  expect(await page.evaluate(async({email,password})=>(await window.localAuth.auth.signInWithPassword({email,password})).error?.message,{email:users.staff.email,password})).toBeUndefined();
  expect(await page.evaluate(async()=>Boolean((await window.localAuth.auth.refreshSession()).data.session))).toBe(true);
  await expect.poll(async()=>(await context.request.get(app+payment+'?projectId='+ids[0])).status()).toBe(200);
  for(const i of [10,15])expect((await context.request.get(app+payment+'?projectId='+ids[i])).status()).toBe(404);
  mark('No mail: real local Auth/refresh/Cookie/middleware; foreign and unregistered fixtures denied');
  const prepare=async id=>{const r=await post(payment,{action:'prepare',projectId:id,deadline:new Date(Date.now()+3*86400000).toISOString()});expect(r.status()).toBe(200);const d=await r.json();expect(d.result).toBe('prepared');return d.preview;};
  const p=await prepare(ids[0]);expect(p.amount).toBe(12000);expect(p.quoteVersion).toBe(2);
  const confirm=()=>post(payment,{action:'confirm',projectId:p.projectId,operationId:p.operationId,token:p.token});
  await confirm();await confirm();
  expect(boundaries().filter(x=>x.boundary==='price')).toHaveLength(1);
  expect(boundaries().filter(x=>x.boundary==='link')).toHaveLength(1);
  const noMail=()=>{
   expect(boundaries().filter(x=>x.boundary==='mail')).toHaveLength(0);
   expect(sql(`select used||'/'||human_used||'/'||human_limit||'/'||cardinality(allowed_to)||'/'||cardinality(human_to)||'/'||mail_limit from natori_case_acceptance_runs where id='${run}'`)).toBe('0/0/0/0/0/12');
   expect(sql('select count(*) from natori_case_mail_spends')).toBe('0');
   expect(sql('select count(*) from natori_notification_jobs where send_started_at is not null or sent_at is not null or provider_id is not null')).toBe('0');
  };
  noMail();expect(sql(`select count(*) from natori_notification_jobs where project_id='${ids[0]}' and status='pending'`)).toBe('1');
  mark('No mail: preparation/confirmation/repeated token create one synthetic test link and one pending job; no mail claim, acceptance or spend');
  // SQL defense in depth: the retained numeric mail_limit cannot override an empty allowlist.
  const denied=JSON.parse(sql(`set role service_role;select natori_case_acceptance_mail_v1('${run}','${owner}','${ids[0]}',gen_random_uuid(),gen_random_uuid(),repeat('a',64),'client1@example.invalid','Local <mail@example.invalid>','reply@example.invalid','${app}','{}');reset role;`));
  expect(denied.allowed).toBe(false);noMail();
  mark('No mail SQL: service-role reservation rejects a recipient with mail_limit 12 and makes no binding/spend');
  await page.goto(app+`/natori/dashboard/cases?case=${ids[0]}&section=transaction&entry=today`);
  await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText(/案内.*未送信|案内送信.*未確認|支払案内の状況/);
  await expect(page.getByRole('region',{name:'案件の共通案内'})).not.toContainText('依頼者の支払い待ち');
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1050});await page.reload();
   await expect(page.getByRole('region',{name:'案件の共通案内'})).toBeVisible();
   expect(new URL(page.url()).searchParams.get('case')).toBe(ids[0]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`${out}/no-mail-${width}.png`,fullPage:true});
  }
  noMail();mark('No mail PC/mobile: link alone is not client payment waiting; reload preserves the case and pending mail fact');
  // Real local upload API/metadata/operation with Storage bytes replaced only at its transport.
  await page.goto(app+`/natori/dashboard/cases?case=${ids[1]}&section=consultation`);
  await page.getByLabel('メッセージ',{exact:true}).fill('メールなし受入の架空添付');
  await page.getByLabel('相談ファイルを選ぶ').setInputFiles({name:'no-mail-synthetic.png',mimeType:'image/png',buffer:readFileSync(new URL('../../docs/artifacts/natori-case-no-cost-preparation-20261025/synthetic-1x1.png',import.meta.url))});
  await page.getByRole('button',{name:'相談の送信前確認へ',exact:true}).click();
  await page.getByRole('button',{name:'確認した相談を送信',exact:true}).click();
  await expect.poll(()=>sql(`select count(*) from natori_consultation_messages where project_id='${ids[1]}' and body='メールなし受入の架空添付'`)).toBe('1');
  expect(Number(sql(`select count(*) from natori_consultation_files where project_id='${ids[1]}'`))).toBeGreaterThan(0);noMail();
  mark('No mail Storage: real local upload/verification and consultation save succeed using synthetic bytes; notification remains unsent');
  const review=async()=>{const r=await context.request.get(app+system+'?review=1');expect(r.status()).toBe(200);return r.json();};
  const control=async action=>{const v=await review();const r=await post(system,{action,generation:v.generation,revision:action.startsWith('resume-')?v.revision:null,acknowledgePrior:action.startsWith('resume-')});expect(r.status()).toBe(200);expect((await r.json()).result).toBe('saved');};
  await control('hold');const before=boundaries().length;
  expect((await post(payment,{action:'prepare',projectId:ids[2],deadline:new Date(Date.now()+3*86400000).toISOString()})).status()).toBe(503);
  expect((await context.request.get(app+payment+'?projectId='+ids[0])).status()).toBe(200);
  expect(boundaries()).toHaveLength(before);noMail();
  mark('No mail hold: new link commands stop before transport while existing results stay readable and pending jobs stay pending');
  // Late signed payment facts must remain recordable while commands are stopped.
  const event={id:'evt_no_mail_'+randomUUID().replaceAll('-',''),object:'event',type:'checkout.session.completed',livemode:false,created:Math.floor(Date.now()/1000),data:{object:{id:'cs_no_mail_'+randomUUID().replaceAll('-',''),object:'checkout.session',livemode:false,payment_status:'paid',status:'complete',currency:'jpy',amount_total:12000,payment_intent:'pi_no_mail_synthetic',metadata:{kind:'natori_commission',projectId:ids[0],quoteId:sql(`select active_quote_id from natori_projects where id='${ids[0]}'`)}}}};
  const webhook=async(e,bad=false)=>{const raw=JSON.stringify(e),stamp=Math.floor(Date.now()/1000),signature=createHmac('sha256',secret).update(`${stamp}.${raw}`).digest('hex');return context.request.post(app+'/api/webhook/stripe',{data:raw,headers:{'content-type':'application/json','stripe-signature':`t=${stamp},v1=${bad?'bad':signature}`}});};
  expect((await webhook(event,true)).status()).toBe(400);
  expect((await webhook({...event,account:'acct_other'})).status()).toBe(400);
  expect((await webhook({...event,livemode:true})).status()).toBe(400);
  expect((await webhook(event)).status()).toBe(200);expect((await webhook(event)).status()).toBe(200);
  expect(sql(`select count(*) from natori_payment_transactions where project_id='${ids[0]}' and status='received'`)).toBe('1');
  expect(sql(`select payment_confirmed_at is not null from natori_projects where id='${ids[0]}'`)).toBe('t');noMail();
  mark('No mail payment: raw signed synthetic sandbox event records paid once during hold; wrong signature/account/live rejected; mail remains zero');
  await control('resume-commands');expect((await review()).sendersHeld).toBe(true);
  await control('resume-senders');expect((await review()).sendersHeld).toBe(false);await prepare(ids[2]);noMail();
  mark('No mail resume: commands/senders require separate fresh-state reviews; resuming Stripe boundaries never opens email');
  sql(`update natori_case_acceptance_runs set enabled=false where id='${run}'`);
  expect((await post(payment,{action:'prepare',projectId:ids[2],deadline:new Date(Date.now()+3*86400000).toISOString()})).status()).toBeGreaterThanOrEqual(400);
  expect((await context.request.get(app+payment+'?projectId='+ids[0])).status()).toBe(200);noMail();
  await page.close();await context.clearCookies();expect((await context.request.get(app+payment+'?projectId='+ids[0])).status()).toBe(401);
  expect(errors).toEqual([]);expect(unexpected).toEqual([]);
  mark('No mail finish: disabled run blocks commands, retained results remain readable, cleared Auth is rejected; no provider email calls');
  const result={checks,errors,unexpected,mailVerification:'not performed; all mail disabled',providerBoundaries:boundaries(),limits:'normal schema/actual local Auth/PostgREST/middleware; Stripe and Storage doubles; no hosted services/Google/iPhone'};
  writeFileSync(out+'/no-mail-browser.json',JSON.stringify(result,null,2));await context.close();return result;
 }finally{await browser.close();}
}
