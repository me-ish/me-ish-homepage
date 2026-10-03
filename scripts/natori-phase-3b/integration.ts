import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
const results:{name:string;status:string;code?:string}[]=[];
const check=(ok:unknown,code:string)=>{if(!ok)throw new Error(code);};
async function test(name:string,fn:()=>Promise<void>){try{await fn();results.push({name,status:'passed'});console.log('PASS phase3b/'+name);}catch(e){const code=e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:'ASSERTION_FAILED';results.push({name,status:'failed',code});console.log('FAIL phase3b/'+name+' '+code);}}
async function main(){
 const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin),'DESTINATION_REJECTED');
 const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8'));
 const direct=globalThis.fetch;let blocked=0;
 globalThis.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(u.origin!==origin){blocked++;throw new Error('DESTINATION_REJECTED');}return direct(input,init);};
 const db=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}}),peer=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}}),anon=createClient(origin,keys.anon,{auth:{persistSession:false}});
 try{
  const user=await db.auth.admin.createUser({email:'owner@phase3b.invalid',password:randomBytes(32).toString('hex'),email_confirm:true});check(user.data.user,'AUTH_FIXTURE');const owner=user.data.user!.id;
  Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,NATORI_OWNER_USER_ID:owner,NATORI_DELIVERY_NOTIFICATION_KEY:randomBytes(32).toString('hex'),NATORI_ORDER_MAIL_FROM:'Fixture <sender@phase3b.invalid>',NATORI_PORTFOLIO_CONTACT_TO:'artist@phase3b.invalid',NATORI_NOTIFICATION_SENDING_ENABLED:'0',NATORI_ACCEPTANCE_OUTBOX_ENABLED:'1',RESEND_API_KEY:'',NEXT_PUBLIC_SITE_URL:'http://localhost:3000'});
  const {consultationOperation,cleanupConsultationOperation,hashConsultationOperation}=await import('../../src/features/natori/server/consultationOperationService');
  const {natoriManagementScope}=await import('../../src/features/natori/server/natoriManagementScope');
  const {consultationOperationSchema,canonicalConsultationOperation}=await import('../../src/features/natori/lib/consultationOperation');
  const {openDeliveryNotification,sealDeliveryNotification}=await import('../../src/features/natori/server/deliveryNotificationPayload');
  const {getClientConsultation,retryStaffConsultationNotification}=await import('../../src/features/natori/server/consultationService');
  const scoped=<T>(fn:()=>Promise<T>)=>natoriManagementScope.run({ownerId:owner,operator:{kind:'auth-user',userId:owner}},fn);
  async function setup(){const p=await db.from('natori_projects').insert({user_id:owner,title:'Consultation fixture',client_name:'Synthetic',client_email:'client@phase3b.invalid',type:'illustration',status:'inquiry',request_data:{message:'Original request'}}).select('id').single();check(p.data&&!p.error,'PROJECT');const token=randomBytes(32).toString('base64url'),accessHash=createHash('sha256').update(token).digest('hex');check(!(await db.from('natori_consultation_access').insert({project_id:p.data!.id,token_hash:accessHash,expires_at:new Date(Date.now()+86400000).toISOString()})).error,'ACCESS');return{id:p.data!.id,token,accessHash};}
  type Input=Awaited<ReturnType<typeof setup>>;
  const bytes=Buffer.from('synthetic PNG bytes');
  function request(body='Fixture',withFile=true){const r={operationId:randomUUID(),requestHash:'',body,files:withFile?[{id:randomUUID(),fileName:'fixture.png',mimeType:'image/png',sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]:[]};r.requestHash=hashConsultationOperation(r);return r;}
  type Request=ReturnType<typeof request>;
  const run=(i:Input,r:Request,action:'prepare'|'commit'|'lookup'|'cancel',staff=false)=>staff?scoped(()=>consultationOperation({projectId:i.id},r,action)):consultationOperation({token:i.token},r,action);
  async function upload(i:Input,r:Request,staff=false){const result=await run(i,r,'prepare',staff);check(result.kind==='prepared','PREPARED');if(result.kind!=='prepared')throw new Error('PREPARED');for(const f of result.files){check(f.uploadToken,'UPLOAD_TOKEN');const sent=await db.storage.from('natori-consultations').uploadToSignedUrl(f.path,f.uploadToken!,bytes,{contentType:'image/png'});check(!sent.error,'STORAGE_UPLOAD');}return result;}
  async function facts(i:Input){const tables=['natori_consultation_messages','natori_consultation_files','natori_consultation_uploads','natori_notification_jobs','natori_consultation_access'];const rows=await Promise.all(tables.map(table=>db.from(table).select('*').eq('project_id',i.id)));check(rows.every(row=>!row.error),'FACT_READ');return rows.map(row=>row.data??[]);}
  async function noticeOperation(i:Input,r:Request,staff=false){
   const row=await db.from('natori_consultation_operations').select('*').eq('project_id',i.id).eq('sender',staff?'staff':'client').eq('operation_id',r.operationId).single();
   check(!row.error&&row.data,'NOTICE_OPERATION_READ');return row.data!;
  }
  async function expireFrozenNotice(i:Input,r:Request,staff:boolean,deadline:string,historical=false){
   const before=await noticeOperation(i,r,staff);
   // This disposable-only setup re-seals the original, still-valid synthetic plaintext
   // with a historical/short deadline. It does not bypass expiry or alter product code.
   const original=openDeliveryNotification(before.notice_payload);
   check(!(await db.from('natori_consultation_operations').update({notice_payload:sealDeliveryNotification(original,deadline),...(staff?{access_expires_at:deadline}:{}),...(historical?{created_at:new Date(Date.now()-31*86400000).toISOString()}:{} )}).eq('project_id',i.id).eq('sender',staff?'staff':'client').eq('operation_id',r.operationId)).error,'FROZEN_NOTICE_DEADLINE_FIXTURE');
   const after=await noticeOperation(i,r,staff);
   check(after.project_id===before.project_id&&after.sender===before.sender&&after.operation_id===before.operation_id&&after.request_hash===before.request_hash&&after.body===before.body&&JSON.stringify(after.manifest)===JSON.stringify(before.manifest)&&after.access_hash===before.access_hash,'NOTICE_ORIGINAL_IDENTITY_PRESERVED');
   return after;
  }
  async function noticeCounts(i:Input){
   const read=await db.rpc('natori_consultation_overview_v1',{p_owner_id:owner,p_project_ids:[i.id]});
   check(!read.error&&Array.isArray(read.data)&&read.data.length===1,'OVERVIEW_COUNT_READ');
   const row=read.data![0] as {project_id:string;notification_failed:number;notification_pending:number};
   check(row.project_id===i.id&&Number.isInteger(row.notification_failed)&&Number.isInteger(row.notification_pending),'OVERVIEW_COUNT_SCOPE');
   return row;
  }
  async function rpc(i:Input,r:Request,command:string,claim:string|null=null,input:Record<string,unknown>={},sender='client',client=db){const v=await client.rpc('natori_consultation_operation_v1',{p_project_id:i.id,p_sender:sender,p_operation_id:r.operationId,p_request_hash:r.requestHash,p_command:command,p_owner_id:sender==='staff'?owner:null,p_access_hash:sender==='client'?i.accessHash:null,p_claim_token:claim,p_input:input});check(!v.error,'RPC_'+command.toUpperCase());return v.data;}
  await test('anon-cannot-read-write-or-execute-operations',async()=>{
   const i=await setup(),r=request();
   check((await anon.rpc('natori_consultation_operation_v1',{p_project_id:i.id,p_sender:'client',p_operation_id:r.operationId,p_request_hash:r.requestHash,p_command:'cancel',p_access_hash:i.accessHash})).error,'RPC_DENIED');
   const read=await anon.from('natori_consultation_operations').select('*');check(read.error||read.data?.length===0,'ROW_DENIED');
   const stranger=await db.auth.admin.createUser({email:'stranger@phase3b.invalid',password:randomBytes(32).toString('hex'),email_confirm:true});
   check(stranger.data.user&&!stranger.error&&stranger.data.user.id!==owner,'STRANGER_AUTH_FIXTURE');
   const strangerId=stranger.data.user!.id,foreign=await setup();
   check(foreign.id!==i.id&&foreign.accessHash!==i.accessHash,'FOREIGN_ACCESS_FIXTURE');
   const clientReceipt=request('Authorization client receipt',false),staffReceipt=request('Authorization staff receipt',false);
   for(const fixture of [{receipt:clientReceipt,staff:false},{receipt:staffReceipt,staff:true}]){
    const prepared=await run(i,fixture.receipt,'prepare',fixture.staff);
    check(prepared.kind==='prepared'&&prepared.files.length===0,'AUTH_TEXT_ONLY_PREPARED');
    check((await run(i,fixture.receipt,'commit',fixture.staff)).kind==='committed','AUTH_TERMINAL_FIXTURE');
   }
   async function namespace(project:Input){
    const tables=['natori_consultation_messages','natori_consultation_files','natori_consultation_uploads','natori_consultation_operations','natori_notification_jobs','natori_consultation_access','natori_project_tasks'];
    const rows=await Promise.all([...tables.map(table=>db.from(table).select('*').eq('project_id',project.id)),db.from('natori_projects').select('*').eq('id',project.id)]);
    check(rows.every(row=>!row.error),'AUTH_NAMESPACE_READ');
    return JSON.stringify(rows.map(row=>(row.data??[]).map((value:unknown)=>JSON.stringify(value)).sort()));
   }
   const targetBefore=await namespace(i),foreignBefore=await namespace(foreign);
   async function refused(sender:'staff'|'client',receipt:Request,command:'cancel'|'lookup',ownerId:string|null,accessHash:string|null,code:string){
    const denied=await db.rpc('natori_consultation_operation_v1',{p_project_id:i.id,p_sender:sender,p_operation_id:receipt.operationId,p_request_hash:receipt.requestHash,p_command:command,p_owner_id:ownerId,p_access_hash:accessHash,p_claim_token:null,p_input:{}});
    check(!denied.error,'AUTH_RPC_EXECUTABLE');
    check(JSON.stringify(denied.data)===JSON.stringify({result:'not_found'}),code+'_REFUSED');
    check(await namespace(i)===targetBefore&&await namespace(foreign)===foreignBefore,code+'_NAMESPACES_PRESERVED');
   }
   await refused('staff',r,'cancel',strangerId,null,'WRONG_OWNER_CANCEL');
   await refused('staff',staffReceipt,'lookup',strangerId,null,'WRONG_OWNER_RECEIPT');
   await refused('client',r,'cancel',null,foreign.accessHash,'CROSS_TOKEN_CANCEL');
   await refused('client',clientReceipt,'lookup',null,foreign.accessHash,'CROSS_TOKEN_RECEIPT');
  });
  for(const staff of [false,true])for(const shape of ['text','file','combined'])await test((staff?'staff':'client')+'-'+shape+'-atomic-one-message-one-notice',async()=>{const i=await setup(),r=request(shape==='file'?'':'Unified body',shape!=='text');await upload(i,r,staff);const done=await run(i,r,'commit',staff);check(done.kind==='committed','COMMITTED');const [messages,files,reservations,notices,access]=await facts(i);check(messages.length===1&&messages[0].id===(done.kind==='committed'?done.messageId:null)&&messages[0].attachment_count===r.files.length,'ONE_MESSAGE');check(files.length===r.files.length&&reservations.every(row=>row.finalized_at&&row.message_id===messages[0].id),'ATOMIC_FILES');check(notices.length===1&&notices[0].payload.format==='natori-delivery-aes256gcm-v1'&&!JSON.stringify(notices).includes('client@'),'ONE_ENCRYPTED_NOTICE');check(access.length===(staff?2:1),'ONE_NEW_ACCESS_ONLY_STAFF');
   const pending=await noticeCounts(i);check(pending.notification_pending===1&&pending.notification_failed===0,'ONE_LINKED_PENDING_NOTICE');
   if(shape==='text'){
    const aged=await setup(),original=request('Original body after 31-day interruption',true);await upload(aged,original,staff);
    const oldDeadline=new Date(Date.now()-86400000).toISOString();
    const frozen=await expireFrozenNotice(aged,original,staff,oldDeadline,true),beforeFacts=await facts(aged);
    check(Date.now()-Date.parse(frozen.created_at)>30*86400000&&Date.parse(frozen.notice_payload.expiresAt)<Date.now()&&(!staff?frozen.access_hash===null:Date.parse(frozen.access_expires_at)<Date.now()),'NOTICE_31_DAY_INTERRUPTION_FIXTURE');
    for(const action of ['lookup','prepare','commit'] as const)check((await run(aged,original,action,staff)).kind==='notice_expired','NOTICE_31_DAY_'+action.toUpperCase()+'_REFUSED');
    check((await rpc(aged,original,'claim',randomUUID(),{},staff?'staff':'client')).result==='notice_expired','NOTICE_EXPIRED_CLAIM_REFUSED');
    check(JSON.stringify(await noticeOperation(aged,original,staff))===JSON.stringify(frozen)&&JSON.stringify(await facts(aged))===JSON.stringify(beforeFacts),'NOTICE_EXPIRED_NO_BUSINESS_OR_IDENTITY_WRITE');
    const claim=randomUUID();check(!(await db.from('natori_consultation_operations').update({status:'verifying',claim_token:claim,lease_expires_at:new Date(Date.now()+180000).toISOString()}).eq('project_id',aged.id)).error,'NOTICE_EXISTING_VERIFIER_FIXTURE');
    check((await rpc(aged,original,'renew',claim,{},staff?'staff':'client')).result==='notice_expired','NOTICE_EXPIRED_RENEW_REFUSED');
    check((await rpc(aged,original,'release',claim,{},staff?'staff':'client')).result==='reserved','NOTICE_EXPIRED_MATCHING_RELEASE_ALLOWED');
    check((await run(aged,original,'cancel',staff)).kind==='cancelled','NOTICE_EXPIRED_CONFIRMED_CANCEL_ALLOWED');
    const cancelled=await noticeOperation(aged,original,staff);
    // JSONB preserves every field and array item, but its object-key order differs
    // from the submitted JS descriptors. Check the strict original semantics and
    // independently require the stored frozen manifest/snapshot to remain exact.
    const cancelledInput=consultationOperationSchema.safeParse({operationId:cancelled.operation_id,requestHash:cancelled.request_hash,body:cancelled.body,files:cancelled.manifest});
    check(cancelledInput.success&&cancelledInput.data.operationId===original.operationId&&cancelledInput.data.requestHash===original.requestHash&&canonicalConsultationOperation(cancelledInput.data)===canonicalConsultationOperation(original)&&hashConsultationOperation(cancelledInput.data)===original.requestHash,'NOTICE_CANCEL_ORIGINAL_SEMANTIC_INPUT');
    check(cancelled.status==='cancelled'&&cancelled.body===original.body&&cancelled.request_hash===original.requestHash&&JSON.stringify(cancelled.manifest)===JSON.stringify(frozen.manifest)&&JSON.stringify(cancelled.notice_payload)===JSON.stringify(frozen.notice_payload),'NOTICE_CANCEL_RETAINS_FROZEN_ORIGINAL');
    const fresh={...original,operationId:randomUUID()};check(fresh.operationId!==original.operationId&&fresh.requestHash===original.requestHash,'NOTICE_EXPLICIT_NEW_OPERATION_SAME_CONTENT');await upload(aged,fresh,staff);
    const resumed=await run(aged,fresh,'commit',staff),after=await facts(aged);check(resumed.kind==='committed'&&after[0].length===1&&after[0][0].body===original.body&&after[1].length===original.files.length&&after[3].length===1,'NOTICE_CONFIRMED_CANCEL_THEN_NEW_OPERATION_COMMITTED_ONCE');
    check((await run(aged,original,'prepare',staff)).kind==='cancelled','NOTICE_OLD_EXPIRED_OPERATION_STAYS_CANCELLED');
    // A committed receipt is authoritative even if its admitted snapshot later expires.
    await expireFrozenNotice(i,r,staff,oldDeadline,true);const replay=await run(i,r,'prepare',staff);
    check(replay.kind==='committed'&&done.kind==='committed'&&replay.messageId===done.messageId&&replay.notificationId===done.notificationId&&replay.operationId===r.operationId&&replay.requestHash===r.requestHash,'NOTICE_EXPIRED_COMMITTED_RECEIPT_REPLAY_UNCHANGED');
   }
   if(!staff&&shape==='text'){
    const legacy=await setup();
    const legacyMessage=await db.from('natori_consultation_messages').insert({project_id:legacy.id,sender:'staff',body:'Synthetic pre-operation legacy notice'}).select('id').single();
    check(!legacyMessage.error&&legacyMessage.data,'UNLINKED_LEGACY_COUNT_FIXTURE');
    const oldOnly=await noticeCounts(legacy);check(oldOnly.notification_pending===1&&oldOnly.notification_failed===0,'UNLINKED_LEGACY_NOTICE_RETAINED');
    const oldJob=await db.from('natori_notification_jobs').insert({project_id:legacy.id,notification_key:'phase3b-old-purpose/'+legacy.id,purpose:'quote_accept_artist',snapshot:{synthetic:true}}).select('id').single();
    check(!oldJob.error&&oldJob.data,'PRIOR_PURPOSE_COUNT_FIXTURE');
    const oldBoth=await noticeCounts(legacy);check(oldBoth.notification_pending===2&&oldBoth.notification_failed===0,'LEGACY_AND_PRIOR_PURPOSE_DISTINCT_NOTICES');
    check(!(await db.from('natori_notification_jobs').update({status:'failed',error_code:'synthetic'}).eq('id',notices[0].id)).error,'LINKED_NOTICE_FAILED_FIXTURE');
    const failed=await noticeCounts(i);check(failed.notification_failed===1&&failed.notification_pending===0,'ONE_LINKED_FAILED_NOTICE');
    const preserved=await facts(legacy);check(preserved[0].length===1&&preserved[0][0].id===legacyMessage.data!.id&&preserved[0][0].notification_id===null&&preserved[0][0].body==='Synthetic pre-operation legacy notice'&&preserved[3].length===1&&preserved[3][0].purpose==='quote_accept_artist','LEGACY_NOTIFICATION_FACTS_PRESERVED');
   }
  });
  await test('concurrent-exact-finalization-replays-original-receipt',async()=>{const i=await setup(),r=request();await upload(i,r);const done=await Promise.all([run(i,r,'commit'),run(i,r,'commit')]);const saved=done.find(row=>row.kind==='committed');check(saved?.kind==='committed','ONE_COMMIT');const replay=await run(i,r,'lookup');check(replay.kind==='committed'&&saved?.kind==='committed'&&replay.messageId===saved.messageId,'ORIGINAL_RECEIPT');const [m,f,u,n]=await facts(i);check(m.length===1&&f.length===1&&u.length===1&&n.length===1,'EXACTLY_ONCE');});
  await test('lost-commit-response-reload-uses-same-message-and-notice',async()=>{const i=await setup(),r=request();await upload(i,r);const saved=await run(i,r,'commit');const replay=await run(i,r,'prepare');check(saved.kind==='committed'&&replay.kind==='committed'&&saved.messageId===replay.messageId,'RECEIPT_REPLAY');check((await facts(i))[0].length===1&&(await facts(i))[3].length===1,'NO_REPEAT');});
  await test('same-text-new-operation-is-a-deliberate-new-message',async()=>{const i=await setup(),a=request('same',false),b=request('same',false);await upload(i,a);await run(i,a,'commit');await upload(i,b);await run(i,b,'commit');check((await facts(i))[0].length===2&&(await facts(i))[3].length===2,'DELIBERATE_REPEAT_ALLOWED');});
  await test('changed-body-cannot-reuse-frozen-operation',async()=>{const i=await setup(),r=request();await upload(i,r);const changed={...r,body:'Changed'};changed.requestHash=hashConsultationOperation(changed);check((await run(i,changed,'prepare')).kind==='conflict','IMMUTABLE_OPERATION');check((await facts(i))[0].length===0,'NOT_COMMITTED');});
  await test('cancel-tombstone-fences-delayed-reserve',async()=>{const i=await setup(),r=request();check((await run(i,r,'cancel')).kind==='cancelled','CANCELLED');check((await run(i,r,'prepare')).kind==='cancelled','DELAYED_RESERVE_FENCED');const [m,f,u,n]=await facts(i);check(m.length+f.length+u.length+n.length===0,'NO_SIDE_EFFECT');});
  await test('missing-object-and-hash-mismatch-do-not-finalize-or-notify',async()=>{const i=await setup(),r=request();const prep=await run(i,r,'prepare');check(prep.kind==='prepared','PREPARED');check((await run(i,r,'commit')).kind==='storage_error','MISSING_REFUSED');if(prep.kind==='prepared'){await db.storage.from('natori-consultations').uploadToSignedUrl(prep.files[0].path,prep.files[0].uploadToken!,Buffer.alloc(bytes.length,1),{contentType:'image/png'});}check((await run(i,r,'commit')).kind==='storage_error','HASH_REFUSED');const [m,f,,n]=await facts(i);check(m.length+f.length+n.length===0,'NO_PARTIAL_COMMIT');});
  await test('notification-insert-conflict-rolls-back-message-and-files',async()=>{const i=await setup(),r=request();await upload(i,r);check(!(await db.from('natori_notification_jobs').insert({project_id:i.id,notification_key:'consultation/'+i.id+'/client/'+r.operationId,purpose:'consultation_staff',snapshot:{syntheticCollision:true},payload:{synthetic:true}})).error,'SYNTHETIC_CONFLICT');check((await run(i,r,'commit')).kind==='unavailable','COMMIT_ROLLBACK');const [m,f,u,n]=await facts(i);check(m.length===0&&f.length===0&&u.every(row=>!row.finalized_at&&!row.message_id)&&n.length===1,'ATOMIC_ROLLBACK');});
  await test('superseded-and-expired-verifiers-cannot-commit',async()=>{const i=await setup(),r=request();await upload(i,r);const a=randomUUID(),b=randomUUID();check((await rpc(i,r,'claim',a)).result==='claimed','CLAIM');check(!(await db.from('natori_consultation_operations').update({lease_expires_at:new Date(Date.now()-1000).toISOString()}).eq('project_id',i.id)).error,'EXPIRE');check((await rpc(i,r,'claim',b,{},'client',peer)).result==='claimed','RECLAIM');check((await rpc(i,r,'commit',a,{verified:true})).result==='stale','STALE_WORKER');check((await facts(i))[0].length===0,'NO_STALE_MESSAGE');});
  const hold=async(i:Input)=>{const active=Promise.resolve(peer.rpc('phase3b_hold_project_v1',{p_project:i.id}));let acquired=false;for(let n=0;n<100;n++){const probe=await db.rpc('phase3b_project_is_held_v1',{p_project:i.id});check(!probe.error,'HOLD_PROBE');if(probe.data===true){acquired=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}check(acquired,'HOLD_ACQUIRED');return{active};};
  await test('client-access-expiring-during-project-lock-wait-is-rejected',async()=>{const i=await setup(),r=request('wait',false);const expires=new Date(Date.now()+1000).toISOString();check(!(await db.from('natori_consultation_access').update({expires_at:expires}).eq('project_id',i.id)).error,'SHORT_ACCESS');const h=await hold(i);check(Date.now()<Date.parse(expires),'START_BEFORE_EXPIRY');const waiting=rpc(i,r,'cancel');await h.active;check((await waiting).result==='not_found','ACCESS_POST_LOCK');check((await facts(i))[0].length===0,'NO_EXPIRED_ACCESS_WRITE');});
  await test('claim-expiring-during-project-lock-wait-is-fenced',async()=>{const i=await setup(),r=request();await upload(i,r);const token=randomUUID();await rpc(i,r,'claim',token);const expires=new Date(Date.now()+1000).toISOString();check(!(await db.from('natori_consultation_operations').update({lease_expires_at:expires}).eq('project_id',i.id)).error,'SHORT_CLAIM');const h=await hold(i);check(Date.now()<Date.parse(expires),'START_BEFORE_EXPIRY');const waiting=rpc(i,r,'commit',token,{verified:true});await h.active;check((await waiting).result==='stale','CLAIM_POST_LOCK');check((await facts(i))[0].length===0,'NO_EXPIRED_CLAIM_WRITE');
   const notice=await setup(),noticeRequest=request('Notice project-lock wait',false);await upload(notice,noticeRequest,true);const noticeClaim=randomUUID();check((await rpc(notice,noticeRequest,'claim',noticeClaim,{},'staff')).result==='claimed','NOTICE_WAIT_CLAIM');
   const deadline=new Date(Date.now()+1000).toISOString();await expireFrozenNotice(notice,noticeRequest,true,deadline);const held=await hold(notice);check(Date.now()<Date.parse(deadline),'NOTICE_WAIT_BEFORE_EXPIRY');
   const waitingNotice=rpc(notice,noticeRequest,'commit',noticeClaim,{verified:true},'staff');await held.active;check((await waitingNotice).result==='notice_expired','NOTICE_POST_LOCK_EXPIRED_REFUSED');
   const noticeFacts=await facts(notice);check(noticeFacts[0].length+noticeFacts[1].length+noticeFacts[3].length===0&&noticeFacts[4].length===1,'NOTICE_POST_LOCK_NO_BUSINESS_WRITE');
   check((await rpc(notice,noticeRequest,'release',noticeClaim,{},'staff')).result==='reserved'&&(await run(notice,noticeRequest,'cancel',true)).kind==='cancelled','NOTICE_POST_LOCK_CURRENT_RELEASE_THEN_CANCEL');
  });
  await test('issued-credential-retention-and-committed-reference-protection',async()=>{const i=await setup(),r=request(),prepared=await upload(i,r);await run(i,r,'cancel');
   // Test-only deadline override cannot prove admitted provider writes ended; issued evidence blocks cleanup permanently.
   check(!await cleanupConsultationOperation({token:i.token},r),'SIGNED_CREDENTIAL_PROTECTED');check(!(await db.from('natori_consultation_operations').update({signed_expires_at:new Date(Date.now()-1000).toISOString(),lease_expires_at:null}).eq('project_id',i.id)).error,'CREDENTIAL_EXPIRED');check(!await cleanupConsultationOperation({token:i.token},r),'ISSUED_REQUIRES_PROVIDER_QUIESCENCE');check(!(await db.storage.from('natori-consultations').info(prepared.files[0].path)).error,'ISSUED_OBJECT_RETAINED');check((await facts(i))[2].length===1,'RESERVATION_EVIDENCE_RETAINED');const saved=await setup(),s=request();await upload(saved,s);await run(saved,s,'commit');check(!await cleanupConsultationOperation({token:saved.token},s),'COMMITTED_PROTECTED');check((await facts(saved))[1].length===1,'COMMITTED_REFERENCE_RETAINED');});
  await test('mail-retry-alone-does-not-add-message-file-or-access',async()=>{const i=await setup(),r=request();await upload(i,r,true);const committed=await run(i,r,'commit',true);check(committed.kind==='committed','STAFF_COMMITTED');if(committed.kind!=='committed')return;check(!(await db.from('natori_notification_jobs').update({status:'failed',error_code:'synthetic'}).eq('id',committed.notificationId)).error,'MAIL_FAILED');const before=await facts(i);const failed=await noticeCounts(i);check(failed.notification_failed===1&&failed.notification_pending===0,'RETRY_PRIOR_FAILED_COUNT_ONCE');
   // The real service deliberately refuses retry while sending is disabled. Keep that kill switch intact.
   const disabled=await scoped(()=>retryStaffConsultationNotification(i.id,committed.messageId));
   check(disabled==='notification-failed','DISABLED_RETRY_REFUSED');
   const disabledFacts=await facts(i);check(JSON.stringify(disabledFacts)===JSON.stringify(before),'DISABLED_RETRY_FACTS_UNCHANGED');
   // Exercise the real owner-scoped DB retry transaction separately; no dispatcher or provider call is enabled.
   const retry=await db.rpc('natori_notification_retry_v1',{p_id:committed.notificationId,p_owner_id:owner});
   check(!retry.error&&typeof retry.data==='string'&&retry.data!==committed.notificationId,'RETRY_NEW_ATTEMPT_ACK');
   const after=await facts(i);check(after[0].length===before[0].length&&after[1].length===before[1].length&&after[2].length===before[2].length&&after[4].length===before[4].length,'RETRY_NOTICE_ONLY');const latest=await noticeCounts(i);check(latest.notification_pending===1&&latest.notification_failed===0,'LATEST_RETRY_NOTICE_AUTHORITATIVE');
   const queued=after[3].find(row=>row.id===retry.data);const original=before[3].find(row=>row.id===committed.notificationId);
   check(after[3].length===before[3].length+1&&queued&&original&&queued.notification_key===original.notification_key&&queued.attempt_no===original.attempt_no+1&&queued.status==='pending'&&JSON.stringify(queued.snapshot)===JSON.stringify(original.snapshot)&&JSON.stringify(queued.payload)===JSON.stringify(original.payload),'RETRY_FROZEN_NOTICE_IDENTITY');
   check(after[0][0].notification_status==='pending'&&after[0][0].notification_id===committed.notificationId,'QUEUED_RETRY_MESSAGE_PENDING_ORIGINAL_ID');
   const transition=async(id:string,status:'sending'|'unknown'|'sent'|'failed')=>check(!(await db.from('natori_notification_jobs').update({status,...(status==='sending'?{claim_token:randomUUID(),lease_expires_at:new Date(Date.now()+60000).toISOString()}:{}),...(status==='sent'?{provider_id:'phase3b-synthetic-notice',sent_at:new Date().toISOString()}:{}),...(status==='failed'?{error_code:'synthetic-late-failure'}:{})}).eq('id',id)).error,'NOTICE_TRANSITION_ACK');
   await transition(committed.notificationId,'failed');const queuedCounts=await noticeCounts(i);check((await facts(i))[0][0].notification_status==='pending'&&queuedCounts.notification_pending===1&&queuedCounts.notification_failed===0,'OLDER_FAILURE_CANNOT_OVERRIDE_LATEST_PENDING');
   await transition(retry.data!,'sending');check((await facts(i))[0][0].notification_status==='pending','SENDING_RETRY_MESSAGE_PENDING');
   await transition(retry.data!,'unknown');const unknownFacts=await facts(i),unknownCounts=await noticeCounts(i);check(unknownFacts[0][0].notification_status==='failed'&&unknownCounts.notification_failed===1&&unknownCounts.notification_pending===0,'UNKNOWN_RETRY_REMAINS_FAILED_REVIEW');
   await transition(retry.data!,'sent');const sentFacts=await facts(i),sentCounts=await noticeCounts(i);check(sentFacts[0][0].notification_status==='sent'&&sentCounts.notification_failed===0&&sentCounts.notification_pending===0,'LATEST_SENT_MESSAGE_AND_OVERVIEW_AGREE');
   await transition(committed.notificationId,'sent');const lateFacts=await facts(i),lateCounts=await noticeCounts(i);check(lateFacts[0][0].notification_status==='sent'&&lateCounts.notification_failed===0&&lateCounts.notification_pending===0,'OLDER_SENT_CANNOT_OVERRIDE_LATEST_SENT');
   check(lateFacts[0].length===before[0].length&&lateFacts[1].length===before[1].length&&lateFacts[2].length===before[2].length&&lateFacts[4].length===before[4].length&&lateFacts[0][0].body===before[0][0].body&&lateFacts[0][0].notification_id===committed.notificationId,'RETRY_TRANSITIONS_PRESERVE_BUSINESS_FACTS');
   // Two real PostgREST sessions: an older sent callback has reached the held
   // message row before a later queued retry commits. The fixture records that wait.
   const race=await setup(),raceRequest=request('Notice projection race',false);await upload(race,raceRequest,true);const raceDone=await run(race,raceRequest,'commit',true);
   check(raceDone.kind==='committed','RACE_STAFF_COMMITTED');if(raceDone.kind!=='committed')return;
   check(!(await db.from('natori_notification_jobs').update({status:'failed',error_code:'synthetic'}).eq('id',raceDone.notificationId)).error,'RACE_PRIOR_FAILED');
   const racingBefore=await facts(race);
   const held=Promise.resolve(peer.rpc('phase3b_hold_message_then_queue_v1',{p_project:race.id,p_message:raceDone.messageId,p_notice:raceDone.notificationId,p_owner:owner}));
   let messageHeld=false;for(let n=0;n<100;n++){const probe=await db.rpc('phase3b_message_is_held_v1',{p_project:race.id});check(!probe.error,'RACE_MESSAGE_HOLD_PROBE');if(probe.data===true){messageHeld=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}check(messageHeld,'RACE_MESSAGE_HELD');
   const older=Promise.resolve(db.rpc('phase3b_late_notice_callback_v1',{p_project:race.id,p_message:raceDone.messageId,p_notice:raceDone.notificationId,p_owner:owner}));
   const [released,oldCallback]=await Promise.all([held,older]);check(!released.error&&released.data?.blocked===true&&typeof released.data?.queuedId==='string'&&!oldCallback.error&&oldCallback.data===true,'RACE_OLDER_CALLBACK_OBSERVED_BLOCKED');
   const racingAfter=await facts(race),racingCounts=await noticeCounts(race);check(racingAfter[0][0].notification_status==='pending'&&racingCounts.notification_pending===1&&racingCounts.notification_failed===0,'RACE_FRESH_LATEST_PROJECTION');
   const racingQueued=racingAfter[3].find(row=>row.id===released.data!.queuedId),racingOld=racingBefore[3].find(row=>row.id===raceDone.notificationId);
   check(racingQueued&&racingOld&&racingQueued.attempt_no===racingOld.attempt_no+1&&racingQueued.notification_key===racingOld.notification_key&&JSON.stringify(racingQueued.snapshot)===JSON.stringify(racingOld.snapshot)&&JSON.stringify(racingQueued.payload)===JSON.stringify(racingOld.payload),'RACE_FROZEN_RETRY_IDENTITY');
   check(racingAfter[0].length===racingBefore[0].length&&racingAfter[1].length===racingBefore[1].length&&racingAfter[2].length===racingBefore[2].length&&racingAfter[4].length===racingBefore[4].length&&racingAfter[0][0].notification_id===raceDone.notificationId&&racingAfter[0][0].body===racingBefore[0][0].body,'RACE_RECEIPT_AND_BUSINESS_FACTS_PRESERVED');
  });
  await test('submitted-file-url-failure-retains-existence-and-initial-request',async()=>{const i=await setup(),r=request();await upload(i,r);await run(i,r,'commit');const beforeFetch=globalThis.fetch;globalThis.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(u.pathname.includes('/storage/v1/object/sign/'))return new Response('{}',{status:503});return beforeFetch(input,init);};try{const view=await getClientConsultation(i.token);check(view?.initialInquiry==='Original request'&&view.messages[0].files.length===1&&view.messages[0].files[0].url===null&&view.messages[0].files[0].exists===true,'SUBMISSION_EVIDENCE');}finally{globalThis.fetch=beforeFetch;}});
  async function reserveIssuer(i:Input,r:Request){
   const row=await rpc(i,r,'reserve',null,{body:r.body,files:r.files,noticePayload:{synthetic:true,expiresAt:new Date(Date.now()+30*86400000).toISOString()}});
   check(row.result==='reserved'&&row.files?.length===1,'ISSUER_RESERVE');return row.files[0].path as string;
  }
  function issuedExpiry(token:string){
   const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8')) as {exp?:unknown};
   check(typeof payload.exp==='number'&&Number.isSafeInteger(payload.exp),'TOKEN_EXPIRY');return new Date(Number(payload.exp)*1000).toISOString();
  }
  async function expiredRecordedDeadline(i:Input){check(!(await db.from('natori_consultation_operations').update({signed_expires_at:new Date(Date.now()-1000).toISOString(),lease_expires_at:null}).eq('project_id',i.id)).error,'OLD_RECORDED_DEADLINE');}
  await test('pending-issuer-survives-cancel-and-blocks-cleanup-with-old-deadline',async()=>{
   const i=await setup(),r=request(),path=await reserveIssuer(i,r),issuer=randomUUID();
   check((await rpc(i,r,'credential_begin',issuer,{fileId:r.files[0].id})).result==='credential_started','ISSUER_BEGUN');
   check((await rpc(i,r,'cancel',null,{},'client',peer)).result==='cancelled','PEER_CANCEL');await expiredRecordedDeadline(i);
   check(!await cleanupConsultationOperation({token:i.token},r),'UNKNOWN_ISSUER_PROTECTED');
   const rows=(await facts(i))[2];check(rows[0].credential_issuer===issuer&&rows[0].storage_path===path,'ISSUER_EVIDENCE_RETAINED');
  });
  await test('competing-prepare-and-losing-issuer-cannot-replace-pending-credential',async()=>{
   const i=await setup(),r=request();await reserveIssuer(i,r);const a=randomUUID(),b=randomUUID();
   check((await rpc(i,r,'credential_begin',a,{fileId:r.files[0].id})).result==='credential_started','FIRST_ISSUER');
   check((await rpc(i,r,'reserve',null,{body:r.body,files:r.files},'client',peer)).result==='reserved','EXACT_RESERVE_REPLAY');
   check((await rpc(i,r,'credential_begin',b,{fileId:r.files[0].id},'client',peer)).result==='busy','SECOND_ISSUER_FENCED');
   const expiresAt=new Date(Date.now()+7200000).toISOString();
   check((await rpc(i,r,'credential_finish',b,{fileId:r.files[0].id,expiresAt},'client',peer)).result==='stale','LOSING_REGISTRATION');
   check((await facts(i))[2][0].credential_issuer===a,'FIRST_NONCE_NOT_LOST');
   check((await rpc(i,r,'claim',randomUUID())).result==='busy','COMMIT_WAIT_ISSUER');
   check((await rpc(i,r,'credential_finish',a,{fileId:r.files[0].id,expiresAt})).result==='credential_registered','MATCHING_REGISTRATION');
   const before=await db.from('natori_consultation_operations').select('signed_expires_at').eq('project_id',i.id).single();check(!before.error,'DEADLINE_READ');
   const c=randomUUID();check((await rpc(i,r,'credential_begin',c,{fileId:r.files[0].id})).result==='credential_started','LATER_ISSUER');
   check((await rpc(i,r,'credential_finish',c,{fileId:r.files[0].id,expiresAt:new Date(Date.now()+60000).toISOString()})).result==='credential_registered','SHORTER_REGISTERED');
   const after=await db.from('natori_consultation_operations').select('signed_expires_at').eq('project_id',i.id).single();check(!after.error&&after.data!.signed_expires_at===before.data!.signed_expires_at,'EXPIRY_MONOTONIC');
  });
  await test('late-issued-real-token-after-cancel-registers-expiry-and-cannot-follow-cleanup',async()=>{
   const i=await setup(),r=request(),path=await reserveIssuer(i,r),issuer=randomUUID();
   check((await rpc(i,r,'credential_begin',issuer,{fileId:r.files[0].id})).result==='credential_started','ISSUER');
   check((await rpc(i,r,'cancel',null,{},'client',peer)).result==='cancelled','CANCEL');await expiredRecordedDeadline(i);
   check(!await cleanupConsultationOperation({token:i.token},r),'DELAYED_ISSUER_PROTECTED');
   const signed=await db.storage.from('natori-consultations').createSignedUploadUrl(path,{upsert:false});check(!signed.error&&signed.data,'REAL_TOKEN');
   const expiresAt=issuedExpiry(signed.data!.token),registered=await rpc(i,r,'credential_finish',issuer,{fileId:r.files[0].id,expiresAt});
   check(registered.result==='credential_registered'&&registered.expose===false,'CANCELLED_NOT_EXPOSED');
   const stored=await db.from('natori_consultation_operations').select('signed_expires_at').eq('project_id',i.id).single();check(!stored.error&&Date.parse(stored.data!.signed_expires_at!)>=Date.parse(expiresAt)+300000,'ACTUAL_EXPIRY_MARGIN');
   check(!await cleanupConsultationOperation({token:i.token},r),'LATE_TOKEN_PROTECTED');
   check(!(await db.storage.from('natori-consultations').uploadToSignedUrl(path,signed.data!.token,bytes,{contentType:'image/png'})).error,'LATE_VALID_UPLOAD');
   check(!await cleanupConsultationOperation({token:i.token},r),'LATE_OBJECT_NOT_REMOVED');
   const [m,f,,n]=await facts(i);check(m.length+f.length+n.length===0,'CANCELLED_NO_BUSINESS_EFFECTS');
  });
  for(const mode of ['lost-response','registration-not-sent'] as const)await test('credential-'+mode+'-withholds-token-and-protects-cleanup',async()=>{
   const i=await setup(),r=request(),beforeFetch=globalThis.fetch;let intercepted=false;
   globalThis.fetch=async(input,init)=>{
    const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),body=typeof init?.body==='string'?JSON.parse(init.body) as {p_command?:string}:null;
    if(u.pathname.endsWith('/rpc/natori_consultation_operation_v1')&&body?.p_command==='credential_finish'){
     intercepted=true;if(mode==='lost-response'){const response=await beforeFetch(input,init);check(response.ok,'REGISTRATION_COMMITTED');}
     return new Response(JSON.stringify({code:'synthetic_unconfirmed',message:'unconfirmed'}),{status:503,headers:{'Content-Type':'application/json'}});
    }return beforeFetch(input,init);
   };
   try{const result=await run(i,r,'prepare');check(result.kind==='unavailable'&&!('files' in result),'NO_TOKEN_EXPOSED');}finally{globalThis.fetch=beforeFetch;}
   check(intercepted,'REGISTRATION_INTERCEPTED');await run(i,r,'cancel');
   const rows=(await facts(i))[2];check(mode==='lost-response'?rows[0].credential_issuer===null&&Boolean(rows[0].credential_expires_at):Boolean(rows[0].credential_issuer),'DURABLE_PROTECTION');
   if(mode==='registration-not-sent')await expiredRecordedDeadline(i);
   check(!await cleanupConsultationOperation({token:i.token},r),'UNCONFIRMED_PROTECTED');
  });
  await test('lost-signing-response-keeps-unknown-issuer-protected',async()=>{
   const i=await setup(),r=request(),beforeFetch=globalThis.fetch;let intercepted=false;
   globalThis.fetch=async(input,init)=>{
    const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(u.pathname.includes('/storage/v1/object/upload/sign/')){intercepted=true;const response=await beforeFetch(input,init);check(response.ok,'REMOTE_SIGNED');return new Response('{}',{status:503});}
    return beforeFetch(input,init);
   };
   try{const result=await run(i,r,'prepare');check(result.kind==='storage_error'&&!('files' in result),'SIGNATURE_NOT_EXPOSED');}finally{globalThis.fetch=beforeFetch;}
   check(intercepted,'SIGNING_RESPONSE_LOST');await run(i,r,'cancel');await expiredRecordedDeadline(i);
   check(Boolean((await facts(i))[2][0].credential_issuer),'UNKNOWN_ISSUER_RETAINED');check(!await cleanupConsultationOperation({token:i.token},r),'UNKNOWN_ISSUER_NO_CLEANUP');
  });
  for(const fence of ['claim','access'] as const)await test(fence+'-expiry-during-final-business-update-rolls-back-all-writes',async()=>{
   const i=await setup(),r=request();await upload(i,r);const claim=randomUUID();check((await rpc(i,r,'claim',claim)).result==='claimed','CLAIM');
   check(!(await db.from('natori_projects').update({note:'phase3b-final-update-wait'}).eq('id',i.id)).error,'WAIT_FIXTURE');
   const expires=new Date(Date.now()+1500).toISOString();
   if(fence==='claim')check(!(await db.from('natori_consultation_operations').update({lease_expires_at:expires}).eq('project_id',i.id)).error,'SHORT_CLAIM');
   else check(!(await db.from('natori_consultation_access').update({expires_at:expires}).eq('project_id',i.id)).error,'SHORT_ACCESS');
   check(Date.now()<Date.parse(expires),'BEFORE_FINAL_WAIT');
   const commit=Promise.resolve(db.rpc('natori_consultation_operation_v1',{p_project_id:i.id,p_sender:'client',p_operation_id:r.operationId,p_request_hash:r.requestHash,p_command:'commit',p_owner_id:null,p_access_hash:i.accessHash,p_input:{verified:true},p_claim_token:claim}));
   let held=false;for(let n=0;n<100;n++){const probe=await peer.rpc('phase3b_final_update_is_waiting_v1',{p_project:i.id});check(!probe.error,'FINAL_WAIT_PROBE');if(probe.data===true){held=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}
   check(held,'FINAL_TRIGGER_WAIT_OBSERVED');const response=await commit;check(response.error?.code==='40001','FINAL_FENCE_ROLLBACK');
   const [m,f,u,n,a]=await facts(i);check(m.length+f.length+n.length===0&&u.every(row=>!row.finalized_at&&!row.message_id)&&a.length===1,'ALL_BUSINESS_WRITES_ROLLED_BACK');
   if(fence==='claim')for(const staff of [false,true]){
    const notice=await setup(),noticeRequest=request('Notice final-write expiry');await upload(notice,noticeRequest,staff);const noticeClaim=randomUUID();check((await rpc(notice,noticeRequest,'claim',noticeClaim,{},staff?'staff':'client')).result==='claimed','NOTICE_FINAL_CLAIM');
    check(!(await db.from('natori_projects').update({note:'phase3b-final-update-wait'}).eq('id',notice.id)).error,'NOTICE_FINAL_WAIT_FIXTURE');
    const deadline=new Date(Date.now()+1500).toISOString();await expireFrozenNotice(notice,noticeRequest,staff,deadline);check(Date.now()<Date.parse(deadline),'NOTICE_FINAL_BEFORE_EXPIRY');
    const committing=Promise.resolve(db.rpc('natori_consultation_operation_v1',{p_project_id:notice.id,p_sender:staff?'staff':'client',p_operation_id:noticeRequest.operationId,p_request_hash:noticeRequest.requestHash,p_command:'commit',p_owner_id:staff?owner:null,p_access_hash:staff?null:notice.accessHash,p_input:{verified:true},p_claim_token:noticeClaim}));
    let observed=false;for(let n=0;n<100;n++){const probe=await peer.rpc('phase3b_final_update_is_waiting_v1',{p_project:notice.id});check(!probe.error,'NOTICE_FINAL_WAIT_PROBE');if(probe.data===true){observed=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}
    check(observed,'NOTICE_FINAL_TRIGGER_WAIT_OBSERVED');check((await committing).error?.code==='40001','NOTICE_FINAL_FENCE_ROLLBACK');
    const after=await facts(notice);check(after[0].length+after[1].length+after[3].length===0&&after[2].every(row=>!row.finalized_at&&!row.message_id)&&after[4].length===1,'NOTICE_FINAL_ALL_BUSINESS_WRITES_ROLLED_BACK');
    check((await rpc(notice,noticeRequest,'release',noticeClaim,{},staff?'staff':'client')).result==='reserved'&&(await run(notice,noticeRequest,'cancel',staff)).kind==='cancelled','NOTICE_FINAL_CURRENT_RELEASE_THEN_CANCEL');
   }
  });

  await test('exact-cancelled-never-issued-reservation-can-clean-up-with-evidence-retained',async()=>{
   const i=await setup(),r=request(),path=await reserveIssuer(i,r);
   // Trusted fixture writes an object without minting any client upload credential.
   check(!(await db.storage.from('natori-consultations').upload(path,bytes,{contentType:'image/png',upsert:false})).error,'UNISSUED_FIXTURE_OBJECT');
   check((await rpc(i,r,'cancel')).result==='cancelled','UNISSUED_CANCELLED');await expiredRecordedDeadline(i);
   const before=(await facts(i))[2];check(before.length===1&&before[0].credential_issuer===null&&before[0].credential_expires_at===null,'NEVER_ISSUED_PROOF');
   // Inject the failure at the actual SDK DELETE request; the database scope is real.
   const neighbor=await setup(),neighborRequest=request(),neighborPath=await reserveIssuer(neighbor,neighborRequest);
   check(!(await db.storage.from('natori-consultations').upload(neighborPath,bytes,{contentType:'image/png',upsert:false})).error,'NEIGHBOR_FIXTURE_OBJECT');
   const operationState=async(fixture:Input,operation:Request)=>{
    const read=await db.from('natori_consultation_operations').select('project_id,sender,operation_id,request_hash,body,manifest,status,claim_token,lease_expires_at,message_id,notification_id').eq('project_id',fixture.id).eq('sender','client').eq('operation_id',operation.operationId).single();
    check(!read.error&&read.data,'CLEANUP_OPERATION_READ');return read.data!;
   };
   const frozenInput=(row:Awaited<ReturnType<typeof operationState>>)=>JSON.stringify([row.project_id,row.sender,row.operation_id,row.request_hash,row.body,row.manifest]);
   const beforeOperation=await operationState(i,r),beforeFetch=globalThis.fetch;
   const requestUrl=(input:Parameters<typeof fetch>[0])=>new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   const requestMethod=(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>(init?.method??(input instanceof globalThis.Request?input.method:'GET')).toUpperCase();
   const requestBody=async(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1]):Promise<Record<string,unknown>|null>=>typeof init?.body==='string'?JSON.parse(init.body) as Record<string,unknown>:input instanceof globalThis.Request?await input.clone().json() as Record<string,unknown>:null;
   const confirmedMissing=(error:unknown)=>typeof error==='object'&&error!==null&&'name' in error&&error.name==='StorageApiError'&&(('status' in error&&error.status===404)||('statusCode' in error&&error.statusCode==='404'));
   let failedDeletes=0;
   globalThis.fetch=async(input,init)=>{
    const url=requestUrl(input);
    if(url.origin===origin&&url.pathname==='/storage/v1/object/natori-consultations'&&requestMethod(input,init)==='DELETE'){
     const body=await requestBody(input,init);check(JSON.stringify(body?.prefixes)===JSON.stringify([path]),'REMOVE_FAILURE_EXACT_SCOPE');failedDeletes++;
     return new Response(JSON.stringify({statusCode:'503',error:'ServiceUnavailable',message:'synthetic remove failure'}),{status:503,headers:{'Content-Type':'application/json'}});
    }return beforeFetch(input,init);
   };
   try{check(!await cleanupConsultationOperation({token:i.token},r),'REMOVE_FAILURE_UNCONFIRMED');}finally{globalThis.fetch=beforeFetch;}
   check(failedDeletes>0,'REAL_REMOVE_REQUEST_FAILED');
   const failedOperation=await operationState(i,r),failedFacts=await facts(i);
   check(failedOperation.status==='cleanup'&&failedOperation.claim_token===null&&failedOperation.lease_expires_at===null&&frozenInput(failedOperation)===frozenInput(beforeOperation),'REMOVE_FAILURE_DURABLE_TOMBSTONE');
   check(failedFacts[0].length+failedFacts[1].length+failedFacts[3].length===0&&failedFacts[2].length===1&&failedFacts[2][0].storage_path===path&&failedFacts[2][0].credential_issuer===null&&failedFacts[2][0].credential_expires_at===null,'REMOVE_FAILURE_EVIDENCE_RETAINED');
   check(!(await db.storage.from('natori-consultations').info(path)).error,'FAILED_REMOVE_OBJECT_RETAINED');
   check((await rpc(i,r,'reserve',null,{body:r.body,files:r.files})).result==='cancelled'&&(await rpc(i,r,'credential_begin',randomUUID(),{fileId:r.files[0].id})).result==='cancelled','CLEANUP_FENCES_DELAYED_PREPARE');
   check((await rpc(i,r,'cleanup_done',null,{paths:[neighborPath]})).result==='protected','FOREIGN_PATH_ACK_REFUSED');
   check((await operationState(i,r)).status==='cleanup'&&!(await db.storage.from('natori-consultations').info(neighborPath)).error,'FOREIGN_NAMESPACE_RETAINED');
   let successfulDeletes=0;
   globalThis.fetch=async(input,init)=>{
    const url=requestUrl(input);
    if(url.origin===origin&&url.pathname==='/storage/v1/object/natori-consultations'&&requestMethod(input,init)==='DELETE'){
     const body=await requestBody(input,init);check(JSON.stringify(body?.prefixes)===JSON.stringify([path]),'REMOVE_RETRY_EXACT_SCOPE');successfulDeletes++;
     const response=await beforeFetch(input,init);check(response.ok,'REAL_REMOVE_RETRY_SUCCEEDED');return response;
    }return beforeFetch(input,init);
   };
   try{check(await cleanupConsultationOperation({token:i.token},r),'EXACT_UNISSUED_CLEANED');}finally{globalThis.fetch=beforeFetch;}
   check(successfulDeletes===1,'ONE_SUCCESSFUL_REMOVE_RETRY');
   check(confirmedMissing((await db.storage.from('natori-consultations').info(path)).error),'RETRY_OBJECT_CONFIRMED_MISSING');
   check(!(await db.storage.from('natori-consultations').info(neighborPath)).error,'RETRY_PRESERVES_OTHER_NAMESPACE');
   const missing=await db.storage.from('natori-consultations').info(path);check(Boolean(missing.error),'UNISSUED_OBJECT_REMOVED');
   const after=await facts(i);check(after[0].length+after[1].length+after[3].length===0&&after[2].length===1&&after[2][0].storage_path===path,'RESERVATION_EVIDENCE_RETAINED');
   const state=(await db.from('natori_consultation_operations').select('status').eq('project_id',i.id).single()).data;check(state?.status==='cleaned','UNISSUED_CLEANED_STATE');

   // The ACK disappears only after the actual cleanup_done transaction commits.
   const lost=await setup(),lostRequest=request(),lostPath=await reserveIssuer(lost,lostRequest);
   check(!(await db.storage.from('natori-consultations').upload(lostPath,bytes,{contentType:'image/png',upsert:false})).error,'LOST_ACK_FIXTURE_OBJECT');
   check((await rpc(lost,lostRequest,'cancel')).result==='cancelled','LOST_ACK_CANCELLED');await expiredRecordedDeadline(lost);
   const lostBefore=await operationState(lost,lostRequest);let ackLost=false,lostDeletes=0;
   globalThis.fetch=async(input,init)=>{
    const url=requestUrl(input),method=requestMethod(input,init);
    if(url.origin===origin&&url.pathname==='/storage/v1/object/natori-consultations'&&method==='DELETE'){
     const body=await requestBody(input,init);check(JSON.stringify(body?.prefixes)===JSON.stringify([lostPath]),'LOST_ACK_REMOVE_EXACT_SCOPE');lostDeletes++;
    }
    if(url.origin===origin&&url.pathname==='/rest/v1/rpc/natori_consultation_operation_v1'&&method==='POST'){
     const body=await requestBody(input,init);
     if(body?.p_command==='cleanup_done'&&body.p_project_id===lost.id&&body.p_operation_id===lostRequest.operationId){
      check(JSON.stringify(body.p_input)===JSON.stringify({paths:[lostPath]}),'LOST_ACK_EXACT_DONE_SCOPE');
      const response=await beforeFetch(input,init),saved=await response.clone().json() as {result?:unknown};
      check(response.ok&&saved.result==='cleaned','ACTUAL_CLEANUP_DONE_COMMITTED');ackLost=true;
      return new Response(JSON.stringify({code:'synthetic_unconfirmed',message:'unconfirmed'}),{status:503,headers:{'Content-Type':'application/json'}});
     }
    }return beforeFetch(input,init);
   };
   try{check(!await cleanupConsultationOperation({token:lost.token},lostRequest),'LOST_DONE_ACK_UNCONFIRMED');}finally{globalThis.fetch=beforeFetch;}
   check(ackLost&&lostDeletes===1,'ACK_LOST_AFTER_ONE_ACTUAL_DELETE');
   const lostAfter=await operationState(lost,lostRequest),lostFacts=await facts(lost);
   check((await rpc(lost,lostRequest,'lookup')).result==='cleaned'&&lostAfter.status==='cleaned'&&lostAfter.claim_token===null&&lostAfter.lease_expires_at===null&&frozenInput(lostAfter)===frozenInput(lostBefore),'LOST_ACK_DURABLE_CLEANED_TOMBSTONE');
   check(lostFacts[0].length+lostFacts[1].length+lostFacts[3].length===0&&lostFacts[2].length===1&&lostFacts[2][0].storage_path===lostPath&&lostFacts[2][0].credential_issuer===null&&lostFacts[2][0].credential_expires_at===null,'LOST_ACK_EVIDENCE_RETAINED');
   const missingLostObject=await db.storage.from('natori-consultations').info(lostPath);
   check(Boolean(missingLostObject.error),'LOST_ACK_OBJECT_ACTUALLY_REMOVED');
   check(confirmedMissing(missingLostObject.error),'LOST_ACK_OBJECT_CONFIRMED_MISSING');
   let repeatedDeletes=0;
   globalThis.fetch=async(input,init)=>{const url=requestUrl(input);if(url.origin===origin&&url.pathname==='/storage/v1/object/natori-consultations'&&requestMethod(input,init)==='DELETE')repeatedDeletes++;return beforeFetch(input,init);};
   try{check(!await cleanupConsultationOperation({token:lost.token},lostRequest),'CLEANED_RETRY_PROTECTED');}finally{globalThis.fetch=beforeFetch;}
   check(repeatedDeletes===0&&(await rpc(lost,lostRequest,'cleanup_scope')).result==='protected','CLEANED_REPLAY_HAS_NO_STORAGE_DELETE');
   check((await rpc(lost,lostRequest,'reserve',null,{body:lostRequest.body,files:lostRequest.files})).result==='cancelled'&&(await rpc(lost,lostRequest,'credential_begin',randomUUID(),{fileId:lostRequest.files[0].id})).result==='cancelled','LOST_ACK_FENCES_DELAYED_PREPARE');
   check(frozenInput(await operationState(lost,lostRequest))===frozenInput(lostBefore)&&!(await db.storage.from('natori-consultations').info(neighborPath)).error,'LOST_ACK_PRESERVES_ORIGINAL_AND_NEIGHBOR');
  });
  await test('registered-past-expiry-is-not-proof-of-provider-quiescence',async()=>{
   const i=await setup(),r=request(),path=await reserveIssuer(i,r),issuer=randomUUID();
   check((await rpc(i,r,'credential_begin',issuer,{fileId:r.files[0].id})).result==='credential_started','ISSUANCE_BEGUN');
   // Disposable-only historical setup models a known, already-expired credential;
   // it is not a measurement of the external provider's in-flight request lifecycle.
   const started=new Date(Date.now()-3600000).toISOString(),expired=new Date(Date.now()-1800000).toISOString();
   check(!(await db.from('natori_consultation_uploads').update({credential_started_at:started}).eq('project_id',i.id)).error,'HISTORICAL_START_FIXTURE');
   const finish=await rpc(i,r,'credential_finish',issuer,{fileId:r.files[0].id,expiresAt:expired});
   check(finish.result==='credential_registered'&&finish.expose===false,'EXPIRED_REGISTERED_WITHOUT_EXPOSURE');
   check((await rpc(i,r,'cancel')).result==='cancelled','ISSUED_CANCELLED');await expiredRecordedDeadline(i);
   check(!(await db.storage.from('natori-consultations').upload(path,bytes,{contentType:'image/png',upsert:false})).error,'RETAINED_FIXTURE_OBJECT');
   check(!await cleanupConsultationOperation({token:i.token},r),'ELAPSED_TIME_NOT_PROVIDER_QUIESCENCE');
   const rows=(await facts(i))[2];check(rows.length===1&&rows[0].credential_issuer===null&&Date.parse(rows[0].credential_expires_at)===Date.parse(expired),'EVER_ISSUED_MARKER_RETAINED');
   check(!(await db.storage.from('natori-consultations').info(path)).error,'ISSUED_OBJECT_NOT_REMOVED');
   const state=(await db.from('natori_consultation_operations').select('status').eq('project_id',i.id).single()).data;check(state?.status==='cancelled','PRIVATE_REVIEW_RETENTION');
  });

  writeFileSync('/results/phase3b-db.json',JSON.stringify({tests:results,passed:results.filter(row=>row.status==='passed').length,failed:results.filter(row=>row.status==='failed').length,blockedDestinations:blocked,realStorage:true,realMail:false},null,2));check(results.length===30&&results.every(row=>row.status==='passed'),'INTEGRATION_FAILED');
 }finally{globalThis.fetch=direct;}
}
main().catch(()=>{console.error('Phase3B isolated integration failed');process.exitCode=1;});
