import {expect as baseExpect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const expect=baseExpect.configure({timeout:20000});
export async function checkHistoryBrowser({page,context,app,api,owner,other,sql,mark,provider,out,users,password}){
 const id=randomUUID(),foreign=randomUUID(),quote1=randomUUID(),quote2=randomUUID(),paid=randomUUID(),tx=randomUUID(),legacy=randomUUID();
 sql(`insert into natori_projects(id,user_id,title,client_name,type,status,amount,note,created_at) values
 ('${id}','${owner}','履歴を確認する合成案件','架空依頼者','illustration','quoted',12000,'【支払い依頼メール送信 2026-10-01】宛先: never-export@example.invalid\n支払いリンク: https://example.invalid/never-export-capability','2026-10-18'),
 ('${foreign}','${other}','別ownerの履歴','架空依頼者','illustration','inquiry',12000,'','2026-10-18'),
 ('${paid}','${owner}','金銭の合成案件','架空依頼者','illustration','rough',99999,'','2026-10-18'),
 ('${legacy}','${owner}','旧入金の合成案件','架空依頼者','illustration','rough',99999,'','2026-10-18');
 insert into natori_quotes(id,project_id,user_id,version,title,client_name,to_email,amount,subject,body_snapshot,token_hash,expires_at,created_at,issued_at,superseded_at) values
 ('${quote1}','${id}','${owner}',1,'保存版1','架空依頼者','never-export@example.invalid',10000,'非公開subject','never-export-body','${randomUUID()}','2026-11-01','2026-10-18','2026-10-18','2026-10-19'),
 ('${quote2}','${id}','${owner}',2,'保存版2','架空依頼者','never-export@example.invalid',12000,'非公開subject','never-export-body','${randomUUID()}','2026-11-01','2026-10-19','2026-10-19',null);
 update natori_projects set active_quote_id='${quote2}' where id='${id}';
 insert into natori_project_activity(project_id,user_id,event_type,source_type,source_id,occurred_at) select '${id}','${owner}','quote_issued','quote',gen_random_uuid()::text,'2026-10-01'::timestamptz+g*interval '1 second' from generate_series(1,251) g;
 update natori_projects set payment_confirmed_at='2026-10-19',paid_at='2026-10-19',paid_amount=10000,stripe_payment_session_id='cs_test_synthetic_${tx}' where id='${paid}';
 update natori_projects set payment_confirmed_at='2026-10-19',paid_at='2026-10-19',paid_amount=7000 where id='${legacy}';
 insert into natori_payment_transactions(id,project_id,amount,status,received_at,stripe_session_id,stripe_account_scope,stripe_livemode,stripe_payment_intent_id,stripe_currency) values('${tx}','${paid}',10000,'received','2026-10-19','cs_test_synthetic_${tx}','platform',false,'pi_synthetic_${tx}','jpy');
 insert into natori_refund_ledger(owner_id,account_scope,livemode,refund_id,transaction_id,project_id,claimed_project_id,amount,currency,provider_status,confirmed_at,resolution,first_event_id,latest_event_id,provider_event_created) values('${owner}','platform',false,'re_synthetic_${tx}','${tx}','${paid}','${paid}',1000,'jpy','succeeded','2026-10-20','resolved','evt_synthetic','evt_synthetic',1);`);
 const endpoint=(name,project=id,query='')=>`${app}/api/natori/admin/${name}?projectId=${project}${query}`;
 for(const name of ['case-detail','case-history'])for(const project of [foreign,'ffffffff-ffff-4fff-8fff-ffffffffffff'])expect((await context.request.get(endpoint(name,project))).status()).toBe(404);
 const outsider=await context.browser().newContext();const outsiderPage=await outsider.newPage();
 await outsider.route('**/*',route=>[app,api].includes(new URL(route.request().url()).origin)?route.continue():route.abort());
 await outsiderPage.goto(app+'/__case-local-bootstrap.html');
 const outsiderLogin=await outsiderPage.evaluate(async({email,password})=>(await window.localAuth.auth.signInWithPassword({email,password})).error?.message,{email:users.outsider.email,password});expect(outsiderLogin).toBeUndefined();
 for(const name of ['case-detail','case-history'])expect((await outsider.request.get(endpoint(name))).status()).toBe(401);await outsider.close();
 mark('History exact detail/history reject other owner and missing alike; actual nonstaff Auth cannot read either route');
 const first=await(await context.request.get(endpoint('case-history'))).json();expect(first.view.total).toBe(255);expect(first.view.rows.length).toBe(50);
 expect(JSON.stringify(first)).not.toMatch(/never-export|legacyNote|body_snapshot|to_email|token_hash/);
 expect(first.view.rows.filter(r=>r.source==='quote').map(r=>r.quoteVersion)).toEqual([2,1]);
 expect(first.view.legacyLogs).toEqual([{dateISO:'2026-10-01',label:'支払い依頼メール送信'}]);
 const all=new Set();let next=0;do{const response=await context.request.get(endpoint('case-history',id,`&offset=${next}${next?'&revision='+first.view.revision:''}`));expect(response.status()).toBe(200);const v=(await response.json()).view;for(const row of v.rows){expect(all.has(row.id)).toBe(false);all.add(row.id);}next=v.next;}while(next!==null);expect(all.size).toBe(255);
 mark('History 255 records across all bounded pages retain exact counts/unique IDs/quote versions while excluding mail bodies, addresses and capability URLs');
 const before=sql(`select md5(jsonb_agg(to_jsonb(p) order by id)::text) from natori_projects p`),at=provider().length;
 await page.route('**/api/natori/admin/case-workspace',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic collection failure"}'}));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1050});await page.goto(`${app}/natori/dashboard?case=${id}&section=history&q=戻る条件&date=2026-10-31&month=2026-11&source=inquiries`);
  await expect(page.getByRole('heading',{name:'履歴を確認する合成案件',exact:true})).toBeVisible();
  await expect(page.getByText('案件一覧を取得できません。対象の詳細は別に確認します。')).toBeVisible();
  const history=page.getByRole('region',{name:'案件の履歴と金銭参照'});
  await expect(history.getByText(/255件中 1〜50件/)).toBeVisible();
  await history.getByRole('button',{name:'次の履歴',exact:true}).click();await expect(history.getByText(/255件中 51〜100件/)).toBeVisible();expect(new URL(page.url()).searchParams.get('historyPage')).toBe('2');
  await page.reload();await expect(history.getByText(/255件中 51〜100件/)).toBeVisible();
  await page.goBack();await expect(history.getByText(/255件中 1〜50件/)).toBeVisible();await page.goForward();await expect(history.getByText(/255件中 51〜100件/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'履歴を確認する合成案件',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await history.screenshot({path:`${out}/history-${width}.png`});
  mark(`History ${width}px exact detail survives unrelated collection 503; bounded page/ID/query/date/month survive reload/back/forward`);
 }
 expect(sql(`select md5(jsonb_agg(to_jsonb(p) order by id)::text) from natori_projects p`)).toBe(before);expect(provider().length).toBe(at);
 sql(`insert into natori_project_activity(project_id,user_id,event_type,source_type,source_id) values('${id}','${owner}','quote_issued','quote','changed')`);
 expect((await context.request.get(endpoint('case-history',id,'&offset=50&revision='+first.view.revision))).status()).toBe(409);
 await page.getByRole('button',{name:'次の履歴',exact:true}).click();await expect(page.getByRole('region',{name:'案件の履歴と金銭参照'}).getByRole('alert')).toContainText('履歴が更新されました');
 await page.getByRole('button',{name:'履歴を先頭から再取得'}).click();await expect(page.getByText(/256件中 1〜50件/)).toBeVisible();
 mark('History changing catalogue invalidates the old cursor with 409 and explicit first-page restart, without replacing the selected case');
 const finance=(await(await context.request.get(endpoint('case-history',paid))).json()).view.financial;
 expect(finance).toMatchObject({gross:10000,refunded:1000,net:9000,state:'verified'});
 await page.goto(`${app}/natori/dashboard?case=${paid}&section=transaction`);await expect(page.getByRole('region',{name:'案件の履歴と金銭参照'}).getByText('9,000円',{exact:true})).toBeVisible();
 const unmatched=randomUUID();sql(`insert into natori_refund_ledger(id,owner_id,account_scope,livemode,refund_id,project_id,amount,currency,provider_status,resolution,first_event_id,latest_event_id,provider_event_created) values('${unmatched}','${owner}','platform',false,'re_synthetic_unmatched','${paid}',500,'jpy','succeeded','unmatched','evt_synthetic2','evt_synthetic2',1)`);
 const uncertain=(await(await context.request.get(endpoint('case-history',paid))).json()).view.financial;
 expect(uncertain).toMatchObject({gross:10000,refunded:null,net:null,state:'unverified'});
 await page.getByRole('button',{name:'金銭と履歴を再取得'}).click();await expect(page.getByRole('region',{name:'案件の履歴と金銭参照'}).getByText(/返金総額と純入金は確定していません/)).toBeVisible();
 const old=(await(await context.request.get(endpoint('case-history',legacy))).json()).view.financial;expect(old).toMatchObject({gross:null,legacyRecordedAmount:7000,net:null});
 mark('History verified money uses matched original/refund records; an unmatched succeeded refund quarantines totals; legacy amount stays a separate uncorrelated reference without registration-amount fallback');
 const timings=[];
 for(const count of [500,1000]){
  sql(`insert into natori_projects(user_id,title,client_name,type,status) select '${owner}','規模合成${count}-'||g,'架空依頼者','illustration','inquiry' from generate_series(1,${count===500?500:500}) g`);
  const samples=[];let bytes=0;for(let n=0;n<4;n++){const start=performance.now();const r=await context.request.get(endpoint('case-detail',id));const body=await r.text();expect(r.status()).toBe(200);expect(JSON.parse(body).record.id).toBe(id);bytes=Buffer.byteLength(body);samples.push(performance.now()-start);}timings.push({additionalOwnerCases:count,milliseconds:samples,responseBytes:bytes});
 }
 writeFileSync(out+'/detail-metrics.json',JSON.stringify({scope:'local synthetic Auth/middleware/PostgREST; target RPC only; not hosted p95 or full collection performance',timings},null,2));
 expect(provider().length).toBe(at);mark('History direct detail remains target scoped with 500/1000 unrelated synthetic cases; local HTTP samples recorded without provider requests');
 await page.unroute('**/api/natori/admin/case-workspace');
}
