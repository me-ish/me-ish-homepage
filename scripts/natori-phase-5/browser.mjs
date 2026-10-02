// Six original Phase 5 UI cases, isolated real Next/DB admission and one real submission.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setDefaultResultOrder} from 'node:dns';
import {registerPhase5Cases} from './browser-cases.mjs';
const require=createRequire('/app/package.json'),{createClient}=require('@supabase/supabase-js'),{chromium,expect}=require('@playwright/test');
setDefaultResultOrder('ipv4first');
const results=[],checks=[],check=(value,code)=>{if(!value)throw new Error(code);};let server,browser,stage='preflight';
const compileErrors=new Set();
function persist(){writeFileSync('/results/phase5-browser.json',JSON.stringify({tests:results,prerequisites:checks,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,engine:'Chromium1280/360/390px; real ephemeral Next/DB; pinned official fonts; sending disabled; not iPhone Safari',runtimeExecuted:true},null,2));}
async function main(){
 check(process.env.PHASE_N_BROWSER==='ephemeral','EPHEMERAL_REQUIRED');
 const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin),'DESTINATION_REJECTED');const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8'));
 const admin=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}}),password=randomBytes(32).toString('hex');
 const auth=await admin.auth.admin.createUser({email:'phase5-owner@phase0b-browser.invalid',password,email_confirm:true});check(!auth.error&&auth.data.user,'AUTH_FIXTURE');const owner=auth.data.user.id;
 const app='http://localhost:3000',endpoint=app+'/api/natori/portfolio/contact';
 check(JSON.parse(readFileSync('/app/source-checksums.json','utf8')).phase7Fonts?.productFontSourceUnchanged===true,'PINNED_FONT_CONSTRUCTION_REQUIRED');
 server=spawn(process.execPath,['/app/node_modules/next/dist/bin/next','dev','--hostname','localhost','--port','3000'],{cwd:'/app',env:{PATH:'/runtime-bin:/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--dns-result-order=ipv4first',PHASE_N_BROWSER:'ephemeral',PHASE_0B_BROWSER:'ephemeral',PHASE_5_BROWSER:'ephemeral',NEXT_FONT_GOOGLE_MOCKED_RESPONSES:'/app/phase7-font-responses.cjs',NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,NATORI_OWNER_USER_ID:owner,NEXT_PUBLIC_SITE_URL:app,NATORI_PUBLIC_INTAKE_V2:'1',NATORI_ACCEPTANCE_OUTBOX_ENABLED:'1',NATORI_NOTIFICATION_SENDING_ENABLED:'0',RESEND_API_KEY:'',NATORI_ORDER_MAIL_FROM:'Fixture <sender@phase5.invalid>',NATORI_PORTFOLIO_CONTACT_TO:'artist@phase5.invalid'},stdio:['ignore','pipe','pipe']});
 for(const stream of[server.stdout,server.stderr])stream.on('data',b=>{for(const code of['Module not found','Failed to compile','SyntaxError','EADDRINUSE'])if(b.toString().includes(code))compileErrors.add(code);});
 let ready=false;const deadline=Date.now()+120000;while(Date.now()<deadline&&server.exitCode===null){try{const r=await fetch(app+'/ja/fixture-session',{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}check(ready,'NEXT_READY');
 browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP localhost 127.0.0.1']});
 // Verify the actual owner session fixture and real route boundaries before UI cases.
 let ownerStorage;const pre=await browser.newContext();try{
  const page=await pre.newPage();await pre.route('**/*',r=>new URL(r.request().url()).origin===app?r.continue():r.abort('blockedbyclient'));await page.goto(app+'/ja/fixture-session');await page.getByLabel('Email').fill('phase5-owner@phase0b-browser.invalid');await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByText('Session ready', {exact:true})).toBeVisible();
  const before=(await admin.from('natori_intake_operations').select('operation_id').eq('owner_id',owner));check(!before.error,'BEFORE_QUERY');
  const old={name:'Synthetic old client',email:'client@phase5.invalid',requestType:'旧相談',details:'Synthetic boundary probe'};
  check((await pre.request.post(endpoint,{data:old})).status()===403,'CSRF');check((await pre.request.post(endpoint,{data:old,headers:{'x-requested-with':'me-ish',origin:'https://attacker.invalid'}})).status()===403,'ORIGIN');check((await pre.request.post(endpoint,{data:old,headers:{'x-requested-with':'me-ish'}})).status()===409,'OLD_CLIENT');
  const after=await admin.from('natori_intake_operations').select('operation_id').eq('owner_id',owner);check(!after.error&&after.data.length===before.data.length,'BOUNDARY_NO_SIDE_EFFECT');checks.push({name:'owner-session-and-CSRF-origin-old-client',status:'passed'});ownerStorage=await pre.storageState();
 }finally{await pre.close();}
 const cases=[],test=(name,fn)=>cases.push({name,fn});test.info=()=>({outputPath:name=>{check(/^phase5-[a-z0-9-]+\.png$/.test(name),'SCREENSHOT_PATH');return '/results/'+name;}});
 async function prepareActualEnvelope(page){
  await page.getByLabel('ご依頼の種類',{exact:true}).selectOption('other');await page.getByLabel(/ご依頼の種類（その他の内容）/).fill('hidden old request');await page.getByLabel('ご依頼の種類',{exact:true}).selectOption('illustration');
  await page.getByLabel('制作範囲',{exact:true}).selectOption('other');await page.getByLabel(/制作範囲（その他の内容）/).fill('hidden old scope');await page.getByLabel('制作範囲',{exact:true}).selectOption('full_body');
  await page.getByLabel('補足（任意）',{exact:true}).fill('笑顔・泣き顔');
  const details=page.locator('summary').filter({hasText:/^キャラクター・イメージの詳細を入力する/}).locator('..');await details.locator('summary').first().click();
  for(const [label,value]of[['キャラクターの特徴','水色の髪'],['希望する表情・雰囲気','笑顔'],['構図のイメージ','二人並び'],['色のイメージ','青'],['資料についての補足','画像の服装']])await page.getByLabel(label,{exact:true}).fill(value);
  const materials=page.locator('summary').filter({hasText:/^資料/}).locator('..');await materials.locator('summary').first().click();await page.getByLabel('参考URL 1',{exact:true}).fill('https://example.com/phase5-reference');await page.getByLabel('このURLの内容（任意）',{exact:true}).fill('衣装の設定資料');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aqlsAAAAASUVORK5CYII=','base64');await page.getByLabel('キャラクター資料の画像を選択',{exact:true}).setInputFiles({name:'costume.png',mimeType:'image/png',buffer:png});await page.getByLabel(/ご相談・ご依頼の内容/).fill('Synthetic complete quote request');
 }
 async function assertActualEnvelope(page){
  await page.getByRole('checkbox',{name:'オリジナルキャラクター',exact:true}).check();await page.getByLabel(/作品の公開可否/).selectOption('delayed');await page.getByLabel('公開可能日必須',{exact:true}).fill('2026-11-15');
  const budget=page.locator('summary').filter({hasText:/^予算・納期/}).locator('..');if(!await budget.evaluate(el=>el.open))await budget.locator('summary').first().click();
  await page.getByLabel('ご予算',{exact:true}).selectOption('range');await page.getByLabel(/下限（円）/).fill('10000');await page.getByLabel('上限（円・任意）',{exact:true}).fill('15000');await page.getByLabel('希望納期',{exact:true}).selectOption('preferred_date');await page.getByLabel(/希望日/).fill('2026-12-01');await page.getByLabel('納期の補足（任意）',{exact:true}).fill('イベント前まで');

  await page.getByRole('button',{name:'内容を確認する'}).click();
  const reviewText=await page.getByRole('region',{name:'送信前の確認',exact:true}).innerText();
  const responsePromise=page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==='POST'&&r.request().headers()['content-type']?.startsWith('multipart/'));responsePromise.catch(()=>{});
  await page.getByRole('button',{name:'見積もりを依頼する'}).click();const response=await responsePromise;
  check(response.status()===200,'REAL_SUBMIT_STATUS');const accepted=await response.json();check(accepted.accepted&&typeof accepted.receipt==='string','REAL_ACCEPTANCE');
  const request=response.request(),form=await new Request(endpoint,{method:'POST',headers:{'content-type':request.headers()['content-type']},body:request.postDataBuffer()}).formData();const requestData=JSON.parse(String(form.get('requestData')));
  const expected={schemaVersion:1,formVersion:'etorie-request-v1',inquiryMode:'quote',requestType:'illustration',requestTypeOther:null,commissionScope:'full_body',commissionScopeOther:null,options:[{id:'expression_variation',label:'表情差分',quantity:2,notes:'笑顔・泣き顔'}],usageTypes:['original_character'],usageTypeOther:null,commercialUse:'yes',publicationPolicy:'delayed',publicationAllowedFrom:'2026-11-15',budget:{kind:'range',min:10000,max:15000,currency:'JPY'},deadline:{kind:'preferred_date',date:'2026-12-01',note:'イベント前まで'},characterFeatures:'水色の髪',expressionMood:'笑顔',composition:'二人並び',colorDirection:'青',referenceNotes:'画像の服装',message:'Synthetic complete quote request',legacySource:null};
  expect(requestData).toEqual(expected);expect(JSON.parse(String(form.get('referenceLinks')))).toEqual([{url:'https://example.com/phase5-reference',label:'衣装の設定資料'}]);check(form.getAll('refImages').length===1&&form.getAll('refImages')[0].name==='costume.png','ACTUAL_REFERENCE_IMAGE');
  check(requestData.options.some(option=>option.quantity===2&&option.label.includes('表情差分')),'RAW_INTEGER_AND_OPTION');
  const op=await admin.from('natori_intake_operations').select('project_id,status').eq('owner_id',owner).eq('operation_id',accepted.receipt).single();check(!op.error&&op.data.status==='completed','ATOMIC_OPERATION');
  const saved=await admin.from('natori_projects').select('id,user_id,request_data,client_name,client_email').eq('id',op.data.project_id).eq('user_id',owner).single();check(!saved.error&&saved.data.id===op.data.project_id,'SAVED_PROJECT_OWNER');expect(saved.data.request_data).toEqual(requestData);expect(saved.data.client_name).toBe(String(form.get('name')));expect(saved.data.client_email).toBe(String(form.get('email')));
  const manager=await browser.newContext({storageState:ownerStorage});try{const projection=await manager.request.get(app+'/api/fixture-phase5-request-view?projectId='+encodeURIComponent(op.data.project_id));check(projection.status()===200,'SAVED_MANAGEMENT_PROJECTION');const displayed=await projection.json();check(displayed.projectId===op.data.project_id&&displayed.view.kind==='structured','PROJECT_SCOPED_SHARED_VIEW');expect(displayed.requestData).toEqual(saved.data.request_data);expect(displayed.view.request).toEqual(requestData);expect(displayed.referenceLinks).toEqual(JSON.parse(String(form.get('referenceLinks'))));for(const field of displayed.view.sections.flatMap(section=>section.fields).filter(field=>field.value!=='未記入'))expect(reviewText).toContain(field.value);check(displayed.referenceFiles===1,'SAVED_REFERENCE_IMAGE_COUNT');}finally{await manager.close();}
  const notices=await admin.from('natori_notification_jobs').select('purpose,snapshot').eq('project_id',op.data.project_id);check(!notices.error&&notices.data.length===2,'ATOMIC_TWO_NOTICES');
  for(const purpose of['intake_artist','intake_client']){const notice=notices.data.find(row=>row.purpose===purpose);check(notice,'NOTICE_PURPOSE');expect(notice.snapshot.requestData).toEqual(requestData);}
  await expect(page.getByText('送信ありがとうございます!',{exact:true})).toBeVisible();checks.push({name:'reviewed-390px-envelope-actual-POST-and-two-atomic-notices',status:'passed'});
 }
 registerPhase5Cases({test,expect,prepareActualEnvelope,DEMO_PATH:app+'/ja/fixture-phase5',assertActualEnvelope,
  openInquiry:async(page,label)=>{await page.locator('#form').getByRole('link',{name:label}).click();await expect(page).toHaveURL(/\/fixture-phase5\/contact\?/);await expect(page.getByRole('heading',{name:'ご相談・ご依頼',exact:true})).toBeVisible();},
  fillContact:async(page,suffix)=>{await page.getByLabel(/お名前/).fill('Synthetic '+suffix);await page.getByLabel(/メールアドレス/).fill('client-'+suffix+'@phase5.invalid');}});
 check(cases.length===6,'EXACT_SIX_CASES');
 for(const item of cases){stage=item.name;const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const pageErrors=[];page.on('pageerror',()=>pageErrors.push('PAGE_ERROR'));await context.route('**/*',r=>new URL(r.request().url()).origin===app?r.continue():r.abort('blockedbyclient'));
  try{await item.fn({page});check(pageErrors.length===0,'PAGE_ERROR');results.push({name:item.name,status:'passed'});console.log('PASS phase5-browser/'+item.name);}catch(error){results.push({name:item.name,status:'failed',code:/^[A-Z_0-9]+$/.test(error?.message??'')?error.message:'ASSERTION_FAILED'});console.log('FAIL phase5-browser/'+item.name);}finally{await context.close();persist();}
 }
 check(results.length===6&&results.every(row=>row.status==='passed')&&compileErrors.size===0,'BROWSER_FAILED');
}
main().catch(()=>{console.error(`Phase5 browser failed at ${stage}; raw logs withheld`);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(()=>{server.kill('SIGKILL');r();},5000))]);}});
