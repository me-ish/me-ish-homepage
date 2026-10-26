import {chromium,expect as playwrightExpect} from '@playwright/test';
const expect=playwrightExpect.configure({timeout:15000});
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {seed} from '../natori-case-payment/fixture.mjs';
export async function checkReconciliationBrowser({out,app,api,anon,password,owner,other,users,check,sql}){
 const fixture=seed(owner,other);sql(fixture.sql.replaceAll('a0000000-','a1000000-').replaceAll('b0000000-','b1000000-'));
 const ids=fixture.ids.map(s=>s.replace('a0000000-','a1000000-')),ops=[];
 for(const id of ids.slice(0,2)){const op=randomUUID();ops.push(op);const begin=JSON.parse(sql(`select natori_payment_links_v1('${owner}','${id}','begin','${JSON.stringify({operationId:op,token:randomUUID(),hash:'a'.repeat(64),action:'issue',livemode:false,providerAccountId:'acct_r1fixture',deadline:new Date(Date.now()+86400000).toISOString()})}');`));expect(begin.result).toBe('claimed');sql(`update natori_payment_link_attempts set lease_until=null,state='needs_review',price_started_at=now()-interval '24 hours' where project_id='${id}';update natori_payment_link_operations set workspace_guard='{"receiptRetention":{"state":"retired"}}',workspace_request=null where project_id='${id}'`);}
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const count=()=>existsSync(out+'/provider.jsonl')?readFileSync(out+'/provider.jsonl','utf8').split('\n').filter(s=>s.includes('"reconciliation"')).length:0;
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1050}});await context.route('**/*',r=>[app,api].includes(new URL(r.request().url()).origin)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const path='/api/natori/admin/case-reconciliation';
 const get=()=>context.request.get(app+path+'?projectId='+ids[0]);const post=data=>context.request.post(app+path,{headers:{'x-requested-with':'me-ish'},data});
 expect((await get()).status()).toBe(401);await page.goto(app+'/natori/dashboard/cases');await expect(page.getByRole('button',{name:'Googleでログイン',exact:true})).toBeVisible();await page.waitForLoadState('domcontentloaded');await page.addScriptTag({url:app+'/__case-local-auth.js'});expect(await page.evaluate(async({email,password})=>(await window.localAuth.auth.signInWithPassword({email,password})).error?.message,{email:users.staff.email,password})).toBeUndefined();
 expect((await context.request.get(app+path+'?projectId='+ids[10])).status()).toBe(404);expect((await context.request.post(app+path,{data:{}})).status()).toBe(403);
 check('R1 auth/scope: real middleware/staff cookie, owner isolation and CSRF deny invalid access');
 await page.waitForLoadState('domcontentloaded');if(!await page.evaluate(()=>Boolean(window.localAuth)))await page.addScriptTag({url:app+'/__case-local-auth.js'});
 const aclSession=await page.evaluate(async()=>{const {data,error}=await window.localAuth.auth.refreshSession();if(error)throw Error('synthetic session refresh failed');return data.session;});
 for(const token of [anon,aclSession.access_token]){
  const denied=await fetch(api+'/rest/v1/rpc/natori_case_reconciliation_v1',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_owner_id:owner,p_project_id:ids[0],p_command:'read'})});expect([401,403]).toContain(denied.status);expect((await denied.json()).code).toBe('42501');
 }
 check('R1 RPC: actual anon/authenticated PostgREST roles cannot execute reconciliation commands');

 const goto=async i=>{await page.goto(app+`/natori/dashboard/cases?case=${ids[i]}&section=transaction`);await expect(page.getByRole('region',{name:'結果不明の照合'})).toBeVisible();};
 await goto(0);const panel=page.getByRole('region',{name:'結果不明の照合'});const initial=count();await panel.getByRole('button',{name:'現在の記録を照会'}).click();await page.reload();await expect(panel).toContainText('処理結果の確認が必要');expect(count()).toBe(initial);
 check('R1 DB-only lookup/reload never automatically contacts a provider or sends');
 await panel.getByRole('button',{name:'価格を外部照合',exact:true}).dblclick();await expect(panel).toContainText('肯定証拠あり');expect(count()).toBe(initial+1);
 await panel.getByRole('button',{name:'照合結果の保存内容を確認'}).click();await expect(panel.getByRole('dialog')).toContainText('他の不明点は残ります');await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'照合結果を保存',exact:true}).click();await expect(panel).toContainText('照合結果を保存済み');
 expect(sql(`select reconciliation_id is null from natori_payment_link_operations where project_id='${ids[0]}'`)).toBe('t');
 check('R1 PC: repeated inspect is single claimed read; price save leaves link uncertainty blocked');
 await panel.getByRole('button',{name:'支払リンクを外部照合',exact:true}).click();await expect(panel.getByRole('button',{name:'照合結果の保存内容を確認'})).toHaveCount(1);await panel.getByRole('button',{name:'照合結果の保存内容を確認'}).click();await expect(panel.getByRole('button',{name:'照合結果を保存',exact:true})).toBeDisabled();await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'照合結果を保存',exact:true}).click();await expect(panel).toContainText('照合解決の記録あり');
 expect(sql(`select status||'/'||(workspace_request is null)::text from natori_payment_link_operations where project_id='${ids[0]}'`)).toBe('pending/true');
 check('R1 explicit link save: canonical recovery + immutable resolution, purged old operation stays pending/stopped');
 const beforeEntries=readFileSync(out+'/provider.jsonl','utf8');
 for(const entry of ['today','cases','schedule']){
  await page.goto(app+`/natori/dashboard/cases?entry=${entry}&case=${ids[0]}&section=transaction&date=2026-11-12`);
  const common=page.getByRole('region',{name:'案件の共通案内'});
  await expect(common).toContainText('担当者：リンク確認済み・案内送信は未確認');
  await expect(common).not.toContainText('依頼者：支払状況の確認待ち');
  await expect(common).not.toContainText('未送信');
 }
 expect(readFileSync(out+'/provider.jsonl','utf8')).toBe(beforeEntries);
 expect(sql(`select count(*) from natori_notification_jobs where project_id='${ids[0]}'`)).toBe('0');
 expect(sql(`select count(*) from natori_payment_link_attempts where project_id='${ids[0]}'`)).toBe('1');
 check('R1 display: recovered link without send evidence is staff review through all three entries, with no implied client wait or outbound side effect');

 await page.setViewportSize({width:390,height:844});await page.reload();await expect(panel).toContainText('照合解決の記録あり');await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('リンク確認済み・案内送信は未確認');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:out+'/r1-mobile.png',fullPage:true});
 await page.goBack();await page.goForward();await expect(panel).toContainText('照合解決の記録あり');check('R1 mobile/back-forward/reload: same facts and no overflowing confirmation controls');
 const mid=randomUUID();sql(`insert into natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,payload,status,send_started_at) values('${mid}','r1-browser-mail','${ids[0]}','payment_link_client','{}','{}','unknown',now()-interval '1 hour')`);await page.reload();await panel.getByRole('button',{name:'メール受付を外部照合',exact:true}).click();await expect(panel).toContainText('scope_missing');await expect(page.getByRole('region',{name:'案件の共通案内'})).not.toContainText('依頼者：支払状況の確認待ち');expect(await panel.getByRole('button',{name:'照合結果の保存内容を確認'}).count()).toBe(0);check('R1 historical mail missing scope remains review-only with no guessed account or resend');
 await goto(1);await panel.getByRole('button',{name:'旧リンク停止を確認'}).click();const beforeStop=count();await expect(panel.getByRole('dialog')).toContainText('既存Session');expect(count()).toBe(beforeStop);await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'確認した旧リンクを停止・照合'}).click();await expect(panel).toContainText('肯定証拠あり');expect(count()).toBe(beforeStop+1);
 check('R1 old-link stop is a separate confirmed double boundary; it does not apply or issue new links');
 await panel.getByRole('button',{name:'照合結果の保存内容を確認'}).click();await panel.getByRole('checkbox').check();let dropped=false;await context.route('**/api/natori/admin/case-reconciliation',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='apply-evidence'&&!dropped){dropped=true;await route.fetch();return route.abort();}return route.continue();});
 await panel.getByRole('button',{name:'照合結果を保存',exact:true}).click();await expect(panel.getByRole('alert')).toBeVisible();await panel.getByRole('button',{name:'現在の記録を照会'}).click();await expect(panel).toContainText('照合結果を保存済み');expect(sql(`select count(*) from natori_case_reconciliation_resolutions where project_id='${ids[1]}'`)).toBe('1');
 check('R1 apply response loss: current record recovers same resolution; no blind stop/issue/send retry');
 await page.reload();await panel.getByRole('button',{name:'停止結果を外部照合'}).click();await expect(panel.getByRole('button',{name:'照合結果の保存内容を確認'})).toHaveCount(1);await panel.getByRole('button',{name:'照合結果の保存内容を確認'}).click();await panel.getByRole('checkbox').check();await context.clearCookies();const expiredCount=count();await panel.getByRole('button',{name:'照合結果を保存',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('ログイン');expect(count()).toBe(expiredCount);await expect(panel.getByRole('dialog')).toHaveCount(0);
 check('R1 expired session at save rejects and clears confirmation; provider work is not repeated');
 expect(errors).toEqual([]);writeFileSync(out+'/r1-browser.json',JSON.stringify({errors,providerCalls:count()},null,2));return {errors,providerCalls:count()};
 }finally{await browser.close();}
}
