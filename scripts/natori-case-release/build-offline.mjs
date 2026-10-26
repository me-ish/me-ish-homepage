import {mkdirSync, copyFileSync, writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {prepare, root} from '../natori-case-local-auth/prepare.mjs';

// Local build only: never receives a real target, credential or output deployment.
const out = resolve(process.argv[2] ?? '');
if (!out.startsWith('/workspace/') && !out.startsWith('/tmp/')) throw Error('new local output required');
mkdirSync(out);
const {app} = await prepare(out);
mkdirSync(app + '/scripts');
copyFileSync(root + '/scripts/build-bank-json.mjs', app + '/scripts/build-bank-json.mjs');
const target = {profile:'production', ref:'abcdefghijklmnopqrst', project:'prj_synthetic',
  origin:'https://release.example.invalid', owner:'22222222-2222-4222-8222-222222222222'};
const env = {
  PATH:dirname(process.execPath) + ':' + process.env.PATH, LANG:'C.UTF-8', NODE_ENV:'production',
  NEXT_TELEMETRY_DISABLED:'1', CI:'1',
  NODE_OPTIONS:'--require=' + root + '/scripts/natori-case-preview/deny-network.cjs',
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES:out + '/offline-fonts.cjs',
  VERCEL_ENV:'production', VERCEL_PROJECT_ID:target.project,
  NATORI_CASE_RELEASE_ENABLED:'1', NATORI_CASE_RELEASE_TARGET:JSON.stringify(target),
  NATORI_CASE_BOOTSTRAP_PHASE:'hold',
  NATORI_CASE_DASHBOARD_PREVIEW_ENABLED:'read-only', NATORI_OWNER_USER_ID:target.owner,
  NEXT_PUBLIC_SUPABASE_URL:`https://${target.ref}.supabase.co`, SUPABASE_URL:`https://${target.ref}.supabase.co`,
  NEXT_PUBLIC_SITE_URL:target.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-offline-build-not-a-key',
  SUPABASE_SERVICE_ROLE_KEY:'synthetic-offline-build-not-a-key',
  STRIPE_SECRET_KEY:'rk_live_synthetic_not_real', RESEND_API_KEY:'re_synthetic_not_real',
};
const started = Date.now();
const child = spawn('npm', ['run','build'], {cwd:app, env, stdio:['ignore','pipe','pipe']});
let log = '';
for (const stream of [child.stdout,child.stderr]) stream.on('data', data => {log += data; process.stdout.write(data);});
const exitCode = await new Promise((done,reject) => {child.once('error',reject); child.once('exit',done);});
writeFileSync(out + '/build.log', log);
writeFileSync(out + '/build-result.json', JSON.stringify({
  success:exitCode === 0, exitCode, node:process.version, elapsedMs:Date.now() - started,
  fullApplication:true, target:'synthetic production profile; no real project or DB',
  network:'all net.Socket.connect calls denied', commands:false, inspection:false, providerStop:false,
  substitutions:['nonworking fixture strings only','offline Google Font CSS local fallback'],
  limitations:['not a deployment or browser acceptance','not real Auth/DB/provider/Storage traffic',
    'not the final target/main/DB-compatible production artifact','Node 22 verification only if node field reports that runtime'],
}, null, 2) + '\n');
process.exitCode = exitCode ?? 1;
