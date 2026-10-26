// Loopback-only Google/PKCE UI/SDK/cookie regression. Auth HTTP and case data are doubles;
// this is not a hosted Supabase, full Next middleware or real-provider test.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readonlyGoogleCallback } from './package.mjs';
import { plan } from './plan.mjs';
import { googlePlan } from './google-plan.mjs';
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

const root = resolve(import.meta.dirname, '../..'), out = resolve(process.argv[2] ?? '');
if (!out.startsWith('/workspace/') && !out.startsWith('/tmp/')) throw Error('fresh local evidence directory required');
mkdirSync(out, { mode: 0o700 });
const cookieContext = new AsyncLocalStorage();
globalThis.__initialPreviewCookieContext = cookieContext;
const staff = { id: randomUUID(), email: googlePlan.email, label: '担当者（閲覧確認）' };
const outsider = { id: randomUUID(), email: 'outsider@example.invalid', label: '権限なし（拒否確認用）' };
const tickets = new Map();
let providerActor = staff;
const sessions = new Map(), checks = [], requests = [];
let app, bundle, operator, browser, stage = 'starting', external = 0;
let response;
const record = name => { checks.push(name); console.log('PASS', name); };
const json = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Supabase-Api-Version': '2024-01-01' }); res.end(JSON.stringify(value)); };
const cssRoot = resolve(process.argv[3] ?? '', 'full-app/.next/static/css');
const css = readdirSync(cssRoot).filter(name => name.endsWith('.css')).map(name => readFileSync(cssRoot + '/' + name, 'utf8')).join('\n');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, app), path = url.pathname;
    requests.push({ method: req.method, path }); // Never headers, query, body or tokens.
    if (path === '/auth/v1/authorize' && req.method === 'GET') {
      assert.equal(url.searchParams.get('provider'), 'google');
      assert.equal(url.searchParams.get('redirect_to'), app + '/auth/callback');
      assert.equal(url.searchParams.get('code_challenge_method'), 's256');
      assert.equal(url.searchParams.get('prompt'), 'select_account');
      assert.equal(url.searchParams.get('scopes'), 'openid email profile');
      const challenge = url.searchParams.get('code_challenge'); assert(challenge);
      const code = randomBytes(24).toString('hex');
      tickets.set(code, { challenge, actor: providerActor });
      res.writeHead(302, { Location: app + '/auth/callback?code=' + code }); return res.end();
    }
    if (path === '/auth/v1/token' && req.method === 'POST') {
      if (url.search !== '?grant_type=pkce') return json(res, 400, { error: 'fixture_grant_denied' });
      let bytes = ''; for await (const chunk of req) { bytes += chunk; if (bytes.length > 4096) throw Error('fixture input too large'); }
      const input = JSON.parse(bytes), ticket = tickets.get(input.auth_code); tickets.delete(input.auth_code);
      if (!ticket || typeof input.code_verifier !== 'string'
        || createHash('sha256').update(input.code_verifier).digest('base64url') !== ticket.challenge) return json(res, 400, { error: 'fixture_pkce_invalid' });
      const actor = ticket.actor, now = Math.floor(Date.now() / 1000);
      const user = { id: actor.id, email: actor.email, aud: 'authenticated', role: 'authenticated',
        app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: {}, created_at: '2026-10-24T00:00:00Z',
        email_confirmed_at: '2026-10-24T00:00:00Z', identities: [{ provider: 'google', identity_data: { email: actor.email, email_verified: true } }] };
      const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.'
        + Buffer.from(JSON.stringify({ sub: actor.id, email: actor.email, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })).toString('base64url')
        + '.syntheticSignatureNotValidOutsideFixture';
      sessions.set(token, user);
      return json(res, 200, { access_token: token, refresh_token: randomBytes(24).toString('hex'), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user });
    }
    if (path === '/auth/v1/user') {
      const user = sessions.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      return json(res, user ? 200 : 401, user ?? { code: 'bad_jwt', message: 'fixture session missing' });
    }
    if (path === '/auth/v1/logout' && req.method === 'POST' && url.search === '?scope=local') {
      sessions.delete((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      return json(res, 200, {});
    }
    if (path === '/rest/v1/admin_emails' && req.method === 'GET') return json(res, 200, []);
    if (path === '/ui.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(bundle); }
    if (path === '/ui.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (path === '/favicon.ico') { res.statusCode = 204; return res.end(); }
    if (req.method !== 'GET') return json(res, 405, {});
    const values = new Map(parseCookieHeader(req.headers.cookie ?? '').map(row => [row.name, row.value]));
    const cookies = { getAll: () => [...values].map(([name, value]) => ({ name, value })),
      get: name => values.has(name) ? { name, value: values.get(name) } : undefined,
      set: (name, value, options) => { values.set(name, value); res.appendHeader('Set-Cookie', serializeCookieHeader(name, value, options)); } };
    if (path === '/auth/callback') {
      const response = await cookieContext.run(cookies, () => operator.callback(new Request(app + req.url)));
      res.writeHead(response.status, Object.fromEntries(response.headers)); return res.end();
    }
    const identity = await cookieContext.run(cookies, () => operator.resolveNatoriOperator());
    const allowed = identity?.kind === 'auth-user' && identity.userId === staff.id;
    if (path === '/natori/dashboard/cases') {
      if (!allowed) { res.writeHead(302, { Location: '/admin-login?err=unauthorized' }); return res.end(); }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<!doctype html><html lang="ja"><link rel="stylesheet" href="/ui.css"><main class="p-4"><h1>見積承諾済み・案内未送信</h1><p>合成案件の読取fixtureです。</p><a href="/admin-login">検証ログイン・ログアウト</a></main></html>');
    }
    if (path === '/api/natori/admin/case-workspace') return json(res, allowed ? 200 : 401, allowed ? { fixtureOnly: true, records: ['synthetic-owned-case'] } : {});
    if (path !== '/admin-login') return json(res, 404, {});
    const currentEmail = await cookieContext.run(cookies, () => operator.currentEmail());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"><main class="px-4 pt-8"><div id="root"></div></main><script>window.__fixtureEmail=' + JSON.stringify(currentEmail) + '</script><script src="/ui.js"></script></html>');
  } catch { json(res, 500, { error: 'fixture_server_error' }); }
});

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  app = `http://127.0.0.1:${server.address().port}`;
  const target = { profile: 'local', ref: 'local', project: 'local-fixture', url: app, origin: app, run: randomUUID(), startsAt: '2026-10-23T23:30:00Z', endsAt: '2026-10-25T00:00:00Z' };
  Object.assign(process.env, { SUPABASE_URL: app, NEXT_PUBLIC_SUPABASE_URL: app, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-not-an-external-key',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-not-an-external-key', NATORI_STAFF_EMAILS: staff.email, NATORI_OWNER_EMAILS: '', ADMIN_EMAILS: '', NATORI_DASHBOARD_KEY: '',
    VERCEL_ENV: '', NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT: plan.target.endsAt,
    NATORI_CASE_ACCEPTANCE_TARGET: JSON.stringify(target), NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET: JSON.stringify(target) });
  symlinkSync(root + '/node_modules', out + '/node_modules', 'dir');
  stage = 'compile real authorization helper and PKCE callback with explicit loopback-only platform/origin substitutes';
  const localCallback = readonlyGoogleCallback(readFileSync(root + '/src/app/auth/callback/route.ts', 'utf8')).replace(JSON.stringify(plan.target.origin), JSON.stringify(app)).replace('export async function GET(req: Request)', 'export async function callback(req: Request)');
  await build({ stdin: { contents: localCallback + "\nexport {resolveNatoriOperator} from '@/features/natori/server/requireNatoriAdmin';import {supabaseServer} from '@/lib/supabaseServer';export async function currentEmail(){const c=await supabaseServer();const {data:{user},error}=await c.auth.getUser();return error?null:user?.email??null}", resolveDir: root + '/src/app/auth/callback', loader: 'ts' }, outfile: out + '/operator.cjs', bundle: true,
    platform: 'node', format: 'cjs', packages: 'external', tsconfig: root + '/tsconfig.json', logLevel: 'silent', plugins: [{ name: 'loopback-cookie-adapter', setup(api) {
      api.onResolve({ filter: /platform-gate\.mjs$/ }, () => ({ path: 'platform', namespace: 'fixture' }));
      api.onResolve({ filter: /^server-only$/ }, () => ({ path: 'empty', namespace: 'fixture' }));
      api.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'cookies', namespace: 'fixture' }));
      api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'empty' ? '' : args.path === 'platform' ? 'export function assertInitialPreviewPlatform(){}' : 'export async function cookies(){return globalThis.__initialPreviewCookieContext.getStore()}' }));
    } }] });
  operator = createRequire(import.meta.url)(out + '/operator.cjs');
  const built = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Login from './scripts/natori-case-initial-preview/google-login.client';createRoot(document.getElementById('root')).render(React.createElement(Login,{target:${JSON.stringify(target)},currentEmail:window.__fixtureEmail}));`, resolveDir: root, loader: 'tsx' },
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false, logLevel: 'silent', define: {
      'process.env.NODE_ENV': JSON.stringify('production'), 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(app),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('synthetic-public-not-an-external-key'),
      'process.env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET': JSON.stringify(JSON.stringify(target)),
    } });
  bundle = built.outputFiles[0].text;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.route('**/*', async route => { if (new URL(route.request().url()).origin !== app) { external++; await route.abort(); } else await route.continue(); });
  const page = await context.newPage();
  stage = 'unauthenticated and invalid callback';
  await page.goto(app + '/auth/callback?code=unknown-fixture-code');
  await page.getByText('Google認証を確認できませんでした。同じブラウザでログインからやり直してください。').waitFor();
  assert.equal(await page.evaluate(async () => (await fetch('/api/natori/admin/case-workspace')).status), 401);
  record('invalid code without a valid PKCE verifier establishes no case access');
  stage = 'staff PKCE cookie and server authorization';
  await page.getByRole('button', { name: 'Googleでログイン', exact: true }).click();
  await page.getByRole('heading', { name: '見積承諾済み・案内未送信' }).waitFor();
  assert.equal(await page.evaluate(async () => (await fetch('/api/natori/admin/case-workspace')).status), 200);
  assert.equal(tickets.size, 0);
  record('actual browser SDK challenge matches server SDK verifier; callback cookies reach existing staff authorization');
  await page.screenshot({ path: out + '/pc-case-fixture.png', fullPage: true });
  stage = 'logout';
  await page.getByRole('link', { name: '検証ログイン・ログアウト' }).click();
  await Promise.all([page.waitForEvent('domcontentloaded'), page.getByRole('button', { name: 'ログアウト', exact: true }).click()]);
  await page.waitForFunction(() => !document.body.textContent.includes('現在のログイン:'));
  assert.equal(await page.evaluate(async () => (await fetch('/api/natori/admin/case-workspace')).status), 401);
  record('normal local signout removes browser Auth access and server rejects the next read');
  stage = 'mobile and nonstaff';
  await page.setViewportSize({ width: 390, height: 844 });
  providerActor = outsider;
  await page.getByRole('button', { name: 'Googleでログイン', exact: true }).click();
  await page.getByText('このGoogleアカウントには検証案件の閲覧権限がありません。').waitFor();
  assert.equal(await page.evaluate(async () => (await fetch('/api/natori/admin/case-workspace')).status), 401);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.screenshot({ path: out + '/mobile-login-fixture.png', fullPage: true });
  record('mobile UI stays within viewport; successful nonstaff Auth never grants case access');
  await Promise.all([page.waitForEvent('domcontentloaded'), page.getByRole('button', { name: 'ログアウト', exact: true }).click()]);
  await page.waitForFunction(() => !document.body.textContent.includes('現在のログイン:'));
  assert.equal(sessions.size, 0); assert.equal(external, 0);
  assert(requests.every(row => row.method === 'GET' || row.path === '/auth/v1/token' || row.path === '/auth/v1/logout'));
  record('fixture sessions closed; no business writes or external requests');
  response = { success: true, checks, externalRequests: external, fixtureSessionsRemaining: sessions.size,
    real: ['compiled Google component', 'PKCE challenge/verifier through real browser and server SDK', 'callback exchange logic', 'production CSS from offline package', 'browser Supabase SSR client/cookies', 'server Supabase SSR getUser client', 'existing staff authorization code'],
    substitutes: ['loopback authorize/token/user HTTP doubles, not Google or GoTrue', 'callback platform gate/origin replaced only in this fixture; actual hosted gate tested separately', 'case data/HTTP page double, not normal Next/DB reader', 'Next cookies adapted to loopback request', 'local target props; actual hosted gate covered separately'],
    hostedLoginVerified: false, realIPhoneVerified: false };
} catch {
  response = { success: false, failedStage: stage, completedChecks: checks, externalRequests: external, hostedLoginVerified: false };
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  writeFileSync(out + '/browser-result.json', JSON.stringify({ ...response, loopbackServerClosed: true }, null, 2));
  console.log(JSON.stringify({ success: response?.success ?? false, checks: checks.length, failedStage: response?.failedStage, externalRequests: external, loopbackServerClosed: true }));
}
