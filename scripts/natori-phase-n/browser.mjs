import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {setDefaultResultOrder} from 'node:dns';
import {createRequire} from 'node:module';
const require=createRequire('/app/package.json');
const {createClient}=require('@supabase/supabase-js');
const {chromium,expect}=require('@playwright/test');
setDefaultResultOrder('ipv4first');
const appOrigin='http://localhost:3000',results=[];
const check=(ok,code)=>{if(!ok)throw new Error(code);};
let stage='preflight',server,browser,capture;
async function test(name,fn){try{await fn();results.push({name,status:'passed'});console.log(`PASS phasen-browser/${name}`);}catch(error){const code=/^[A-Z_0-9]+$/.test(error?.message??'')?error.message:'ASSERTION_FAILED';results.push({name,status:'failed',code});console.log(`FAIL phasen-browser/${name} ${code}`);}}
async function main(){
  check(process.env.PHASE_N_BROWSER==='ephemeral','EPHEMERAL_REQUIRED');
  const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin),'DESTINATION_REJECTED');
  const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8'));
  const admin=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}});
  const password=randomBytes(32).toString('hex'),sharedKey=randomBytes(32).toString('hex'),apiKey=randomBytes(32).toString('hex');
  const auth=await admin.auth.admin.createUser({email:'owner@phase0b-browser.invalid',password,email_confirm:true});
  check(!auth.error&&auth.data.user,'AUTH_FIXTURE');const owner=auth.data.user.id;
  const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-3600000).toISOString();
  const hash=t=>createHash('sha256').update(t).digest('hex');
  async function project(title){const token=randomBytes(24).toString('base64url');const r=await admin.from('natori_projects').insert({user_id:owner,title,client_name:'Synthetic browser',client_email:'client@phase-n.invalid',amount:12000,type:'icon',status:'delivered',payment_confirmed_at:past,paid_at:past,paid_amount:12000,delivered_mail_at:past,delivery_token_hash:hash(token),delivery_token_expires_at:future}).select('id').single();check(!r.error&&r.data,'PROJECT_FIXTURE');return{id:r.data.id,token,title};}
  const quote=await project('Browser quote notification'),delivery=await project('Browser delivery notification');
  quote.token=randomBytes(24).toString('base64url');
  const q=await admin.from('natori_quotes').insert({project_id:quote.id,user_id:owner,title:quote.title,client_name:'Synthetic browser',to_email:'client@phase-n.invalid',amount:12000,subject:'Synthetic',body_snapshot:'Unchanged original',token_hash:hash(quote.token),expires_at:future}).select('id').single();
  check(!q.error&&q.data,'QUOTE_FIXTURE');check(!(await admin.from('natori_projects').update({active_quote_id:q.data.id}).eq('id',quote.id)).error,'ACTIVE_QUOTE');
  let reject=true,providerCalls=0;const messages=new Map();
  capture=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=String(chunk);
    try{const p=JSON.parse(body),key=req.headers['idempotency-key'];
      check(req.headers.authorization===`Bearer ${apiKey}`&&p.from==='Phase N <sender@phase-n.invalid>'&&[...p.to,...(p.bcc??[]),p.reply_to].every(a=>['artist@phase-n.invalid','client@phase-n.invalid','bcc@phase-n.invalid'].includes(a)),'CAPTURE_ALLOWLIST');
      providerCalls++;if(reject){res.writeHead(422);res.end('{}');return;}
      const previous=messages.get(key);if(previous&&previous.body!==body){res.writeHead(409);res.end('{}');return;}
      const id=previous?.id??randomUUID();messages.set(key,{id,body});res.setHeader('content-type','application/json');res.end(JSON.stringify({id}));
    }catch{res.writeHead(400);res.end('{}');}
  });
  await new Promise(resolve=>capture.listen(3101,'127.0.0.1',resolve));
  stage='next-start';
  server=spawn(process.execPath,['--require','/browser-test/provider-preload.cjs','/app/node_modules/next/dist/bin/next','dev','--hostname','localhost','--port','3000'],{cwd:'/app',env:{PATH:'/runtime-bin:/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',NODE_ENV:'development',NODE_OPTIONS:'--dns-result-order=ipv4first',NEXT_TELEMETRY_DISABLED:'1',PHASE_N_BROWSER:'ephemeral',PHASE_0B_BROWSER:'ephemeral',NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,NATORI_DASHBOARD_KEY:sharedKey,NATORI_OWNER_USER_ID:owner,NATORI_OWNER_EMAILS:'owner@phase0b-browser.invalid',NEXT_PUBLIC_SITE_URL:appOrigin,NATORI_ACCEPTANCE_OUTBOX_ENABLED:'1',NATORI_NOTIFICATION_SENDING_ENABLED:'1',RESEND_API_KEY:apiKey,NATORI_ORDER_MAIL_FROM:'Phase N <sender@phase-n.invalid>',NATORI_PORTFOLIO_CONTACT_TO:'artist@phase-n.invalid',NATORI_MAIL_BCC:'bcc@phase-n.invalid'},stdio:['ignore','pipe','pipe']});
  // Consume but never publish Next request logs, which contain ephemeral capability URLs.
  const classifications=new Set();for(const stream of [server.stdout,server.stderr])stream.on('data',b=>{const s=b.toString();for(const c of ['Module not found','Failed to compile','SyntaxError','EADDRINUSE'])if(s.includes(c))classifications.add(c);});
  let ready=false;const deadline=Date.now()+120000;
  while(Date.now()<deadline&&server.exitCode===null){try{const r=await fetch(`${appOrigin}/ja/fixture-session`,{signal:AbortSignal.timeout(2000),redirect:'manual'});if(r.status===200){ready=true;break;}if(r.status>=300&&r.status<400){const loc=new URL(r.headers.get('location'),appOrigin);check(loc.origin===appOrigin,'REDIRECT_OUTSIDE');const rr=await fetch(loc,{signal:AbortSignal.timeout(2000),redirect:'manual'});if(rr.status===200){ready=true;break;}}}catch{}await new Promise(r=>setTimeout(r,500));}
  if(!ready){console.log(`Next startup: ${[...classifications].join(',')}`);throw new Error('NEXT_NOT_READY');}
  browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP localhost 127.0.0.1']});
  const client=await browser.newContext({baseURL:appOrigin,serviceWorkers:'block'}),page=await client.newPage();
  const rows=async id=>{const r=await admin.from('natori_notification_jobs').select('*').eq('project_id',id);check(!r.error,'READ_JOBS');return r.data;};
  stage='browser-tests';
  await test('quote-confirmation-survives-provider-rejection-and-reload',async()=>{
    await page.goto(`/natori/quote/${quote.token}`);await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'この内容で依頼を確定する'}).click();
    await expect(page.getByText('ご依頼の確定ありがとうございます!',{exact:false})).toBeVisible({timeout:30000});
    await expect.poll(async()=>(await rows(quote.id))[0]?.status,{timeout:30000}).toBe('failed');
    const before=(await admin.from('natori_quotes').select('accepted_at').eq('id',q.data.id).single()).data.accepted_at;
    await page.reload();await expect(page.getByText('ご依頼の確定ありがとうございます!',{exact:false})).toBeVisible();
    check((await rows(quote.id)).length===1&&before,'QUOTE_RELOAD_DUPLICATE');
  });
  await test('delivery-confirmation-survives-both-notification-failures',async()=>{
    await page.goto(`/natori/delivery/${delivery.token}`);
    // File readiness is Phase 1's gate. This Phase N fixture exercises only existing acceptance semantics.
    await page.getByRole('button',{name:'受け取りました',exact:true}).click();
    await expect(page.getByText('受け取りを確認しました。ありがとうございました！',{exact:false})).toBeVisible({timeout:30000});
    await expect.poll(async()=>(await rows(delivery.id)).filter(r=>r.status==='failed').length,{timeout:30000}).toBe(2);
    await page.reload();await expect(page.getByText('受け取りを確認しました。ありがとうございました！',{exact:false})).toBeVisible();
  });
  await test('anonymous-cannot-read-or-retry-admin-notices',async()=>{
    check((await client.request.get('/api/natori/admin/notifications')).status()===401,'ANON_READ');
    const list=await rows(quote.id);check((await client.request.post('/api/natori/admin/notifications',{headers:{'x-requested-with':'me-ish'},data:{id:list[0].id}})).status()===401,'ANON_RETRY');
  });
  await test('anonymous-cannot-access-real-mail-verification',async()=>{
    check((await client.request.get('/api/natori/admin/notification-verification')).status()===401,'ANON_VERIFY_READ');
    check((await client.request.post('/api/natori/admin/notification-verification',{headers:{'x-requested-with':'me-ish'},data:{purpose:'all'}})).status()===401,'ANON_VERIFY_SEND');
  });
  const manager=await browser.newContext({baseURL:appOrigin,serviceWorkers:'block'}),management=await manager.newPage();
  await test('shared-key-home-shows-failed-notices-without-email-data',async()=>{
    await management.goto(`/natori/dashboard?natori-key=${sharedKey}`);
    await expect(management.getByRole('heading',{name:'承諾・受取のメール通知'})).toBeVisible({timeout:60000});
    await expect(management.getByRole('button',{name:'メールだけ再試行'})).toHaveCount(3);
    const response=await manager.request.get('/api/natori/admin/notifications');const text=await response.text();
    check(response.status()===200&&!/@phase-n.invalid|snapshot|payload|provider_id|token_hash/.test(text),'UI_PRIVATE_DATA');
  });
  await test('admin-retry-sends-only-one-mail-without-changing-acceptance',async()=>{
    const before=(await admin.from('natori_quotes').select('*').eq('id',q.data.id).single()).data;
    reject=false;const card=management.getByRole('listitem').filter({hasText:'Browser quote notification：見積もり承諾のお知らせ'});
    await card.getByRole('button',{name:'メールだけ再試行'}).click();
    await expect(card.getByText('送信サービス受付済み',{exact:true})).toBeVisible({timeout:30000});
    check(messages.size===1,'RETRY_MULTIPLE_MAILS');
    const after=(await admin.from('natori_quotes').select('*').eq('id',q.data.id).single()).data;
    check(JSON.stringify(before)===JSON.stringify(after),'RETRY_MUTATED_ACCEPTANCE');
  });
  await test('real-mail-verification-is-disabled-and-csrf-protected-by-default',async()=>{
    const before=providerCalls;
    check((await manager.request.get('/api/natori/admin/notification-verification')).status()===404,'VERIFY_DISABLED_READ');
    check((await manager.request.post('/api/natori/admin/notification-verification',{headers:{'x-requested-with':'me-ish'},data:{purpose:'all'}})).status()===404,'VERIFY_DISABLED_SEND');
    check((await manager.request.post('/api/natori/admin/notification-verification',{data:{purpose:'all'}})).status()===403,'VERIFY_CSRF');
    check(providerCalls===before,'VERIFY_UNEXPECTED_MAIL');
  });
  await test('mobile-width-status-controls-and-no-horizontal-overflow',async()=>{
    await management.setViewportSize({width:390,height:844});
    const panel=management.getByRole('region',{name:'承諾・受取のメール通知'});
    await expect(panel).toBeVisible();await expect(panel.getByRole('button',{name:'状態を更新'})).toBeEnabled();
    check(await management.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'MOBILE_OVERFLOW');
    await panel.screenshot({path:'/results/phasen-notification-mobile.png'});
  });
  await test('management-read-error-is-not-presented-as-empty',async()=>{
    await management.route('**/api/natori/admin/notifications*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic"}'}));
    await management.getByRole('button',{name:'状態を更新'}).click();
    await expect(management.getByRole('alert').filter({hasText:'通知の状態を確認できませんでした。'})).toBeVisible();
    await expect(management.getByText('新しい通知はありません。',{exact:false})).toHaveCount(0);
  });
  await client.close();await manager.close();
  writeFileSync('/results/phasen-browser.json',JSON.stringify({tests:results,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,engine:'Chromium 1.58.2; mobile viewport only, not iPhone Safari',providerRequests:providerCalls,distinctAcceptedMessages:messages.size},null,2));
  console.log(`PHASE N BROWSER ${results.filter(r=>r.status==='passed').length} passed / ${results.filter(r=>r.status==='failed').length} failed / 0 skipped`);
  check(results.length===9&&results.every(r=>r.status==='passed'),'BROWSER_FAILED');
}
main().catch(()=>{console.error(`Phase N browser failed at ${stage}; raw URLs and logs withheld`);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(()=>{server.kill('SIGKILL');r();},5000))]);}if(capture)await new Promise(r=>capture.close(r));});
