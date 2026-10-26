import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {prepare,root} from '../natori-case-local-auth/prepare.mjs';
const out=resolve(process.argv[2]??'');if(!out.startsWith('/workspace/')&&!out.startsWith('/tmp/'))throw Error('new local output required');mkdirSync(out);
const {app}=await prepare(out);mkdirSync(app+'/scripts');copyFileSync(root+'/scripts/build-bank-json.mjs',app+'/scripts/build-bank-json.mjs');
const target=JSON.stringify({profile:'local',ref:'local',project:'local-fixture',url:'http://127.0.0.1:4193',origin:'http://127.0.0.1:4195',run:'88888888-8888-4888-8888-888888888888',startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-12-01T00:00:00Z'});
const env={PATH:dirname(process.execPath)+':'+process.env.PATH,LANG:'C.UTF-8',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',CI:'1',
 NODE_OPTIONS:'--require='+root+'/scripts/natori-case-preview/deny-network.cjs',NEXT_FONT_GOOGLE_MOCKED_RESPONSES:out+'/offline-fonts.cjs',
 NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4193',SUPABASE_URL:'http://127.0.0.1:4193',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:4195',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-offline-build-not-a-key',SUPABASE_SERVICE_ROLE_KEY:'synthetic-offline-build-not-a-key',STRIPE_SECRET_KEY:'sk_test_synthetic_offline_not_real',RESEND_API_KEY:'re_synthetic_offline_not_real',
 NATORI_CASE_ACCEPTANCE_TARGET:target,NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET:target};
const started=Date.now(),child=spawn('npm',['run','build'],{cwd:app,env,stdio:['ignore','pipe','pipe']});let log='';
for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=data;process.stdout.write(data);});
const exitCode=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',done);});
writeFileSync(out+'/build.log',log);writeFileSync(out+'/build-result.json',JSON.stringify({success:exitCode===0,exitCode,node:process.version,elapsedMs:Date.now()-started,command:'npm run build (prebuild + next build)',fullApplication:true,externalNetwork:'all net.Socket.connect blocked',configuration:'explicit local acceptance target; production deployment gate unchanged',substitutions:['synthetic nonworking keys','offline Google Font CSS local fallback'],limits:['not deployed or served','not actual fonts/provider/Storage/Google/iPhone/hosted performance','production profile remains closed']},null,2));process.exitCode=exitCode??1;
