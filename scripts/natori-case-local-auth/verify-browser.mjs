import {chromium,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

export async function checkBrowser({out,app,api,anon,service,password,sharedKey,owner,other,users,ids,titles,check,sql,stopRest,startRest}) {
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[],blocked=[],measurements={};
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(![app,api].includes(url.origin)){blocked.push({host:url.hostname,path:url.pathname,type:route.request().resourceType()});return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const apiRead=()=>context.request.get(app+'/api/natori/admin/case-workspace');
  const bootstrap=async()=>{if(!await page.evaluate(()=>Boolean(window.localAuth)))await page.addScriptTag({url:app+'/__case-local-auth.js'});};
  const signIn=async email=>{await bootstrap();const result=await page.evaluate(async({email,password})=>{const {data,error}=await window.localAuth.auth.signInWithPassword({email,password});return {id:data.user?.id,error:error?.message};},{email,password});expect(result.error).toBeUndefined();return result.id;};
  const authCookie=c=>c.name.startsWith('sb-')&&c.name.includes('auth-token');
  const raw=async(path,token=service)=>fetch(api+'/rest/v1/'+path,{headers:{apikey:anon,Authorization:'Bearer '+token}});
  expect((await apiRead()).status()).toBe(401);
  await page.goto(app+'/natori/dashboard/cases');await expect(page).toHaveURL(/admin-login/);
  await expect(page.getByRole('button',{name:'Googleでログイン',exact:true})).toBeVisible();
  check('Normal app: unauthenticated API denied and localized dashboard redirected through unchanged middleware/layout to actual login page');

  expect(await signIn(users.outsider.email)).toBe(users.outsider.id);
  expect((await context.cookies()).some(authCookie)).toBe(true);
  expect((await apiRead()).status()).toBe(401);
  await page.evaluate(()=>window.localAuth.auth.signOut());
  check('Real Auth: password sign-in issues SDK cookies; authenticated non-staff rejected by unchanged authorization');

  expect(await signIn(users.staff.email)).toBe(users.staff.id);expect(users.staff.id).not.toBe(owner);
  const beforeCookies=(await context.cookies()).filter(authCookie);
  const response=await apiRead();expect(response.status()).toBe(200);
  const afterCookies=(await context.cookies()).filter(authCookie);
  const setCookie=(await response.headersArray()).some(h=>h.name.toLowerCase()==='set-cookie'&&/sb-[^=;]*auth-token/.test(h.value));
  measurements.routeRefresh={setCookie,cookieChanged:JSON.stringify(beforeCookies.map(c=>c.value))!==JSON.stringify(afterCookies.map(c=>c.value))};
  expect(setCookie).toBe(true);expect(measurements.routeRefresh.cookieChanged).toBe(true);
  const body=await response.json();expect(body.records).toHaveLength(8);expect(JSON.stringify(body)).not.toMatch(/他owner|表示禁止|user_id|payment_link_url|stripe_session/);
  expect(response.headers()['cache-control']).toContain('no-store');
  const injected=await context.request.get(app+'/api/natori/admin/case-workspace?owner='+other),injectedBody=await injected.json();expect(injectedBody.contract).toBe(body.contract);expect(injectedBody.records.map(r=>r.id)).toEqual(body.records.map(r=>r.id));
  check('Real Auth refresh: route refreshes short-lived signed session, emits updated Set-Cookie, and uses configured owner rather than operator/query owner');

  await bootstrap();const session=await page.evaluate(async()=>{const {data,error}=await window.localAuth.auth.getSession();if(error)throw error;return data.session;});
  expect(session.user.id).toBe(users.staff.id);
  const badToken=session.access_token.slice(0,-8)+'invalid0';
  const invalid=await fetch(api+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+badToken}});expect([401,403]).toContain(invalid.status);
  const validUser=await fetch(api+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+session.access_token}});expect(validUser.status).toBe(200);
  for(const token of [anon,session.access_token]){
   for(const rpc of [`natori_case_workspace_v1?p_owner_id=${owner}`,`natori_case_snapshot_v1?p_project_id=${ids[0]}&p_owner_id=${owner}`]){
    const r=await raw('rpc/'+rpc,token);expect([401,403]).toContain(r.status);expect((await r.json()).code).toBe('42501');
   }
  }
  const own=await raw('rpc/natori_case_workspace_v1?p_owner_id='+owner);expect(own.status).toBe(200);const owned=await own.json();expect(owned.rows).toHaveLength(8);expect(owned.rows.every(r=>r.project.user_id===owner)).toBe(true);
  expect(new Set(owned.rows.map(r=>r.snapshot_id)).size).toBe(1);
  const foreign=await raw('rpc/natori_case_snapshot_v1?p_project_id='+ids[0]+'&p_owner_id='+other);expect(await foreign.json()).toEqual([]);
  expect(sql("SELECT bool_and(NOT prosecdef AND provolatile='s' AND proconfig=ARRAY['search_path=\"\"']::text[]) FROM pg_proc WHERE proname IN ('natori_case_snapshot_v1','natori_case_workspace_v1')")).toBe('t');
  check('Real JWT/PostgREST: valid user accepted, bad signature rejected; anon/authenticated denied both RPCs with SQL 42501; service_role reads remain owner-scoped/coherent');

  await page.goto(app+`/natori/dashboard/cases?entry=cases&case=${ids[0]}&section=transaction`);
  await expect(page.getByRole('heading',{name:titles[0],exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'案件の領域',exact:true}).getByRole('link',{name:'履歴',exact:true}).click();
  await page.goBack();await expect(page).toHaveURL(/section=transaction/);await page.goForward();await expect(page).toHaveURL(/section=history/);
  await page.reload();await expect(page.getByRole('heading',{name:titles[0],exact:true})).toBeVisible();
  await page.screenshot({path:out+'/pc-real-auth.png',fullPage:true});
  await page.goto(app+`/en/natori/dashboard/cases?case=${ids[0]}`);await expect(page.getByRole('heading',{name:titles[0],exact:true})).toBeVisible();expect(await page.getAttribute('html','lang')).toBe('en');
  check('Normal middleware/UI: real localized /en routing, SSR case display, back/forward and reload retain the same case state');

  for(const entry of ['今日','予定','案件']){
   await page.getByRole('navigation',{name:'主な入口',exact:true}).getByRole('link',{name:entry,exact:true}).click();
   if(entry==='予定')await page.getByLabel('予定日').fill('2026-11-12');
   await page.getByRole('link',{name:new RegExp(titles[0])}).click();
   await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('見積承諾済み');
   await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('担当者：支払案内の状況を確認');
  }
  check('Today/Cases/Schedule: real authenticated navigation converges on the same case status, waiting party and next read-only destination');

  for(const id of ['99999999-9999-4999-8999-999999999999','ffffffff-ffff-4fff-8fff-ffffffffffff']){
   await page.goto(app+'/natori/dashboard/cases?case='+id);await expect(page.getByRole('heading',{name:'この表示で案件を確認できません'})).toBeVisible();await expect(page.getByText('他ownerの架空案件',{exact:true})).toHaveCount(0);
  }
  await page.goto(app+`/natori/dashboard/cases?case=${ids[2]}&section=production`);
  await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('入金の記録あり');
  await page.locator('summary').filter({hasText:'分かっていること'}).click();await expect(page.getByText('相談の最新発言：一部の記録を確認できません',{exact:true})).toBeVisible();
  await page.goto(app+`/natori/dashboard/cases?case=${ids[3]}&section=production`);
  await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('受取の記録あり');await expect(page.getByText(/受取の記録：.*納品データとの対応は未確認/)).toBeVisible();
  await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('登録納期 未登録');
  await page.setViewportSize({width:390,height:844});await page.getByRole('combobox',{name:/案件の領域/}).selectOption('history');
  await page.screenshot({path:out+'/mobile-real-auth.png',fullPage:true});
  for(const width of [375,390,768,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
  check('Real DB-to-UI: foreign/missing cases indistinguishable; bounded partial source/known payment/legacy receipt/null due date remain distinct; mobile layout works');

  const alert=page.locator('[data-natori-admin] [role="alert"]');
  stopRest();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(alert).toContainText('前回確認した記録');await expect(page.getByRole('heading',{name:titles[3],exact:true})).toBeVisible();
  await startRest();await page.getByRole('button',{name:'表示を再取得'}).click();await expect(alert).toHaveCount(0);
  check('Actual PostgREST outage/restart: transient failure retains last facts and recovery reads real API again');

  await bootstrap();const logoutSession=await page.evaluate(async()=>{const {data}=await window.localAuth.auth.getSession();return data.session;});
  const oldCookies=(await context.cookies()).filter(authCookie);
  await page.evaluate(()=>window.localAuth.auth.signOut());expect((await context.cookies()).some(authCookie)).toBe(false);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(alert).toContainText('案件の表示を消去');await expect(page.getByRole('heading',{name:titles[3],exact:true})).toHaveCount(0);expect((await apiRead()).status()).toBe(401);
  const revoked=await fetch(api+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:logoutSession.refresh_token})});expect(revoked.status).toBe(400);
  measurements.revokedRefreshStatus=revoked.status;check('Real logout: SDK cookie removal clears displayed facts; GoTrue rejects the revoked refresh token');

  // Wait for expiry of a genuinely GoTrue-signed token, never mint a test user JWT.
  const delay=Math.max(0,logoutSession.expires_at*1000-Date.now()+2000);assert(delay<=35000);if(delay)await new Promise(done=>setTimeout(done,delay));
  let expiredUser,expiredRest;
  for(let n=0;n<13;n++){
   expiredUser=await fetch(api+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+logoutSession.access_token}});
   expiredRest=await raw('rpc/natori_case_workspace_v1?p_owner_id='+owner,logoutSession.access_token);
   if([401,403].includes(expiredUser.status)&&expiredRest.status===401)break;
   if(n===12)throw Error('real JWT expiry not rejected within bounded clock-skew window');await new Promise(done=>setTimeout(done,2500));
  }
  measurements.expiry={auth:expiredUser.status,postgrest:expiredRest.status};
  await context.addCookies(oldCookies);expect((await apiRead()).status()).toBe(401);
  check('Real expiry: GoTrue and PostgREST reject expired signed access token; replayed original cookies with revoked refresh cannot authorize the app');

  await context.clearCookies();await page.goto(app+`/natori/dashboard/cases?case=${ids[0]}&natori-key=${sharedKey}`);
  await expect(page).not.toHaveURL(/natori-key/);await expect(page.getByRole('heading',{name:titles[0],exact:true})).toBeVisible();
  const issued=(await context.cookies()).find(c=>c.name==='natori_dashboard_key');expect(issued).toBeTruthy();expect(issued.value).not.toBe(sharedKey);expect(issued.httpOnly).toBe(true);expect(issued.secure).toBe(true);expect(issued.sameSite).toBe('Lax');expect((await apiRead()).status()).toBe(200);
  measurements.sharedCookie={issuedByNormalMiddleware:true,secure:issued.secure,httpOnly:issued.httpOnly,sameSite:issued.sameSite,browserActuallySends:true};
  await context.clearCookies();await context.addCookies([{...issued,value:issued.value+'invalid'}]);expect((await apiRead()).status()).toBe(401);
  check('Normal middleware shared key: query removed, signed Secure/HttpOnly/SameSite cookie actually handed to app/API; tampering denied');

  expect((await context.request.post(app+'/api/natori/admin/case-workspace',{data:{action:'send'}})).status()).toBe(405);
  expect(errors).toEqual([]);
  const result={errors,blockedExternalAssets:blocked,measurements,authBootstrap:'real password sign-in through actual browser SDK; Google OAuth/PKCE not exercised',middleware:'unchanged normal full app middleware and intl routing'};
  writeFileSync(out+'/browser-results.json',JSON.stringify(result,null,2));return result;
 }catch(error){writeFileSync(out+'/browser-results.json',JSON.stringify({failed:true,errors,blockedExternalAssets:blocked,measurements},null,2));throw error;}
 finally{await browser.close();}
}
