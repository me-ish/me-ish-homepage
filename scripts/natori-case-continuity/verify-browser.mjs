import {expect as baseExpect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {writeFileSync,readFileSync,readdirSync} from 'node:fs';
const expect=baseExpect.configure({timeout:30000});
export async function checkContinuityBrowser({page,context,app,owner,other,sql,mark,provider,out}){
 const id=randomUUID(),quote=randomUUID(),failed=randomUUID(),unknown=randomUUID();
 const payload=JSON.stringify({from:'Local <mail@example.invalid>',to:['fixture@example.invalid'],reply_to:'reply@example.invalid',subject:'古い合成通知',text:'確認する保存本文',headers:{'X-Meish-Template':'fixture'}}).replaceAll("'","''");
 sql(`insert into natori_projects(id,user_id,title,client_name,type,status,amount) values('${id}','${owner}','上限を超えた通知の案件','合成依頼者','illustration','quoted',12000);
 insert into natori_quotes(id,project_id,user_id,version,title,client_name,to_email,amount,subject,body_snapshot,token_hash,expires_at,accepted_at) values('${quote}','${id}','${owner}',1,'合成版','合成依頼者','fixture@example.invalid',12000,'合成','合成','${randomUUID()}',now()+interval '7 day','2026-10-18');
 update natori_projects set active_quote_id='${quote}',quote_accepted_at='2026-10-18',quote_accepted_amount=12000 where id='${id}';
 insert into natori_notification_jobs(id,project_id,quote_id,notification_key,purpose,status,attempt_no,snapshot,payload,created_at) values('${failed}','${id}','${quote}','browser/${id}/failed','quote_accept_artist','failed',1,jsonb_build_object('acceptedAt','2026-10-18T00:00:00Z','amount',12000),'${payload}',now()-interval '20 day'),('${unknown}','${id}','${quote}','browser/${id}/unknown','quote_accept_artist','unknown',1,jsonb_build_object('acceptedAt','2026-10-18T00:00:00Z','amount',12000),'${payload}',now()-interval '19 day');
 insert into natori_notification_jobs(project_id,quote_id,notification_key,purpose,status,attempt_no,snapshot,created_at) select '${id}','${quote}','browser/${id}/new/'||g,'quote_accept_artist','unknown',1,jsonb_build_object('acceptedAt','2026-10-18T00:00:00Z','amount',12000),now()-g*interval '1 second' from generate_series(1,250) g;`);
 const url=notice=>`${app}/natori/dashboard?case=${id}&section=transaction&notice=${notice}&q=保持する検索&date=2026-10-23&noticePage=3`;
 const admin=page.getByRole('region',{name:'既存操作の統合'}),review=page.getByRole('region',{name:'結果不明の照合'});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1050});await page.goto(url(unknown).replace('section=transaction','section=history')+'&historyPage=6');
  await page.getByRole('region',{name:'案件の履歴と金銭参照'}).locator('li').filter({hasText:'記録ID '+unknown}).getByRole('button',{name:'この通知を案件内で確認'}).click();
  expect(new URL(page.url()).searchParams.get('notice')).toBe(unknown);expect(new URL(page.url()).searchParams.get('section')).toBe('transaction');
  await expect(review.getByText('選択した通知ID：'+unknown,{exact:false})).toBeVisible();
  await expect(admin.getByText('結果不明・要確認',{exact:false})).toBeVisible();
  await expect(admin.getByRole('button',{name:'この通知の復旧内容を確認'})).toHaveCount(0);
  await review.getByRole('button',{name:'メール受付を外部照合'}).click();
  await expect(review.getByText('取得できません',{exact:false})).toBeVisible();
  expect(sql(`select status from natori_notification_jobs where id='${unknown}'`)).toBe('unknown');
  await expect(review.getByRole('button',{name:'照合結果の保存内容を確認'})).toHaveCount(0);
  await page.reload();await expect(admin.getByText('結果不明・要確認',{exact:false})).toBeVisible();
  await page.screenshot({path:`${out}/old-unknown-${width}.png`,fullPage:true});
  mark(`Continuity ${width}px exact old unknown beyond 200: scope-missing inspection remains unavailable, no apply/retry, reload keeps target and fences`);
 }
 await page.goto(app+'/natori/dashboard?entry=notifications&noticePage=6');
 await page.locator(`a[href*="notice=${failed}"]`).click();
 await expect(admin.getByText('選択した通知1件だけを確認しています。',{exact:false})).toBeVisible();
 expect(new URL(page.url()).searchParams.get('notice')).toBe(failed);
 await admin.getByRole('button',{name:'この通知の復旧内容を確認'}).click();
 const confirmation=page.getByRole('region',{name:'案件操作の確認'});await expect(confirmation).toContainText('fixture@example.invalid');await expect(confirmation).toContainText('確認する保存本文');await expect(confirmation).toContainText(quote);
 // Lose the response after the real isolated DB commit; replay the same operation.
 let lost=false;await page.route('**/api/natori/admin/case-administration',async route=>{if(route.request().method()==='POST'&&!lost){lost=true;await route.fetch();return route.abort('failed');}return route.continue();});
 await confirmation.getByRole('button',{name:'確認した内容で実行',exact:true}).click();
 await expect(confirmation.getByRole('button',{name:'同じ操作IDの保存を確認・再試行'})).toBeEnabled();
 await confirmation.getByRole('button',{name:'同じ操作の結果を照会'}).click();
 await expect(confirmation.getByRole('button',{name:'確認済みの操作を閉じる'})).toBeEnabled();
 await confirmation.getByRole('button',{name:'確認済みの操作を閉じる'}).click();await page.unroute('**/api/natori/admin/case-administration');
 expect(sql(`select count(*) from natori_notification_jobs where notification_key='browser/${id}/failed'`)).toBe('2');
 await expect(admin.getByText('過去の試行です。この記録から復旧しません。',{exact:false})).toBeVisible();
 await expect(admin.getByRole('button',{name:'この通知の復旧内容を確認'})).toHaveCount(0);
 const before=provider().length;await page.reload();await expect(admin.getByText('過去の試行です。',{exact:false})).toBeVisible();expect(provider().length).toBe(before);
 const foreign=randomUUID();sql(`insert into natori_projects(id,user_id,title,client_name,type,status) values('${foreign}','${other}','別owner','合成','illustration','inquiry')`);
 for(const name of ['case-administration','case-reconciliation'])expect((await context.request.get(`${app}/api/natori/admin/${name}?projectId=${foreign}&notificationId=${unknown}`)).status()).toBe(404);
 mark('Continuity exact failed target freezes recipient/body/quote; post-commit response loss recovers one receipt, old attempt cannot repeat, foreign scope denied');
}

export async function checkScaleBrowser({page,context,app,owner,sql,mark,provider,out,metrics,setScaleFault}){
 const results=[],prefix='perf-'+randomUUID(),at=provider().length;
 const paths=['/case-workspace','/case-workspace/entries?kind=events','/case-workspace/entries?kind=notices','/case-planning'];
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 const dbStats=()=>JSON.parse(sql(`select json_build_object('statementCalls',coalesce(sum(calls),0),'executionMs',coalesce(sum(total_exec_time),0),'rows',coalesce(sum(rows),0),'rpcCalls',coalesce(sum(calls) filter(where query like '%natori_case_entry_page_v1%'),0)) from pg_stat_statements where dbid=(select oid from pg_database where datname=current_database()) and query not like '%pg_stat_statements%'`));
 let seeded=0;
 for(const size of [500,1000]){
  sql(`insert into natori_projects(user_id,title,client_name,type,status,amount,start_date,due_date) select '${owner}','${prefix}-'||g,'合成依頼者','illustration','inquiry',12000,'2026-10-22','2026-11-20' from generate_series(${seeded+1},${size}) g;
   insert into natori_events(user_id,title,date) select '${owner}','${prefix}-event-'||g,'2026-10-22'::date+(g%45) from generate_series(${seeded*2+1},${size*2}) g;
   insert into natori_notification_jobs(project_id,notification_key,purpose,status,attempt_no,snapshot) select p.id,'${prefix}-notice-'||g,'quote_accept_artist','unknown',1,'{}' from generate_series(${seeded*2+1},${size*2}) g cross join lateral(select id from natori_projects where user_id='${owner}' and title='${prefix}-'||(g%${size}+1) limit 1) p;
   insert into natori_project_tasks(project_id,task_key,label,stage,sort_order) select id,'perf-'||g,'合成タスク'||g,'rough',g from natori_projects cross join generate_series(1,6) g where user_id='${owner}' and title like '${prefix}-%' and substring(title from length('${prefix}')+2)::int between ${seeded+1} and ${size} and substring(title from length('${prefix}')+2)::int%10=0;`);
  seeded=size;
  const plans={};for(const kind of ['cases','events','notices'])plans[kind]=JSON.parse(sql(`explain(analyze,buffers,format json) select natori_case_entry_page_v1('${owner}','${kind}',0)`));
  writeFileSync(out+`/scale-plans-${size}.json`,JSON.stringify({scope:'function-call EXPLAIN only; nested physical plans are not exposed by this outer Function Scan',plans},null,2));
  const counts=JSON.parse(sql(`select json_build_object('projects',(select count(*) from natori_projects where user_id='${owner}'),'events',(select count(*) from natori_events where user_id='${owner}'),'notices',(select count(*) from natori_notification_jobs n join natori_projects p on p.id=n.project_id where p.user_id='${owner}'),'tasks',(select count(*) from natori_project_tasks t join natori_projects p on p.id=t.project_id where p.user_id='${owner}'))`));
  for(const phase of ['first','warm','parallel']){
   const label=`${size}-${phase}`;writeFileSync(out+'/memory-phase.txt',label);sql('select pg_stat_statements_reset()');const startAt=metrics.length;
   const request=async path=>{const start=performance.now(),r=await context.request.get(app+'/api/natori/admin'+path,{timeout:90000}),body=await r.body();expect(r.status(),path+': '+body.toString().slice(0,150)).toBe(200);const value=JSON.parse(body.toString());if(path==='/case-workspace')expect(value.records.length).toBe(counts.projects);if(path.includes('kind=events'))expect(value.items.length).toBe(counts.events);if(path.includes('kind=notices'))expect(value.items.length).toBe(counts.notices);return {path,milliseconds:performance.now()-start,responseBytes:body.length};};
   const start=performance.now(),http=phase==='parallel'?await Promise.all(paths.flatMap(path=>[request(path),request(path),request(path)])):await Promise.all(paths.map(request));
   results.push({size,label,counts,wallMs:performance.now()-start,http,db:dbStats(),gateway:metrics.slice(startAt)});writeFileSync(out+'/scale-metrics.json',JSON.stringify({scope:'isolated local dev Node22, Docker DB1CPU/512MB, Docker-exec HTTP relay; synthetic schema/data; not hosted or production build',results},null,2));
  }
  writeFileSync(out+'/memory-phase.txt',`${size}-browser`);const start=performance.now();await page.goto(app+'/natori/dashboard?entry=cases');await expect(page.getByText('表示を取得しました',{exact:true})).toBeAttached({timeout:90000});const loadedMs=performance.now()-start;
  const searchAt=performance.now();await page.getByRole('searchbox',{name:'案件を検索'}).fill(prefix+'-'+size);await expect(page.getByText(prefix+'-'+size,{exact:true})).toBeVisible();const searchMs=performance.now()-searchAt;
  await page.reload();await expect(page.getByText('表示を取得しました',{exact:true})).toBeAttached({timeout:90000});
  const focusAt=performance.now(),focused=page.waitForResponse(r=>r.url().includes('/api/natori/admin/case-workspace')&&!r.url().includes('/entries'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await focused;await expect(page.getByText('表示を取得しました',{exact:true})).toBeAttached({timeout:90000});const focusMs=performance.now()-focusAt;
  const calendarAt=performance.now();await page.getByRole('navigation',{name:'主な入口',exact:true}).getByRole('link',{name:'予定',exact:true}).click();
  await page.getByLabel('表示月',{exact:true}).fill('2026-11');await expect(page.getByRole('button',{name:/2026-11-20 登録納期/})).toBeVisible();const calendarMs=performance.now()-calendarAt;
  await page.setViewportSize({width:390,height:1050});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.goBack();await expect(page.getByLabel('表示月',{exact:true})).toHaveValue('2026-10');await page.goForward();await expect(page.getByLabel('表示月',{exact:true})).toHaveValue('2026-11');await page.setViewportSize({width:1440,height:1050});
  const browser=(await cdp.send('Performance.getMetrics')).metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents'].includes(m.name));results.push({size,label:`${size}-browser`,loadedMs,searchMs,focusMs,calendarMs,browser});writeFileSync(out+'/scale-metrics.json',JSON.stringify({scope:'isolated local dev Node22/Docker DB1CPU512MB/exec relay; no hosted p95/SLO inference',results},null,2));
  mark(`Scale ${counts.projects} owned cases/${counts.events} events/${counts.notices} notices: full counts, cold/warm/parallel RPC SQL HTTP/memory samples and browser search/reload recorded`);
 }
 for(const fault of ['unavailable','changed']){
  setScaleFault(fault);const response=await context.request.get(app+'/api/natori/admin/case-workspace/entries?kind=events',{timeout:90000});
  expect(response.status()).toBe(503);expect(await response.json()).not.toHaveProperty('items');
 }
 const recovered=await context.request.get(app+'/api/natori/admin/case-workspace/entries?kind=events',{timeout:90000});expect(recovered.status()).toBe(200);expect((await recovered.json()).items).toHaveLength(2000);
 mark('Scale later-page transport failure and actual DB catalogue revision change return 503 with no partial items; an explicit new read recovers all 2000 events');
 const memory=readdirSync(out).filter(name=>/^memory-\d+\.json$/.test(name)).map(name=>JSON.parse(readFileSync(out+'/'+name,'utf8')));writeFileSync(out+'/scale-memory.json',JSON.stringify(memory,null,2));expect(provider().length).toBe(at);
 mark('Scale read-only run created no provider requests; complete collection counts checked at both synthetic scales');
}
