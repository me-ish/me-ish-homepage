import {expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:15000});

/** Only synthetic local fixtures. Caller owns the isolated DB and egress policy. */
export async function checkEntryPages({out,page,context,app,owner,other,ids,sql,mark,readOnly,allowEvents,providerCount}){
 const readPage=(kind,offset=0,revision=null,target=owner)=>JSON.parse(sql(`begin read only;set local role service_role;select public.natori_case_entry_page_v1('${target}','${kind}',${offset},${revision?`'${revision}'`:'null'});rollback;`));
 sql(`insert into natori_projects(id,user_id,title,client_name,status,type,amount)
  select ('f0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${owner}','合成全件案件'||n,'架空依頼者',case when n>=119 then 'completed' else 'quoted' end,'illustration',12000 from generate_series(1,120)n;
  update natori_projects set deleted_at=now() where id='f0000000-0000-4000-8000-000000000119';
  insert into natori_events(user_id,title,date,note) select '${owner}','架空個人予定'||n,case when n=1005 then '2027-01-01'::date when n%3=0 then '2026-10-31'::date when n%3=1 then '2026-11-01'::date else '2026-12-01'::date end,'案件の入金とは別の予定' from generate_series(1,1005)n;
  insert into natori_events(user_id,title,date) values('${other}','別ownerの予定','2026-11-01');
  insert into natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,status)
  select 'r4-paged-series/'||n,q.project_id,q.id,'quote_accept_artist',jsonb_build_object('amount',q.amount,'acceptedAt',q.accepted_at),'unknown'
   from natori_quotes q cross join generate_series(1,251)n where q.project_id='${ids[0]}';
  update natori_notification_jobs set status='failed' where notification_key='r4-paged-series/1';
  insert into natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,status,attempt_no)
   select notification_key,project_id,quote_id,purpose,snapshot,'unknown',2 from natori_notification_jobs where notification_key='r4-paged-series/1';`);
 const acl=sql("select not prosecdef and provolatile='s' and proconfig=ARRAY['search_path=\"\"']::text[] and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute') and has_function_privilege('service_role',oid,'execute') from pg_proc where oid='public.natori_case_entry_page_v1(uuid,text,integer,text)'::regprocedure");
 expect(acl).toBe('t');
 for(const kind of ['cases','events','notices']){
  let offset=0,revision=null,total=null;const rows=[];
  do{const result=readPage(kind,offset,revision);expect(result.changed).toBe(false);if(total!==null)expect(result.total).toBe(total);revision=result.revision;total=result.total;rows.push(...result.rows);offset=result.next;}while(offset!==null);
  expect(rows.length).toBe(total);expect(new Set(rows.map(r=>kind==='cases'?r.project.id:r.id)).size).toBe(total);
  expect(rows.every(r=>(kind==='cases'?r.project.user_id:r.user_id)===owner)).toBe(true);
  expect(readPage(kind,0,null,'ffffffff-ffff-4fff-8fff-ffffffffffff').total).toBe(0);
  if(kind==='events')expect(rows.length).toBe(1005);
  if(kind==='notices'){expect(rows.length).toBe(252);expect(rows.filter(r=>r.attempt_no===2)).toHaveLength(1);}
  mark(`R4 SQL ${kind}: all bounded pages complete/unique/owner-scoped, empty owner distinct, read-only transaction`);
 }
 const old=readPage('cases');sql(`update natori_projects set title=title||'更新' where id='f0000000-0000-4000-8000-000000000120'`);
 expect(readPage('cases',50,old.revision).changed).toBe(true);
 const oldEvents=readPage('events');sql(`insert into natori_events(user_id,title,date) values('${owner}','月末の追加個人予定','2026-10-31')`);
 expect(readPage('events',50,oldEvents.revision).changed).toBe(true);
 const oldNotices=readPage('notices');sql("update natori_notification_jobs set status='failed' where notification_key='r4-paged-series/1' and attempt_no=2");
 expect(readPage('notices',50,oldNotices.revision).changed).toBe(true);
 mark('R4 SQL changing catalogues invalidate later pages; INVOKER/STABLE/search_path/EXECUTE ACL preserved');
 const all=await(await context.request.get(app+'/api/natori/admin/case-workspace')).json();
 expect(all.records.length).toBeGreaterThan(120);expect(all.records.some(r=>r.id===ids[10])).toBe(false);
 expect(all.records.find(r=>r.id==='f0000000-0000-4000-8000-000000000120').display.project.value.rawStatus).toBe('completed');
 expect(all.records.find(r=>r.id==='f0000000-0000-4000-8000-000000000119').display.project.value.archivedAt).not.toBeNull();
 const events=await(await context.request.get(app+'/api/natori/admin/case-workspace/entries?kind=events')).json();
 expect(events.items).toHaveLength(1006);expect(events.items.some(e=>e.title==='別ownerの予定')).toBe(false);
 const notices=await(await context.request.get(app+'/api/natori/admin/case-workspace/entries?kind=notices')).json();expect(notices.items).toHaveLength(252);
 mark('R4 actual API returns all cases, >1000 personal events and all latest notification series without silent service row limits');
 const tables=sql("select tablename from pg_tables where schemaname='public' and tablename like 'natori_%' order by tablename").split('\n');
 const checksum=()=>sql(tables.map(t=>`select '${t}'||coalesce(md5(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text),'empty') from public.${t} r`).join(';'));
 const before=checksum(),providerBefore=providerCount();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1050});await page.goto(app+'/natori/dashboard?entry=cases&page=3');
  await expect(page.locator('#case-f0000000-0000-4000-8000-000000000120')).toBeVisible();
  await page.locator('#case-f0000000-0000-4000-8000-000000000120').click();await expect(page.getByRole('heading',{name:'合成全件案件120更新',exact:true})).toBeVisible();
  await page.reload();await page.getByRole('link',{name:'← 案件へ戻る',exact:true}).click();await expect(page).toHaveURL(/page=3/);
  await page.getByRole('searchbox').fill('全件案件120');await expect(page.locator('#case-f0000000-0000-4000-8000-000000000120')).toBeVisible();
  await expect(page).not.toHaveURL(/page=3/);
  await page.goto(app+'/natori/dashboard?entry=notifications&noticePage=5');
  const panel=page.getByRole('region',{name:'通知系列の一覧'});await expect(panel).toContainText('5 / 6ページ');
  const selected=panel.locator('a').first(),href=await selected.getAttribute('href'),id=new URL(href,app).searchParams.get('notice');await selected.click();
  await expect(page.getByRole('complementary',{name:'選択した通知'})).toContainText(id);await expect(page.getByRole('complementary',{name:'選択した通知'})).toContainText('系列全体は未確認');
  await page.reload();await page.getByRole('link',{name:'← 通知へ戻る',exact:true}).click();await expect(panel).toContainText('5 / 6ページ');
  await expect(page.locator('#index-notice-'+id)).toBeFocused();await page.goBack();await expect(page.getByRole('complementary',{name:'選択した通知'})).toContainText(id);await page.goForward();
  await page.goto(app+'/natori/dashboard?entry=schedule&month=2026-10&date=2026-10-31');
  const personal=page.getByRole('region',{name:'個人予定',exact:true});await expect(personal).toContainText('月末の追加個人予定');
  await page.getByLabel('表示月').fill('2026-11');await page.getByRole('button',{name:/2026-11-01 登録納期/}).click();await expect(personal).toContainText('架空個人予定1');
  await expect(personal).not.toContainText('月末の追加個人予定');
  await page.getByLabel('表示月').fill('2026-12');await page.getByRole('button',{name:/2026-12-01 登録納期/}).click();await expect(personal).toContainText('架空個人予定2');
  await page.getByLabel('表示月').fill('2027-01');await page.getByRole('button',{name:/2027-01-01 登録納期/}).click();await expect(personal).toContainText('架空個人予定1005');
  if(readOnly)await expect(personal.getByRole('button',{name:'予定を追加',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:out+`/pages-${width}.png`,fullPage:true});
  mark(`R4 ${width}px case page3/search and notification page5 exact ID survive reload/history; personal events survive month/year boundaries separately`);
 }
 expect(checksum()).toBe(before);expect(providerCount()).toBe(providerBefore);
 mark('R4 all large collection browsing is business-read-only and never authorizes send or payment from the notice index');
 if(!readOnly){
  await page.goto(app+'/natori/dashboard?entry=schedule&date=2027-01-01&month=2027-01');
  const personal=page.getByRole('region',{name:'個人予定',exact:true});await personal.getByRole('button',{name:'予定を追加',exact:true}).click();
  await personal.getByLabel('タイトル',{exact:true}).fill('架空手動予定');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:/2027-01-02 登録納期/}).click();await expect(page.getByLabel('予定日')).toHaveValue('2027-01-01');
  allowEvents(true);await personal.getByRole('button',{name:'追加',exact:true}).click();await expect(personal.getByText('架空手動予定',{exact:true})).toBeVisible();
  await personal.getByRole('button',{name:'予定「架空手動予定」を編集',exact:true}).click();await personal.getByLabel('タイトル',{exact:true}).fill('架空手動予定・更新');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:/2027-01-02 登録納期/}).click();await expect(page.getByLabel('予定日')).toHaveValue('2027-01-01');
  await personal.getByRole('button',{name:'更新',exact:true}).click();await expect(personal.getByText('架空手動予定・更新',{exact:true})).toBeVisible();
  await personal.getByRole('button',{name:'予定「架空手動予定・更新」を削除',exact:true}).click();
  const [deleted]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname==='/api/natori/admin/events'&&response.request().method()==='DELETE'),page.getByRole('dialog').getByRole('button',{name:'予定を削除',exact:true}).click()]);
  expect(deleted.status()).toBe(200);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(personal).toBeVisible();await expect(personal.getByText('架空手動予定・更新',{exact:true})).toHaveCount(0);
  allowEvents(false);expect(providerCount()).toBe(providerBefore);expect(checksum()).toBe(before);
  mark('R4 explicit personal-event create/edit/delete uses existing real local API; draft date change cancelled, no case/payment/provider side effects');
 }
}
