import {createServer} from 'node:http';
import {readFileSync,writeFileSync,openSync,closeSync,existsSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes,createHmac} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {verifyMigration} from './verify-migration.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),out=resolve(process.argv[2]);
if(!out.startsWith('/workspace/')&&!out.startsWith('/tmp/'))throw Error('local output required');
const data=JSON.parse(readFileSync(out+'/fixtures.json','utf8'));
if(!/^\d{14}_natori_case_workspace_read\.sql$/.test(data.migrationFile))throw Error('unexpected migration filename');
const migration=readFileSync(root+'/supabase/migrations/'+data.migrationFile,'utf8');
expect(migration).toBe(data.migration);
const image='sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f';
const name='meish-case-app-'+randomBytes(6).toString('hex'),docker=['--host','unix:///var/run/docker.sock'];
const OWNER='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333';
const api='http://127.0.0.1:4184',app='http://127.0.0.1:4185';
const key='synthetic-case-app-shared-key',service='synthetic-server-key',anon='synthetic-public-key';
const checks=[],requests=[],browserErrors=[],blocked=[];let created=false,httpServer,next,browser,logFd;
let fault=false;
const wait=ms=>new Promise(done=>setTimeout(done,ms));
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const d=(args,input)=>execFileSync('/usr/local/bin/docker',[...docker,...args],{input,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
const sql=(text)=>d(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','postgres','-d','case_app'],text).trim();
const check=label=>checks.push(label);
const ids=data.envelopes.map(e=>e.project.id);
const tableMap={project_intake:'natori_intake_operations',financial_quotes:'natori_quotes',financial_drafts:'natori_estimate_drafts',financial_links:'natori_payment_link_attempts',financial_payments:'natori_payment_transactions',financial_inbox:'natori_stripe_event_inbox',financial_refunds:'natori_refund_ledger',financial_notifications:'natori_notification_jobs',financial_legacy_notices:'natori_order_mail_logs',financial_quote_operations:'natori_quote_issue_operations',financial_link_operations:'natori_payment_link_operations',financial_link_stops:'natori_payment_link_stops',financial_delivery_operations:'natori_delivery_operations',financial_consultation_operations:'natori_consultation_operations',lifecycle_tasks:'natori_project_tasks',lifecycle_files:'natori_delivery_files',lifecycle_roughs:'natori_talk_roughs',lifecycle_rough_acknowledgements:'natori_rough_ok_acknowledgements',lifecycle_releases:'natori_delivery_releases',lifecycle_extensions:'natori_delivery_extensions',lifecycle_consultation:'natori_consultation_messages'};
const insert=(table,row)=>`INSERT INTO public.${table} SELECT (jsonb_populate_record(NULL::public.${table},${literal(JSON.stringify(row))}::jsonb)).*;`;
const titles=['森の表紙イラスト','星の立ち絵','雲のアイコン','小さな庭の挿絵','月のプロフィール画像','雨上がりのラフ','窓辺のポスター','光のカードイラスト'];
const dates=['2026-11-12','2026-10-20','2026-10-23',null,'2026-10-25','2026-10-20','2026-10-24','2026-10-20'];
const records=[];
for(const [index,e] of data.envelopes.entries()){
 const p={...e.project,title:titles[index],client_name:`架空依頼者${index+1}`,due_date:dates[index]};
 if(index===6){p.payment_link_id='plink_synthetic';p.payment_link_url='https://synthetic.invalid/never-opened';}
 records.push(insert('natori_projects',p));
 for(const [section,table] of Object.entries(tableMap))for(const projected of e.sections[section]?.rows??[]){
  const row={...projected};
  if(table.endsWith('_operations'))row.operation_id=row.id;
  if(section==='financial_links'){row.link_id=p.payment_link_id;row.link_url=p.payment_link_url;}
  if(section==='financial_payments')row.stripe_currency=row.currency;
  if(section==='lifecycle_files'){row.content_type='image/webp';row.storage_path='synthetic/'+row.id;row.file_name='synthetic.webp';}
  if(section==='lifecycle_releases')row.manifest=row.manifest_files.map(file=>({id:file.id,path:'synthetic/'+file.id,fileName:'synthetic.webp',sizeBytes:file.size_bytes,contentType:'image/webp',storageVersion:file.storage_version}));
  if(section==='lifecycle_rough_acknowledgements')row.rough_id=row.id;
  records.push(insert(table,row));
 }
}
records.push(insert('natori_projects',{...data.envelopes[0].project,id:'99999999-9999-4999-8999-999999999999',user_id:OTHER,title:'他ownerの架空案件',client_name:'表示禁止の架空依頼者'}));
// A complete DB result with >200 source messages is a real adapter partial domain.
for(let n=0;n<201;n++)records.push(insert('natori_consultation_messages',{id:`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,project_id:ids[2],sender:'client',created_at:'2026-10-19T04:00:00Z'}));
const session=(email)=>{
 const user={id:OTHER,email,aud:'authenticated',role:'authenticated',created_at:'2026-10-19T00:00:00Z',app_metadata:{},user_metadata:{}};
 const exp=Math.floor(Date.now()/1000)+3600,header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({...user,sub:user.id,exp,iat:exp-3600,iss:api+'/auth/v1'})).toString('base64url');
 const token=header+'.'+payload+'.'+createHmac('sha256','synthetic-only').update(header+'.'+payload).digest('base64url');
 return {token,user,cookie:'base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user})).toString('base64url')};
};
const staff=session('staff@example.invalid'),outside=session('outside@example.invalid');
const cookie=(value,name='sb-127-auth-token')=>({name,value,url:app,httpOnly:true,sameSite:'Lax'});
const shared=(hours=0)=>{const issued=String(Math.floor(Date.now()/1000)-hours*3600);return issued+'.'+createHmac('sha256',key).update('natori-dashboard-cookie-v2:'+issued).digest('hex');};
const tables=[...readFileSync(root+'/scripts/natori-case-app-read/fixture-schema.sql','utf8').matchAll(/create table (natori_[a-z_]+)/g)].map(match=>match[1]);
const checksum=()=>sql(`SELECT md5(string_agg(v,'|' ORDER BY v)) FROM (${tables.map(table=>`SELECT ${literal(table)}||COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]') AS v FROM ${table} t`).join(' UNION ALL ')}) records;`);
try{
 d(['run','--detach','--pull','never','--name',name,'--network','none','--memory','512m','--cpus','1','--label','meish.case-app='+name,'--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=256m','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=case_app',image,'postgres','-c','listen_addresses=','-c','max_connections=20']);created=true;
 const info=JSON.parse(d(['inspect',name]))[0];expect(info.Config.Labels['meish.case-app']).toBe(name);expect(info.HostConfig.NetworkMode).toBe('none');expect(info.HostConfig.PortBindings??{}).toEqual({});expect(info.Mounts.every(m=>m.Type==='tmpfs')).toBe(true);
 for(let attempt=0;;attempt++){try{sql('SELECT 1');break;}catch(error){if(attempt>=60)throw error;await wait(250);}}
 sql(readFileSync(root+'/scripts/natori-case-app-read/fixture-schema.sql','utf8'));
 sql(records.join('\n'));
 verifyMigration({sql,migration,owner:OWNER,other:OTHER,ids,checksum,check,out});
 writeFileSync(out+'/applied-migration.sql',migration);
 writeFileSync(out+'/container.json',JSON.stringify({name,image,network:'none',hostPorts:0,mounts:'tmpfs only',schema:'reduced synthetic read fixture'},null,2));
 const initialChecksum=checksum();
 const raw=JSON.parse(sql(`BEGIN READ ONLY;SET LOCAL ROLE service_role;SELECT public.natori_case_workspace_v1('${OWNER}');ROLLBACK;`));
 expect(raw.complete).toBe(true);expect(raw.rows).toHaveLength(8);expect(raw.rows.some(r=>r.project.user_id!==OWNER)).toBe(false);
 expect(new Set(raw.rows.map(r=>r.snapshot_id)).size).toBe(1);check('PostgreSQL: one MVCC snapshot, eight owned envelopes, no other owner');
 for(const role of ['anon','authenticated'])expect(()=>sql(`SET ROLE ${role};SELECT public.natori_case_workspace_v1('${OWNER}');`)).toThrow();
 expect(sql("SELECT bool_and(NOT prosecdef AND provolatile='s') FROM pg_proc WHERE proname IN ('natori_case_snapshot_v1','natori_case_workspace_v1')")).toBe('t');
 expect(sql("SELECT has_table_privilege('service_role','public.natori_projects','INSERT')")).toBe('f');check('PostgreSQL: invoker/stable functions, no anon/authenticated execute, read-only fixture role');
 const cap=JSON.parse(sql(`BEGIN;INSERT INTO natori_projects(id,user_id) SELECT md5('synthetic cap'||n)::uuid,'${OWNER}'::uuid FROM generate_series(1,51) n;SELECT public.natori_case_workspace_v1('${OWNER}');ROLLBACK;`));
 expect(cap).toEqual({complete:false,rows:[]});check('PostgreSQL: collection limit is explicit, no silent truncation');
 httpServer=createServer((req,res)=>{
  const url=new URL(req.url,api);requests.push({method:req.method,path:url.pathname});res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const reply=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
  if(req.method!=='GET')return reply(405,{error:'fixture_get_only'});
  if(url.pathname==='/auth/v1/user'){
   const token=req.headers.authorization?.replace(/^Bearer /,'');const user=token===staff.token?staff.user:token===outside.token?outside.user:null;
   return reply(user?200:401,user??{msg:'Invalid synthetic token'});
  }
  if(req.headers.apikey!==service)return reply(403,{error:'fixture_privileged_read_only'});
  if(url.pathname==='/rest/v1/admin_emails')return reply(200,[]);
  if(url.pathname!=='/rest/v1/rpc/natori_case_workspace_v1')return reply(404,{error:'fixture_unknown_endpoint'});
  if(fault)return reply(503,{message:'synthetic read failure'});
  const owner=url.searchParams.get('p_owner_id');if(!owner||!/^[0-9a-f-]{36}$/.test(owner))return reply(400,{error:'invalid_owner'});
  try{return reply(200,JSON.parse(sql(`BEGIN READ ONLY;SET LOCAL ROLE service_role;SELECT public.natori_case_workspace_v1(${literal(owner)}::uuid);ROLLBACK;`)));}
  catch{return reply(503,{message:'fixture_read_failed'});}
 });
 await new Promise(done=>httpServer.listen(4184,'127.0.0.1',done));
 logFd=openSync(out+'/next-dev.log','w');
 next=spawn(process.execPath,[root+'/node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','4185'],{cwd:out+'/app-fixture',detached:true,env:{PATH:process.env.PATH,LANG:'C.UTF-8',NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,NATORI_OWNER_USER_ID:OWNER,NATORI_STAFF_EMAILS:staff.user.email,NATORI_DASHBOARD_KEY:key,NODE_OPTIONS:'--require='+out+'/allow-local.cjs'},stdio:['ignore',logFd,logFd]});
 for(let attempt=0;;attempt++){try{const r=await fetch(app+'/api/natori/admin/case-workspace');if(r.status===401)break;if(r.status===500)throw Error('Next compile failed');}catch(error){if(attempt>=60)throw error;}await wait(500);}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1050}});
 await context.route('**/*',route=>{const req=route.request();if(!req.url().startsWith(app+'/')){blocked.push(req.url());return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(e.message));
 let response=await context.request.get(app+'/api/natori/admin/case-workspace');expect(response.status()).toBe(401);
 await page.goto(app+'/natori/dashboard/cases');await expect(page).toHaveURL(/admin-login/);check('Next: unauthenticated API denies and actual dashboard layout redirects');
 await context.addCookies([cookie(outside.cookie)]);response=await context.request.get(app+'/api/natori/admin/case-workspace');expect(response.status()).toBe(401);check('Next: authenticated non-staff denied by existing email allowlist');
 await context.addCookies([cookie(staff.cookie)]);response=await context.request.get(app+'/api/natori/admin/case-workspace?owner='+OTHER);expect(response.status()).toBe(200);
 const body=await response.json();expect(body.records).toHaveLength(8);expect(JSON.stringify(body)).not.toMatch(/他owner|表示禁止|stripe_session|payment_link_url|user_id/);expect(response.headers()['cache-control']).toContain('no-store');
 check('Next → pinned Supabase SDK → HTTP fixture → PostgreSQL → reader: owned DTOs, caller owner ignored, no raw secrets');
 await page.goto(app+`/natori/dashboard/cases?entry=cases&case=${ids[0]}&section=transaction`);
 await expect(page.getByRole('heading',{name:titles[0],exact:true})).toBeVisible();expect(await page.getByText('架空データの取得状態',{exact:true}).count()).toBe(0);
 await expect(page.getByRole('heading',{name:titles[0],exact:true})).toBeFocused();
 await page.getByRole('navigation',{name:'案件の領域',exact:true}).getByRole('link',{name:'履歴',exact:true}).click();
 await page.goBack();await expect(page).toHaveURL(/section=transaction/);await page.goForward();await expect(page).toHaveURL(/section=history/);
 await page.screenshot({path:out+'/pc-app.png',fullPage:true});check('Next UI: SSR deep link, common case, back/forward, application controls');
 await page.getByRole('link',{name:'← 案件へ戻る'}).click();await page.getByRole('searchbox').fill('雲');await page.getByLabel('対応で絞り込む').selectOption('staff');
 await page.getByRole('link',{name:/雲のアイコン/}).click();await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('入金の記録あり');
 await page.getByRole('navigation',{name:'案件の領域',exact:true}).getByRole('link',{name:'制作・納品',exact:true}).click();await expect(page.getByText(/1\/4件完了/)).toBeVisible();
 await page.locator('summary').filter({hasText:'分かっていること'}).click();await expect(page.getByText('相談の最新発言：一部の記録を確認できません',{exact:true})).toBeVisible();check('Next UI: actual bounded source partial failure preserves payment/tasks and labels unknown');
 await page.getByRole('link',{name:'← 案件へ戻る'}).click();await expect(page.getByRole('searchbox')).toHaveValue('雲');await expect(page.getByLabel('対応で絞り込む')).toHaveValue('staff');
 await page.getByRole('searchbox').fill('');await page.getByLabel('対応で絞り込む').selectOption('all');
 await page.getByRole('navigation',{name:'主な入口',exact:true}).getByRole('link',{name:'予定',exact:true}).click();await page.getByLabel('予定日').fill('2026-11-12');await page.getByRole('link',{name:/森の表紙/}).click();
 await page.getByRole('link',{name:'← 2026-11-12の予定へ戻る'}).click();await expect(page.getByLabel('予定日')).toHaveValue('2026-11-12');check('Next UI: Cases and Schedule preserve filters, selection and date');
 for(const caseId of ['99999999-9999-4999-8999-999999999999','ffffffff-ffff-4fff-8fff-ffffffffffff']){await page.goto(app+`/natori/dashboard/cases?case=${caseId}`);await expect(page.getByRole('heading',{name:'この表示で案件を確認できません'})).toBeVisible();await expect(page.getByText('他ownerの架空案件',{exact:true})).toHaveCount(0);}
 check('Next UI: missing and foreign case remain indistinguishable and never expose another owner');
 await page.goto(app+`/natori/dashboard/cases?case=${ids[3]}&section=production`);await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('受取の記録あり');
 await expect(page.getByRole('region',{name:'案件の共通案内'})).toContainText('登録納期 未登録');await expect(page.getByText(/受取の記録：.*納品データとの対応は未確認/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.getByRole('combobox',{name:/案件の領域/}).selectOption('history');await page.screenshot({path:out+'/mobile-app.png',fullPage:true});
 for(const width of [375,390,768,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
 check('Next UI: legacy receipt/no fabricated due date, mobile sections and responsive widths');
 const alert=page.locator('[data-natori-admin] [role="alert"]');
 fault=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(alert).toContainText('前回確認した記録');await expect(page.getByRole('heading',{name:titles[3],exact:true})).toBeVisible();
 fault=false;await page.getByRole('button',{name:'表示を再取得'}).click();await expect(alert).toHaveCount(0);check('Next UI: transient read error preserves last facts and recovers');
 await context.clearCookies();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(alert).toContainText('案件の表示を消去');await expect(page.getByRole('heading',{name:titles[3],exact:true})).toHaveCount(0);check('Next UI: lost authorization clears all previous customer facts');
 await context.addCookies([cookie(shared(),'natori_dashboard_key')]);response=await context.request.get(app+'/api/natori/admin/case-workspace');expect(response.status()).toBe(200);
 await context.addCookies([cookie(shared(9),'natori_dashboard_key')]);response=await context.request.get(app+'/api/natori/admin/case-workspace');expect(response.status()).toBe(401);
 await context.addCookies([cookie(key,'natori_dashboard_key')]);response=await context.request.get(app+'/api/natori/admin/case-workspace');expect(response.status()).toBe(401);check('Next: existing shared-key HMAC allowed, expired and plain-key cookie denied');
 await context.addCookies([cookie(staff.cookie)]);response=await context.request.post(app+'/api/natori/admin/case-workspace',{data:{action:'send'}});expect(response.status()).toBe(405);
 expect(checksum()).toBe(initialChecksum);expect(browserErrors).toEqual([]);expect(blocked).toEqual([]);expect(requests.every(r=>r.method==='GET')).toBe(true);check('Isolation: no business row change, external request, backend mutation method or browser error');
 writeFileSync(out+'/integration-results.json',JSON.stringify({success:true,checks,browserErrors,blocked,requests,checksum:initialChecksum,unverified:['real GoTrue server/JWT signing/session refresh','deployed PostgREST/auth configuration','production schema and grants','iPhone hardware'],authBoundary:'actual SDK and unchanged app guards; synthetic Auth HTTP response',dbBoundary:'actual PostgreSQL17 reduced schema and stable functions'},null,2));
 console.log(JSON.stringify({success:true,checks:checks.length,browserErrors,blocked}));
}catch(error){writeFileSync(out+'/integration-results.json',JSON.stringify({success:false,error:String(error),checks,browserErrors,blocked,requests},null,2));throw error;}
finally{
 if(browser)await browser.close();if(next?.pid){try{process.kill(-next.pid,'SIGTERM');}catch{}}
 if(httpServer)await new Promise(done=>httpServer.close(done));if(logFd!==undefined)closeSync(logFd);
 if(created){const info=JSON.parse(d(['inspect',name]))[0];if(info.Config.Labels['meish.case-app']===name&&info.HostConfig.NetworkMode==='none'){d(['rm','--force',name]);writeFileSync(out+'/cleanup.json',JSON.stringify({container:name,ownershipVerified:true,removed:true},null,2));}}
}
