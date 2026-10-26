import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { NextRequest } from 'next/server.js';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertInitialPreviewPlatform } from './platform-gate.mjs';
import { plan } from './plan.mjs';
import { initialReadonlyDecision, INITIAL_READONLY_APIS } from './readonly-guard.ts';
import { buildPackage, readonlyMiddleware, readonlyLoginPage, readonlySessionLayout } from './package.mjs';

const root = resolve(import.meta.dirname, '../..');
const target = plan.target;
const env = () => ({ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_PROJECT_ID: target.project,
  SUPABASE_URL: target.url, NEXT_PUBLIC_SUPABASE_URL: target.url,
  NATORI_CASE_DASHBOARD_PREVIEW_ENABLED: 'read-only', NATORI_NOTIFICATION_SENDING_ENABLED: '0' });
const context = (pathname, method = 'GET') => ({ environment: 'preview', targetEnvironment: 'preview', project: target.project,
  databaseUrl: target.url, publicDatabaseUrl: target.url, origin: target.origin, pathname, method, imageSource: null });

test('standalone platform gate needs no dependency and accepts actual Preview metadata without secrets', () => {
  assert.deepEqual(assertInitialPreviewPlatform(env()), { environment: 'preview', project: target.project, databaseRef: target.ref });
  assertInitialPreviewPlatform({ ...env(), NODE_ENV: 'production' });
});
for (const [name, update] of [
  ['production', { VERCEL_ENV: 'production' }], ['missing environment', { VERCEL_ENV: undefined }],
  ['production target', { VERCEL_TARGET_ENV: 'production' }], ['missing target environment', { VERCEL_TARGET_ENV: undefined }],
  ['another project', { VERCEL_PROJECT_ID: 'prj_other' }], ['production database', { SUPABASE_URL: 'https://lvnfspyainrxtztjytbo.supabase.co' }],
  ['mismatched public database', { NEXT_PUBLIC_SUPABASE_URL: 'https://another.supabase.co' }],
  ['sender enabled', { NATORI_NOTIFICATION_SENDING_ENABLED: '1' }], ['write UI enabled', { NATORI_CASE_DASHBOARD_PREVIEW_ENABLED: '1' }],
]) test(`early gate denies ${name}`, () => assert.throws(() => assertInitialPreviewPlatform({ ...env(), ...update })));

const paths = [...INITIAL_READONLY_APIS, '/api/cron/natori-payment-expiry', '/api/cron/payout-reminder',
  '/api/cron/close-monthly-payout', '/api/cron/exhibit-delete', '/api/webhook/stripe', '/api/webhook/resend',
  '/api/natori/admin/order-mail', '/api/natori/admin/payment-link', '/api/natori/admin/notifications',
  '/api/natori/quote/accept', '/api/natori/delivery/accept', '/natori/dashboard/cases', '/natori/consult/token.with.dot',
  '/admin-login', '/_next/static/application.js', '/favicon.ico'];
test('Production or missing platform data denies every tested path and HTTP method before route handling', () => {
  for (const pathname of paths) for (const method of ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']) {
    for (const change of [{ environment: 'production' }, { targetEnvironment: 'production' }, { environment: undefined },
      { project: 'prj_other' }, { databaseUrl: 'https://lvnfspyainrxtztjytbo.supabase.co' }]) {
      assert.equal(initialReadonlyDecision({ ...context(pathname, method), ...change }, target), 503);
    }
  }
});
test('Preview rejects all mutations, including page/server-action POSTs and legacy or public APIs', () => {
  for (const pathname of paths) for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal(initialReadonlyDecision(context(pathname, method), target), 405);
  }
});
test('all Cron GET/HEAD routes are blocked even with valid Preview metadata', () => {
  for (const pathname of paths.filter(p => p.startsWith('/api/cron/'))) for (const method of ['GET', 'HEAD']) {
    assert.equal(initialReadonlyDecision(context(pathname, method), target), 404);
  }
});
test('only seven existing GET readers continue to their unchanged authentication and owner checks', () => {
  for (const pathname of INITIAL_READONLY_APIS) assert.equal(initialReadonlyDecision(context(pathname), target), null);
  for (const pathname of ['/api/natori/admin/case-payment', '/api/natori/admin/case-reconciliation',
    '/api/natori/admin/case-work', '/api/natori/admin/delivery-files', '/api/send-email/order',
    '/api/purchase/success', '/api/natori/admin/case-workspace/extra', '/api/natori/admin/case-workspace.json',
    '/auth/callback', '/auth/link', '/login']) {
    assert.equal(initialReadonlyDecision(context(pathname), target), 404);
  }
});
test('image optimizer cannot proxy providers, Storage, API endpoints or userinfo', () => {
  for (const imageSource of ['https://stripe.com/image.png', target.url + '/storage/v1/object/public/test/image.png',
    target.origin + '/api/natori/admin/portfolio-assets/image.png',
    'https://user:pass@' + new URL(target.origin).hostname + '/images/logo.png', '/images/../api/image.png']) {
    assert.equal(initialReadonlyDecision({ ...context('/_next/image'), imageSource }, target), 404);
  }
  assert.equal(initialReadonlyDecision({ ...context('/_next/image'), imageSource: '/images/logo.png' }, target), null);
});
test('exact origin remains necessary for reads', () => {
  assert.equal(initialReadonlyDecision({ ...context(INITIAL_READONLY_APIS[0]), origin: 'https://another.vercel.app' }, target), 503);
});
test('middleware overlay installs the guard before legacy logic and catches dotted paths without changing normal source', () => {
  const before = readFileSync(root + '/src/middleware.ts', 'utf8'), after = readonlyMiddleware(before);
  assert(after.indexOf('const initialStatus') < after.indexOf('if (caseAcceptanceConfigured())'));
  assert(after.includes("export const config = { matcher: ['/:path*'] };"));
  assert(!before.includes('initialReadonlyDecision'));
  assert.equal(readFileSync(root + '/src/middleware.ts', 'utf8'), before);
  assert.throws(() => readonlyMiddleware(before.replace('export const config = {', 'different config')), /source_changed/);
});
test('real overlaid middleware denies Production, Cron and writers; ordinary login/assets and GET auth flow remain reachable', async () => {
  const dir = mkdtempSync(tmpdir() + '/natori-overlay-middleware-');
  symlinkSync(root + '/node_modules', dir + '/node_modules', 'dir');
  await build({ stdin: { contents: readonlyMiddleware(readFileSync(root + '/src/middleware.ts', 'utf8')),
    resolveDir: root + '/src', sourcefile: 'middleware.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs',
    outfile: dir + '/middleware.cjs', tsconfig: root + '/tsconfig.json', external: ['next/*'], logLevel: 'silent',
    plugins: [{ name: 'dedicated-guard-source', setup(api) {
      api.onResolve({ filter: /^\.\/lib\/initialReadonlyPreviewGuard$/ }, () => ({ path: root + '/scripts/natori-case-initial-preview/readonly-guard.ts' }));
    } }] });
  const compiled = createRequire(import.meta.url)(dir + '/middleware.cjs');
  const changes = { ...env(), NATORI_CASE_ACCEPTANCE_TARGET: '', NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET: '', NATORI_DASHBOARD_KEY: '' };
  const prior = Object.fromEntries(Object.keys(changes).map(k => [k, process.env[k]]));
  try {
    Object.assign(process.env, changes);
    process.env.VERCEL_ENV = 'production';
    for (const pathname of paths) for (const method of ['GET', 'POST']) {
      const result = await compiled.default(new NextRequest(target.origin + pathname, { method }));
      assert.equal(result.status, 503); assert.equal(result.headers.get('x-middleware-next'), null);
    }
    process.env.VERCEL_ENV = 'preview';
    for (const pathname of ['/api/cron/natori-payment-expiry', '/api/cron/payout-reminder']) {
      assert.equal((await compiled.default(new NextRequest(target.origin + pathname))).status, 404);
    }
    for (const pathname of ['/api/natori/admin/case-system', '/natori/dashboard/cases', '/natori/consult/token.with.dot']) {
      assert.equal((await compiled.default(new NextRequest(target.origin + pathname, { method: 'POST' }))).status, 405);
    }
    for (const pathname of ['/admin-login', '/_next/static/application.js', '/favicon.ico', INITIAL_READONLY_APIS[0]]) {
      const result = await compiled.default(new NextRequest(target.origin + pathname));
      assert.equal(result.headers.get('x-middleware-next'), '1');
      assert.equal(result.headers.get('x-middleware-rewrite'), null);
    }
    assert.deepEqual(compiled.config.matcher, ['/:path*']);
  } finally { for (const [k, v] of Object.entries(prior)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
test('Production early-gate process exits before a chained setup/install continuation can run', () => {
  const dir = mkdtempSync(tmpdir() + '/natori-gate-proof-');
  const sentinel = dir + '/should-not-exist';
  const child = spawnSync('bash', ['-c', '"$1" "$2" && "$1" -e \'require("fs").writeFileSync(process.argv[1],"ran")\' "$3"',
    'initial-gate', process.execPath, root + '/scripts/natori-case-initial-preview/platform-gate.mjs', sentinel],
  { env: { PATH: process.env.PATH, ...env(), VERCEL_ENV: 'production' }, encoding: 'utf8' });
  assert.equal(child.status, 1); assert(child.stderr.includes('platform_gate_denied'));
  assert.throws(() => readFileSync(sentinel)); assert(!child.stdout.includes('preview'));
});
test('dedicated package and inline request both contain zero Cron definitions and guarded commands', () => {
  const parent = mkdtempSync(tmpdir() + '/natori-no-cron-package-'), out = parent + '/package';
  const before = readFileSync(root + '/vercel.json', 'utf8');
  const manifest = buildPackage(out), request = JSON.parse(readFileSync(out + '/deployment-request.json'));
  assert.equal(manifest.configuredCrons, 0); assert.equal(request.target, undefined);
  const inline = JSON.parse(Buffer.from(request.files.find(f => f.file === 'vercel.json').data, 'base64'));
  assert.deepEqual(inline.crons, []); assert(!request.customEnvironmentSlugOrId); assert(!request.deploymentId);
  assert(request.projectSettings.installCommand.startsWith('node preview-platform-gate.mjs && '));
  assert(request.projectSettings.buildCommand.startsWith('node preview-platform-gate.mjs && '));
  const archive = execFileSync('python', ['-c', 'import tarfile,json,sys;t=tarfile.open(sys.argv[1]);print(t.extractfile("vercel.json").read().decode())', out + '/application-source.tar.gz']).toString();
  assert.deepEqual(JSON.parse(archive).crons, []);
  assert.equal(readFileSync(root + '/vercel.json', 'utf8'), before);
  assert.equal(JSON.parse(before).crons.length, 3);
  assert.equal(manifest.uploaded, false); assert.equal(manifest.deployed, false);
  const members = JSON.parse(readFileSync(out + '/archive-members.json'));
  const client = members.overlays['src/app/admin-login/AdminLoginClient.tsx'];
  assert(client.includes('signInWithPassword')); assert(!client.includes('signInWithOAuth'));
  assert(!client.includes('SUPABASE_SERVICE_ROLE_KEY')); assert(!client.includes('NATORI_CASE_INITIAL_PREVIEW_PASSWORDS'));
  assert(!client.includes(plan.actors.staff.email)); // Nonsecret actor props are server supplied.
  const page = members.overlays['src/app/admin-login/page.tsx'];
  assert(page.indexOf('assertInitialPreviewPlatform(process.env)') < page.indexOf('await supabaseServer()'));
  assert(page.includes(JSON.stringify(plan.target)));
  assert(page.includes(plan.actors.staff.email)); assert(!page.includes('passwords'));
  assert.equal(readFileSync(root + '/src/app/admin-login/AdminLoginClient.tsx', 'utf8').includes('signInWithOAuth'), true);
});
test('login overlay keeps exact platform validation and normal session reading, with a reachable logout entry', () => {
  const page = readonlyLoginPage();
  assert(page.includes('client.auth.getUser()')); assert(page.includes('notFound()'));
  assert(!page.includes('signInWithPassword')); assert(!page.includes('admin.createUser'));
  const source = readFileSync(root + '/src/app/[locale]/natori/dashboard/layout.tsx', 'utf8');
  const layout = readonlySessionLayout(source);
  assert(layout.includes('await requireNatoriAccess("/natori/dashboard")'));
  assert(layout.includes('<Link href="/admin-login"')); assert(!source.includes('検証セッション'));
  assert.throws(() => readonlySessionLayout('unrecognized layout'), /source_changed/);
});
