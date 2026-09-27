import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {setDefaultResultOrder} from 'node:dns';
import {createRequire} from 'node:module';
const require=createRequire('/app/package.json');
const {createClient}=require('@supabase/supabase-js');
const {chromium,expect}=require('@playwright/test');
// NextURL canonicalizes loopback IPs to localhost (locked Next 15.5.25).
// Resolve that local name from /etc/hosts; the kernel still permits only IPv4:3000.
setDefaultResultOrder('ipv4first');
const appOrigin='http://localhost:3000';
const check=(ok,code)=>{if(!ok)throw new Error(code);};
let stage='preflight',server,browser;
const results=[];
function validateOrigin(input,expected){
  if(!/^http:\/\/172\.30\.250\.\d+:8000$/.test(expected)||input!==expected)throw new Error('DESTINATION_REJECTED');
}
async function test(name,fn){
  try{await fn();results.push({name,status:'passed'});console.log(`PASS browser/${name}`);}
  catch(error){const code=/^[A-Z_0-9]+$/.test(error?.message??'')?error.message:'ASSERTION_FAILED';results.push({name,status:'failed',code});console.log(`FAIL browser/${name} ${code}`);}
}
function safeError(error){return /^[A-Z_0-9]+$/.test(error?.message??'')?error.message:'UNEXPECTED_ERROR';}
async function stopServer(){
  if(!server||server.exitCode!==null)return;
  const child=server;server=undefined;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},5000))]);
}
async function main(){
  check(process.env.PHASE_0B_BROWSER==='ephemeral','EPHEMERAL_REQUIRED');
  const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));
  validateOrigin(origin,origin);
  await test('production-destination-rejected-before-network',async()=>{
    let calls=0,rejected=false;
    try{validateOrigin('https://production-example.supabase.co',origin);calls++;}catch{rejected=true;}
    check(rejected&&calls===0,'DESTINATION_GUARD_FAILED');
  });
  await test('dedicated-next-loopback-port-reachable',async()=>{
    const probe=createServer((_request,response)=>response.end('phase0b-only'));
    await new Promise(resolve=>probe.listen(3000,'127.0.0.1',resolve));
    try{const r=await fetch(appOrigin,{signal:AbortSignal.timeout(3000)});check(await r.text()==='phase0b-only','NEXT_PORT_BLOCKED');}finally{await new Promise(resolve=>probe.close(resolve));}
  });
  check(!results.some(r=>r.status==='failed'),'PREFLIGHT_FAILED');
  const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8'));
  const admin=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}});
  stage='fixture';
  const actors=[];
  for(const name of ['owner','staff-a','staff-b','stranger']){
    const email=`${name}@phase0b-browser.invalid`,password=randomBytes(32).toString('hex');
    const u=await admin.auth.admin.createUser({email,password,email_confirm:true});
    check(!u.error&&u.data.user,'AUTH_FIXTURE_FAILED');actors.push({name,email,password,id:u.data.user.id});
  }
  const [owner,...others]=actors;
  const title='Phase 0B browser shared target';
  const rows=actors.map(a=>({user_id:a.id,title:a===owner?title:`Foreign fixture ${a.name}`,client_name:'Synthetic browser fixture',type:'icon',status:'rough',due_date:null,amount:1000,paid_at:'2026-09-01T00:00:00Z',paid_amount:1000,request_data:{fixture:true},agreed_terms:{fixture:true}}));
  const seed=await admin.from('natori_projects').insert(rows).select('id,user_id');
  check(!seed.error&&seed.data.length===4,'PROJECT_FIXTURE_FAILED');
  const target=seed.data.find(r=>r.user_id===owner.id).id;
  const sharedKey=randomBytes(32).toString('hex');
  const baseEnv={PATH:'/runtime-bin:/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',NODE_ENV:'development',NODE_OPTIONS:'--dns-result-order=ipv4first',NEXT_TELEMETRY_DISABLED:'1',PHASE_0B_BROWSER:'ephemeral',NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,NATORI_DASHBOARD_KEY:sharedKey,NATORI_OWNER_EMAILS:owner.email,NATORI_STAFF_EMAILS:others.slice(0,2).map(a=>a.email).join(','),NEXT_PUBLIC_SITE_URL:appOrigin};
  async function startServer(setting){
    await stopServer();
    server=spawn(process.execPath,['/app/node_modules/next/dist/bin/next','dev','--hostname','localhost','--port','3000'],{cwd:'/app',env:{...baseEnv,NATORI_OWNER_USER_ID:setting},stdio:['ignore','pipe','pipe']});
    // Never publish raw Next logs, whose request URLs could contain the ephemeral key.
    const diagnostics=new Set(),diagnosticLines=[];let lastStatus=null,lastFetchError=null;let readyPath='/fixture-session';const redirects=new Set();
    const ephemeral=[keys.anon,keys.service,sharedKey,...actors.map(a=>a.password)];
    for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{
      let s=data.toString();
      for(const value of ephemeral)s=s.split(value).join('[redacted]');
      s=s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+|[a-fA-F0-9]{48,}/g,'[redacted]').replace(/(?:https?|wss?):\/\/[^\s"']+/g,'[url]');
      for(const code of ['Ready in','Starting','Module not found','EADDRINUSE','EACCES','EAI_AGAIN','ECONNREFUSED','fetch failed','SyntaxError','Failed to compile','Downloading','panicked'])if(s.includes(code))diagnostics.add(code);
      for(const line of s.split('\n'))if(/error|failed|Error|Error:|panicked|Cannot|could not|SWC/.test(line)&&!/(?:cookie|token|secret|password|apikey|authorization)/i.test(line))diagnosticLines.push(line.slice(0,250));
    });
    const deadline=Date.now()+120000;let ready=false;
    while(Date.now()<deadline&&server.exitCode===null){
      try{
        const r=await fetch(`${appOrigin}${readyPath}`,{signal:AbortSignal.timeout(2000),redirect:'manual'});lastStatus=r.status;
        if(r.ok){ready=true;break;}
        if(r.status>=300&&r.status<400){
          const next=new URL(r.headers.get('location')??'',`${appOrigin}${readyPath}`);
          check(next.origin===appOrigin,'NEXT_REDIRECT_OUTSIDE_ORIGIN');
          if(redirects.has(next.pathname))console.log(`Next loopback path loop: ${[...redirects,next.pathname].join(' -> ')}`);
          check(!redirects.has(next.pathname),'NEXT_REDIRECT_LOOP');redirects.add(next.pathname);readyPath=next.pathname;
        }
      }catch(error){
        if(/^NEXT_REDIRECT_/.test(error?.message??''))throw error;
        lastFetchError=[error?.name,error?.cause?.code,error?.cause?.message].filter(Boolean).join(' ').replace(/(?:https?|wss?):\/\/[^\s"']+/g,'[url]').slice(0,200);
      }
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!ready){console.log(`Next startup classifications: ${[...diagnostics].join(',')||'not-ready'} status=${lastStatus} fetch=${lastFetchError}`);for(const line of diagnosticLines.slice(-8))console.log(`Next sanitized diagnostic: ${line}`);throw new Error('NEXT_NOT_READY');}
  }
  stage='next-start';await startServer(owner.id);
  stage='chromium';browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP localhost 127.0.0.1']});
  async function context(){return browser.newContext({baseURL:appOrigin,serviceWorkers:'block'});}
  async function login(page,actor){
    await page.goto('/fixture-session');
    await page.getByLabel('Email',{exact:true}).fill(actor.email);
    await page.getByLabel('Password',{exact:true}).fill(actor.password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page.getByText('Session ready',{exact:true})).toBeVisible({timeout:30000});
  }
  async function list(page){
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/natori/admin/projects',{timeout:60000});
    await page.goto('/natori/projects');
    const r=await response;check(r.status()===200,'PROJECT_HTTP_FAILED');
    const body=await r.json();check(body.projects.length===1&&body.projects[0].id===target,'WRONG_OWNER_DATASET');
    await expect(page.getByText(title,{exact:true}).first()).toBeVisible({timeout:30000});
    for(const a of others)await expect(page.getByText(`Foreign fixture ${a.name}`,{exact:true})).toHaveCount(0);
    // Next's screen-reader route announcer also has role=alert outside main.
    // Only business errors in the actual project screen must be absent.
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  }
  stage='browser-tests';
  for(const actor of actors.slice(0,3))await test(`real-login-same-project-${actor.name}`,async()=>{
    const ctx=await context();try{const page=await ctx.newPage();await login(page,actor);await list(page);}finally{await ctx.close();}
  });
  await test('shared-key-dashboard-to-projects-and-reopen',async()=>{
    const ctx=await context();try{
      const page=await ctx.newPage();await page.goto(`/natori/dashboard?natori-key=${sharedKey}`);
      await expect(page.getByText('合言葉キーでアクセス中',{exact:true})).toBeVisible({timeout:60000});
      check(!new URL(page.url()).searchParams.has('natori-key'),'KEY_NOT_REMOVED');
      const cookie=(await ctx.cookies()).find(c=>c.name==='natori_dashboard_key');
      check(cookie?.httpOnly&&cookie?.secure&&cookie?.sameSite==='Lax'&&cookie.value!==sharedKey,'COOKIE_BOUNDARY_FAILED');
      const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/natori/admin/projects');
      await page.getByRole('link',{name:'案件管理',exact:true}).click();
      check((await response).status()===200,'DASHBOARD_NAV_FAILED');
      await expect(page.getByText(title,{exact:true}).first()).toBeVisible({timeout:30000});
      await page.close();const reopened=await ctx.newPage();await list(reopened);
      await reopened.screenshot({path:'/results/browser-shared-projects.png',fullPage:true});
    }finally{await ctx.close();}
  });
  await test('shared-key-plus-unrelated-login-logout-relogin',async()=>{
    const ctx=await context();try{
      const page=await ctx.newPage();await login(page,actors[3]);
      await page.goto(`/natori/dashboard?natori-key=${sharedKey}`);await list(page);
      await page.goto('/natori/dashboard');await page.getByRole('button',{name:'ログアウト',exact:true}).click();
      await expect(page.getByText('合言葉キーでアクセス中',{exact:true})).toBeVisible({timeout:30000});
      await list(page);await login(page,actors[1]);await list(page);
    }finally{await ctx.close();}
  });
  for(const mode of ['anonymous','stranger','wrong-key'])await test(`deny-${mode}`,async()=>{
    const ctx=await context();try{
      const page=await ctx.newPage();if(mode==='stranger')await login(page,actors[3]);
      await page.goto(`/natori/projects${mode==='wrong-key'?'?natori-key=invalid':''}`);
      await expect(page).toHaveURL(/\/admin-login\?/);check((await ctx.request.get('/api/natori/admin/projects')).status()===401,'UNAUTHORIZED_API_ACCEPTED');
    }finally{await ctx.close();}
  });
  await test('staff-logout-denies-access-then-relogin-restores-same-owner',async()=>{
    const ctx=await context();try{
      const page=await ctx.newPage();await login(page,actors[2]);await list(page);
      await page.goto('/natori/dashboard');await page.getByRole('button',{name:'ログアウト',exact:true}).click();
      await expect(page.getByText('合言葉キーでアクセス中',{exact:true})).toBeVisible({timeout:30000});
      await page.goto('/natori/projects');await expect(page).toHaveURL(/\/admin-login\?/);
      await login(page,actors[2]);await list(page);
    }finally{await ctx.close();}
  });
  for(const setting of ['', 'invalid']){
    stage=`config-${setting||'missing'}`;await startServer(setting);
    await test(`configuration-${setting||'missing'}-503-visible-and-no-write`,async()=>{
      const before=await admin.from('natori_projects').select('*').in('user_id',actors.map(a=>a.id)).order('id');check(!before.error,'SNAPSHOT_FAILED');
      const ctx=await context();try{
        const page=await ctx.newPage();await page.goto(`/natori/dashboard?natori-key=${sharedKey}`);
        const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/natori/admin/projects');
        await page.goto('/natori/projects');check((await response).status()===503,'CONFIG_NOT_503');
        await page.getByText('エラー詳細',{exact:true}).click();
        await expect(page.getByText('管理対象の設定を確認できません。案件は変更していません。管理者に連絡してください。',{exact:true})).toBeVisible({timeout:30000});
        await expect(page.getByText(title,{exact:true})).toHaveCount(0);
        if(setting==='')await page.screenshot({path:'/results/browser-configuration-error.png',fullPage:true});
      }finally{await ctx.close();}
      const after=await admin.from('natori_projects').select('*').in('user_id',actors.map(a=>a.id)).order('id');
      check(!after.error&&JSON.stringify(after.data)===JSON.stringify(before.data),'CONFIG_WROTE_ROWS');
    });
  }
}
try{await main();}catch(error){console.log(`FAIL browser setup: ${stage} ${safeError(error)}`);results.push({name:`setup-${stage}`,status:'failed',code:safeError(error)});}
finally{if(browser)await browser.close();await stopServer();}
const summary={passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,results};
writeFileSync('/results/phase0b-browser.json',JSON.stringify(summary,null,2));
console.log(`SUMMARY browser: passed=${summary.passed} failed=${summary.failed} skipped=0`);
if(summary.failed)process.exitCode=1;
