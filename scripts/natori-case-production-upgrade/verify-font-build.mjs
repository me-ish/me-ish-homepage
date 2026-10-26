import {mkdirSync, copyFileSync, writeFileSync, readFileSync} from 'node:fs';
import {spawn, execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepare, root} from '../natori-case-local-auth/prepare.mjs';

// Exact application source, managed production flag shape, synthetic values only.
// The internal font transport is local because this Work cannot reach Google Fonts.
const out = resolve(process.argv[2] ?? '');
if (!out.startsWith('/workspace/') || !process.argv[2]) throw Error('new workspace output required');
mkdirSync(out);
const {app} = await prepare(out);
mkdirSync(app + '/scripts'); mkdirSync(app + '/patches');
copyFileSync(root + '/scripts/build-bank-json.mjs', app + '/scripts/build-bank-json.mjs');
copyFileSync(root + '/patches/next+15.5.27.patch', app + '/patches/next+15.5.27.patch');
// Exercise the real loader's missing-extension branch during the normal build.
// These local Zen bytes stand in for transport only; this is not a typography test.
const fontPath = out + '/fixture-font-without-extension';
copyFileSync(root + '/public/fonts/ZenMaruGothic-Bold.ttf', fontPath);
writeFileSync(out + '/offline-fonts.cjs', `module.exports=new Proxy({}, {get(_target,key){
 if(typeof key!=='string'||!key.startsWith('https://fonts.googleapis.com/css2?'))return undefined;
 const family=new URL(key).searchParams.get('family').split(':')[0];
 if(!['Fredoka','Zen Maru Gothic','Lilita One'].includes(family))throw Error('unreviewed font family');
 return "/* latin */\\n@font-face {font-family:'"+family+"';font-style:normal;font-weight:400 900;font-display:swap;src: url("+${JSON.stringify(fontPath)}+") format('truetype');}";
}});`);
const target = {profile:'production', ref:'abcdefghijklmnopqrst', project:'prj_synthetic',
  origin:'https://release.example.invalid', owner:'22222222-2222-4222-8222-222222222222'};
const env = {
  PATH:dirname(process.execPath) + ':' + process.env.PATH, LANG:'C.UTF-8', NODE_ENV:'production',
  NEXT_TELEMETRY_DISABLED:'1', CI:'1',
  NODE_OPTIONS:'--require=' + root + '/scripts/natori-case-preview/deny-network.cjs',
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES:out + '/offline-fonts.cjs',
  VERCEL_ENV:'production', VERCEL_PROJECT_ID:target.project,
  NATORI_CASE_RELEASE_ENABLED:'1', NATORI_CASE_RELEASE_TARGET:JSON.stringify(target),
  NATORI_CASE_BOOTSTRAP_PHASE:'managed', NATORI_CASE_RELEASE_COMMANDS_ENABLED:'1',
  NATORI_CASE_DASHBOARD_PREVIEW_ENABLED:'1', NATORI_CASE_PAYMENT_WORKSPACE_ENABLED:'1',
  NATORI_ACCEPTANCE_OUTBOX_ENABLED:'1', NATORI_NOTIFICATION_SENDING_ENABLED:'1',
  NATORI_DELIVERY_INTEGRITY_ENABLED:'1', NATORI_OWNER_USER_ID:target.owner,
  NEXT_PUBLIC_SUPABASE_URL:`https://${target.ref}.supabase.co`, SUPABASE_URL:`https://${target.ref}.supabase.co`,
  NEXT_PUBLIC_SITE_URL:target.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-offline-build-not-a-key',
  SUPABASE_SERVICE_ROLE_KEY:'synthetic-offline-build-not-a-key',
  STRIPE_SECRET_KEY:'sk_live_synthetic_not_real', STRIPE_WEBHOOK_SECRET:'whsec_synthetic_not_real',
  RESEND_API_KEY:'re_synthetic_not_real', NATORI_DELIVERY_NOTIFICATION_KEY:Buffer.alloc(32,7).toString('base64'),
};
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
execFileSync('npm', ['run','postinstall'], {cwd:app,env,stdio:'inherit'});
const started = Date.now();
const child = spawn('npm',['run','build'],{cwd:app,env,stdio:['ignore','pipe','pipe']});
let log='';
for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=data;process.stdout.write(data);});
const exitCode=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',done);});
writeFileSync(out+'/build.log',log);
writeFileSync(out+'/build-result.json',JSON.stringify({
  success:exitCode===0,exitCode,node:process.version,elapsedMs:Date.now()-started,
  phase:'managed',releaseCommands:true,paymentWorkspace:true,outbox:true,sending:true,deliveryIntegrity:true,
  quoteIntegrity:'unset',paymentLinkIntegrity:'unset',paymentIntegrity:'unset',stripeMode:'unset',
  source:'full app copied without env files; production fonts source unchanged',
  portfolioFontSourceSha256:sha(root+'/src/features/natori/components/portfolio/portfolioFonts.ts'),
  patchSha256:sha(root+'/patches/next+15.5.27.patch'),network:'all net.Socket.connect calls denied',
  substitutions:['synthetic target/owner and nonworking credentials','local font transport with suffixless path and existing Zen TTF fixture for all three families'],
  limitations:['not a hosted deployment','not a live DB/provider test','not a visual typography comparison','actual Google CSS/font retrieval blocked by CONNECT 403'],
},null,2)+'\n');
process.exitCode=exitCode??1;
