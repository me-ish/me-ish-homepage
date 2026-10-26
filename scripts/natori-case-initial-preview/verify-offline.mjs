// Full application build of the exact local no-cron package. No setup execution,
// external connections, real keys, server, provider, upload or deployment.
import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { plan } from './plan.mjs';
import { buildPackage } from './package.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(process.argv[2] ?? '');
const authentication = process.argv[3] === '--google' ? 'google' : 'password';
if (process.argv[3] && process.argv[3] !== '--google') throw Error('offline authentication profile invalid');
const manifest = buildPackage(out, { authentication }), app = out + '/full-app';
mkdirSync(app);
execFileSync('python', ['-c', 'import tarfile,sys;t=tarfile.open(sys.argv[1]);t.extractall(sys.argv[2],filter="data")', out + '/application-source.tar.gz', app]);
symlinkSync(root + '/node_modules', app + '/node_modules', 'dir');
writeFileSync(out + '/offline-fonts.cjs', "module.exports=new Proxy({}, {get(){return \"@font-face {font-family:'Zen Maru Gothic';src:local('Arial');} @font-face {font-family:'Lilita One';src:local('Arial');}\"}});\n");
const marker = JSON.stringify(plan.target);
const env = { PATH: dirname(process.execPath) + ':' + process.env.PATH, LANG: 'C.UTF-8', NODE_ENV: 'production', CI: '1',
  VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_PROJECT_ID: plan.target.project,
  NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '--require=' + root + '/scripts/natori-case-preview/deny-network.cjs',
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: out + '/offline-fonts.cjs', SUPABASE_URL: plan.target.url, NEXT_PUBLIC_SUPABASE_URL: plan.target.url,
  NEXT_PUBLIC_SITE_URL: plan.target.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-build-not-a-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-build-not-a-key',
  STRIPE_SECRET_KEY: 'sk_test_synthetic_offline_not_real', RESEND_API_KEY: 're_synthetic_offline_not_real',
  NATORI_CASE_ACCEPTANCE_TARGET: marker, NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET: marker,
  NATORI_CASE_DASHBOARD_PREVIEW_ENABLED: 'read-only', NATORI_NOTIFICATION_SENDING_ENABLED: '0' };
if (authentication === 'google') env.NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT = plan.target.endsAt;
const started = Date.now(), child = spawn('npm', ['run', 'build'], { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log += data; process.stdout.write(data); });
const exitCode = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); });
writeFileSync(out + '/build.log', log);
const result = { success: exitCode === 0, exitCode, node: process.version, elapsedMs: Date.now() - started,
  sourceArchiveSHA256: manifest.archiveSHA256, configuredCrons: 0, authentication, application: 'full source with dedicated read-only middleware overlay',
  network: 'all net.Socket.connect calls denied', credentials: 'nonworking fixture strings only', setupExecuted: false,
  uploaded: false, deployed: false, limitations: ['Google Font CSS replaced with local fallback', 'not hosted Node 22 acceptance',
    'no real Auth/DB/provider traffic', 'no hosted browser verification'] };
writeFileSync(out + '/build-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
process.exitCode = exitCode ?? 1;
