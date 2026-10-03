// Additional real-user paths run against the same sealed application and owner.
// Rate limits remain unchanged. Separate Next processes give independent process-local
// admission windows; A and B in the first case deliberately share one process/context.
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const codes=['Module not found','Failed to compile','SyntaxError','EADDRINUSE'];
const exited=server=>server.exitCode!==null||server.signalCode!==null;

async function readyNext(server,app,check){
 const deadline=Date.now()+120000;
 while(Date.now()<deadline&&!exited(server)){
  try{const response=await fetch(app+'/ja/fixture-session',{signal:AbortSignal.timeout(2000)});if(response.ok){check(!exited(server),'NEXT_EXITED_AFTER_READY');return;}}catch{}
  await pause(400);
 }
 check(false,'ADDITIONAL_NEXT_READY');
}

/** Fail closed if a previous fixture can still answer on the shared port. */
export async function stopIsolatedNext(server,app,check){
 if(server&&!exited(server)){
  const completed=new Promise(resolve=>server.once('exit',resolve));
  server.kill('SIGTERM');
  await Promise.race([completed,pause(5000)]);
  if(!exited(server)){server.kill('SIGKILL');await Promise.race([completed,pause(5000)]);}
 }
 check(!server||exited(server),'NEXT_DID_NOT_EXIT');
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
  try{await fetch(app+'/ja/fixture-session',{signal:AbortSignal.timeout(2000)});}
  catch(error){
   // A timeout is insufficient proof: a live worker may still be serving this port.
   if(error?.cause?.code==='ECONNREFUSED')return;
  }
  await pause(200);
 }
 check(false,'NEXT_PORT_NOT_CLOSED');
}

export async function runIntakeFrontendRegressions({test,check,expect,browser,app,endpoint,owner,admin,key,startNext,compileErrors,onEvidence}){
 const success='送信ありがとうございます!',email='client@phase3a.invalid',name='Synthetic continuation';
 const multipart=request=>request.url()===endpoint&&request.headers()['content-type']?.startsWith('multipart/');
 async function savedOperation(page){
  const saved=await page.evaluate(k=>{const raw=sessionStorage.getItem(k);return raw===null?null:JSON.parse(raw);},key);
  check(saved&&typeof saved.operationId==='string'&&typeof saved.requestHash==='string'&&saved.fields,'FROZEN_OPERATION_REQUIRED');return saved;
 }
 async function effects(id){
  const operation=await admin.from('natori_intake_operations').select('operation_id,project_id,status,request_hash').eq('owner_id',owner).eq('operation_id',id).single();check(!operation.error&&operation.data,'OPERATION_READ');
  const projects=await admin.from('natori_projects').select('id,client_email').eq('id',operation.data.project_id);
  const notices=await admin.from('natori_notification_jobs').select('id,snapshot').eq('project_id',operation.data.project_id).order('id');
  check(!projects.error&&!notices.error,'EFFECTS_READ');return {op:operation.data,projects:projects.data??[],notices:notices.data??[]};
 }
 async function ownerEffects(){
  const projects=await admin.from('natori_projects').select('id').eq('user_id',owner);check(!projects.error,'OWNER_PROJECTS_READ');
  const notices=projects.data.length?await admin.from('natori_notification_jobs').select('id').in('project_id',projects.data.map(project=>project.id)):{data:[],error:null};
  check(!notices.error,'OWNER_NOTICES_READ');return {projects:projects.data.length,notices:notices.data.length};
 }
 async function freshScenario(scenario,expectedAcceptedResponses,fn){
  const fixture=startNext();let context;const evidence={scenario,ready:false,closed:false,rateLimitedResponses:0,multipartResponses:0};
  for(const stream of[fixture.stdout,fixture.stderr])stream.on('data',buffer=>{for(const code of codes)if(buffer.toString().includes(code))compileErrors.add(code);});
  try{
   await readyNext(fixture,app,check);evidence.ready=true;
   context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/*',route=>new URL(route.request().url()).origin===app?route.continue():route.abort('blockedbyclient'));
   const page=await context.newPage();page.on('response',response=>{if(response.url()===endpoint){if(response.status()===429)evidence.rateLimitedResponses++;if(multipart(response.request()))evidence.multipartResponses++;}});
   await fn(page);check(evidence.rateLimitedResponses===0,'ACTUAL_RATE_LIMIT_REACHED');check(evidence.multipartResponses===expectedAcceptedResponses,'EXPECTED_REAL_SUBMISSIONS');
  }finally{
   await context?.close();await stopIsolatedNext(fixture,app,check);evidence.closed=true;onEvidence(evidence);
  }
 }
 async function consultation(page,mode,message){
  if(mode==='structured')await page.getByRole('radio',{name:'まず相談したい',exact:true}).check();
  else await page.getByRole('button',{name:'まず相談したい',exact:true}).click();
  await expect(page.getByLabel(/^お名前/)).toBeEnabled();await page.getByLabel(/^お名前/).fill(name);await page.getByLabel(/^メールアドレス/).fill(email);
  await page.getByLabel(mode==='structured'?/^ご相談・ご依頼の内容/:/^ご依頼の詳細/).fill(message);
  if(mode==='legacy')await page.getByLabel('その他・ご質問',{exact:true}).fill('');
  await page.getByRole('button',{name:mode==='structured'?'内容を確認する':'次へ進む',exact:true}).click();
 }
 async function actualSubmit(page,label){
  const observed=page.waitForResponse(response=>multipart(response.request()),{timeout:120000});await page.getByRole('button',{name:label,exact:true}).click();
  const response=await observed,data=await response.json();check(response.status()===200&&data.accepted===true&&typeof data.receipt==='string','ACTUAL_ACCEPTED_RESPONSE');
  await expect(page.getByText(success,{exact:true})).toBeVisible({timeout:30000});await expect(page.getByText(data.receipt,{exact:false})).toBeVisible();return {receipt:data.receipt,saved:await savedOperation(page)};
 }
 async function interruptBeforeBegin(page,label){
  let resolve;const aborted=new Promise(done=>{resolve=done;});
  await page.route('**/api/natori/portfolio/contact',async route=>{if(multipart(route.request())){await route.abort('failed');resolve();}else await route.continue();});
  await page.getByRole('button',{name:label,exact:true}).click();await aborted;await expect(page.getByRole('button',{name:'受付結果を確認する',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'新しい依頼を始める',exact:true})).toHaveCount(0);const saved=await savedOperation(page);await page.unroute('**/api/natori/portfolio/contact');return saved;
 }
 async function originalAnswers(page,saved,markers){
  const visible=page.getByLabel('保存した入力内容',{exact:true});await expect(visible).toBeVisible();await expect(visible).toHaveJSProperty('readOnly',true);
  const text=await visible.inputValue();check(text.includes(name)&&text.includes(email)&&markers.every(marker=>text.includes(marker)),'VISIBLE_ORIGINAL_ANSWERS');check(!text.includes('schemaVersion')&&!text.includes('formVersion'),'ORIGINAL_USER_LABELS');
  await page.locator('summary').filter({hasText:'元の保存情報をコピーする'}).click();const raw=page.getByLabel('元の保存情報',{exact:true});await expect(raw).toHaveJSProperty('readOnly',true);await expect(raw).toHaveValue(JSON.stringify(saved.fields,null,2));
 }
 await test('confirmed-completed-explicit-new-request-preserves-A-and-creates-distinct-B',()=>freshScenario('completed-A-explicit-B',2,async page=>{
  const before=await ownerEffects();await page.goto(app+'/ja/fixture-intake/structured');await consultation(page,'structured','Same legitimate intent; second explicit request');const a=await actualSubmit(page,'相談内容を送信する');
  const aBefore=await effects(a.saved.operationId);check(a.receipt===a.saved.operationId&&aBefore.op.status==='completed'&&aBefore.projects.length===1&&aBefore.notices.length===2,'A_ATOMIC_EFFECTS');
  let capabilityChecks=0;const observe=request=>{if(request.url()===endpoint&&!multipart(request))capabilityChecks++;};page.on('request',observe);
  await page.getByRole('button',{name:'新しい依頼を始める',exact:true}).click();await expect(page.getByLabel(/^お名前/)).toBeEnabled();await expect(page.getByLabel(/^お名前/)).toHaveValue('');await expect(page.getByLabel(/^メールアドレス/)).toHaveValue('');await expect(page.getByLabel(/^ご相談・ご依頼の内容/)).toHaveValue('');check(capabilityChecks>0,'NEW_REQUEST_CHECKS_COMPLETED_CAPABILITY');check(await page.evaluate(k=>sessionStorage.getItem(k),key)===null,'EXPLICIT_CONFIRMED_RELEASES_ACTIVE');page.off('request',observe);
  const history=page.getByRole('complementary',{name:'これまでの受付確認',exact:true});await expect(history).toContainText(a.receipt);await expect(history).toContainText(email);
  await consultation(page,'structured','Same legitimate intent; second explicit request');const b=await actualSubmit(page,'相談内容を送信する');
  check(a.saved.operationId!==b.saved.operationId&&a.saved.requestHash===b.saved.requestHash,'EXPLICIT_NEW_INTENT_SAME_ANSWERS_NEW_ID');
  const [aAfter,bAfter]=await Promise.all([effects(a.saved.operationId),effects(b.saved.operationId)]);check(aAfter.op.status==='completed'&&aAfter.op.project_id===aBefore.op.project_id&&aAfter.projects.length===1&&aAfter.notices.length===2&&bAfter.op.status==='completed'&&bAfter.projects.length===1&&bAfter.notices.length===2&&bAfter.op.project_id!==aBefore.op.project_id,'TWO_PROJECTS_EXACTLY_ONCE');
  check(JSON.stringify(aAfter.notices)===JSON.stringify(aBefore.notices),'A_NOTICES_UNCHANGED');const after=await ownerEffects();check(after.projects===before.projects+2&&after.notices===before.notices+4,'ONLY_TWO_NEW_REQUEST_EFFECTS');await expect(history).toContainText(a.receipt);
  await page.reload();await expect(page.getByText(success,{exact:true})).toBeVisible();await expect(page.getByRole('complementary',{name:'これまでの受付確認',exact:true})).toContainText(a.receipt);check((await savedOperation(page)).operationId===b.saved.operationId,'B_RECEIPT_RELOAD');
 }));
 async function switchAndRecover(page,source,target,markers,fillSource,label){
  const before=await ownerEffects();await page.goto(app+'/ja/fixture-intake/'+source);await fillSource(page);const original=await interruptBeforeBegin(page,label);
  const untouched=await ownerEffects();check(JSON.stringify(before)===JSON.stringify(untouched),'INTERRUPTION_NO_SERVER_EFFECTS');
  await page.goto(app+'/ja/fixture-intake/'+target);await page.reload();await expect(page.getByLabel(/^お名前/)).toBeEnabled();await expect(page.getByRole('button',{name:'入力内容を確認しました',exact:true})).toBeEnabled();
  await originalAnswers(page,original,markers);const failed=await effects(original.operationId);check(failed.op.status==='failed'&&failed.projects.length===0&&failed.notices.length===0,'SWITCH_AUTHORITATIVE_FAILED_NO_EFFECTS');check(await page.evaluate(k=>sessionStorage.getItem(k),key)===null,'ACTIVE_RELEASED_ONLY_AFTER_FAILED');
  await page.reload();await expect(page.getByLabel(/^お名前/)).toBeEnabled();await originalAnswers(page,original,markers);await expect(page.getByRole('button',{name:'入力内容を確認しました',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'入力内容を確認しました',exact:true}).click();await expect(page.getByLabel('保存した入力内容',{exact:true})).toHaveCount(0);await page.reload();await expect(page.getByLabel('保存した入力内容',{exact:true})).toHaveCount(0);
  const corrected='Corrected legitimate request after '+source+' to '+target;await consultation(page,target,corrected);const accepted=await actualSubmit(page,target==='structured'?'相談内容を送信する':'この内容で送信する');
  check(accepted.saved.operationId!==original.operationId,'CORRECTED_NEW_OPERATION');const current=await effects(accepted.saved.operationId);check(current.op.status==='completed'&&current.projects.length===1&&current.notices.length===2,'CORRECTED_ATOMIC_EFFECTS');check(current.notices.every(notice=>JSON.stringify(notice.snapshot).includes(corrected)),'CORRECTED_NOTICE_SNAPSHOT');
  const stillFailed=await effects(original.operationId);check(stillFailed.op.status==='failed'&&stillFailed.projects.length===0&&stillFailed.notices.length===0,'ORIGINAL_FAILURE_PRESERVED');const after=await ownerEffects();check(after.projects===before.projects+1&&after.notices===before.notices+2,'ONLY_CORRECTED_REQUEST_EFFECTS');
 }
 await test('legacy-interrupted-selector-structured-reload-failed-retains-full-original-and-allows-correction',()=>freshScenario('legacy-to-structured',1,page=>switchAndRecover(page,'legacy','structured',['Legacy full original detail','Private deadline original'],async current=>{
  await consultation(current,'legacy','Legacy full original detail\nPrivate deadline original');
 },'この内容で送信する')));
 await test('structured-detailed-interrupted-selector-legacy-reload-failed-retains-full-original-and-allows-correction',()=>freshScenario('structured-to-legacy',1,page=>switchAndRecover(page,'structured','legacy',['Structured full original message','Other original condition','Blue original character','https://reference.phase3a.invalid/original'],async current=>{
  await current.getByRole('radio',{name:'見積もりを希望',exact:true}).check();await current.getByLabel(/^ご相談・ご依頼の内容/).fill('Structured full original message');await current.getByLabel('ご依頼の種類',{exact:true}).selectOption('other');await current.getByLabel(/^ご依頼の種類（その他の内容）/).fill('Other original condition');
  await current.locator('summary').filter({hasText:'キャラクター・イメージの詳細を入力する'}).click();await current.getByLabel('キャラクターの特徴',{exact:true}).fill('Blue original character');
  await current.locator('summary').filter({hasText:/^資料/}).click();await current.getByLabel('参考URL 1',{exact:true}).fill('https://reference.phase3a.invalid/original');await current.getByLabel('このURLの内容（任意）',{exact:true}).fill('Original reference condition');
  await current.getByRole('button',{name:'条件・連絡先へ',exact:true}).click();await current.getByLabel(/^お名前/).fill(name);await current.getByLabel(/^メールアドレス/).fill(email);await current.getByRole('button',{name:'内容を確認する',exact:true}).click();
 },'見積もりを依頼する')));
}
