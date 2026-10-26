import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { NextRequest } from 'next/server.js';
import { plan } from './plan.mjs';
import { googlePlan } from './google-plan.mjs';
import { GOOGLE_READ_ENDS_AT, googleReadAccessAllowed } from './google-deadline.mjs';
import { fixtureRows } from './setup.mjs';
import { verifyGooglePreview, validateGoogleUsers } from './google-preflight.mjs';
import { initialReadonlyDecision } from './readonly-guard.ts';
import { buildPackage, readonlyGoogleCallback, readonlyMiddleware } from './package.mjs';
import { privateLaunchers } from './launchers.mjs';
const root = resolve(import.meta.dirname, '../..'), now = Date.parse('2026-10-24T03:00:00Z');
const env = () => ({ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_PROJECT_ID: plan.target.project,
  SUPABASE_URL: plan.target.url, NEXT_PUBLIC_SUPABASE_URL: plan.target.url, NEXT_PUBLIC_SITE_URL: plan.target.origin,
  NATORI_CASE_INITIAL_PREVIEW_SETUP: plan.target.run, NATORI_CASE_ACCEPTANCE_TARGET: JSON.stringify(plan.target), NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET: JSON.stringify(plan.target),
  NATORI_OWNER_USER_ID: plan.actors.owner.id, NATORI_STAFF_EMAILS: googlePlan.staffEmails.join(','),
  NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT: GOOGLE_READ_ENDS_AT,
  NATORI_CASE_ACCEPTANCE_MAIL_SCOPE: plan.scope, NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT: plan.account,
  NATORI_CASE_DASHBOARD_PREVIEW_ENABLED: 'read-only', NATORI_NOTIFICATION_SENDING_ENABLED: '0',
  STRIPE_SECRET_KEY: 'sk_test_synthetic_offline_not_real', RESEND_API_KEY: 're_synthetic_offline_not_real', SUPABASE_SERVICE_ROLE_KEY: 'nonworking-service-fixture-only' });
const users = () => Object.values(plan.actors).map(actor => ({ ...actor, role: 'authenticated', email_confirmed_at: plan.target.startsAt,
  app_metadata: { natori_initial_preview_run: plan.target.run } }));
const googleUser = () => ({ id: '3c1690fb-35f4-4e8a-9794-6a2f70cc36b4', email: googlePlan.email, role: 'authenticated', email_confirmed_at: plan.target.startsAt,
  identities: [{ provider: 'google', identity_data: { email: googlePlan.email, email_verified: true } }] });
function fixture() {
  const rows = fixtureRows(), identities = users(), calls = [], settings = { external: { google: true }, disable_signup: false };
  const details = new Map([[googleUser().id, googleUser()]]);
  // Independent postcondition of the ordinary DB quote-insert trigger, followed
  // by setup's synthetic acceptance binding. Not an app action or real consent.
  Object.assign(rows.natori_projects[0], { next_action: '見積りの承諾待ち', active_quote_id: plan.quote,
    quote_accepted_at: plan.fixtureTimes.acceptedAt, quote_accepted_amount: 12000, updated_at: new Date(now).toISOString() });
  return { rows, identities, details, calls, settings, async fetch(address, options) {
    calls.push({ address, method: options.method });
    assert.equal(options.method, 'GET'); assert.equal(options.body, undefined); assert.equal(options.redirect, 'error');
    assert.equal(new URL(address).origin, plan.target.url);
    const url = new URL(address);
    if (url.pathname === '/auth/v1/settings') return Response.json(settings);
    if (url.pathname === '/auth/v1/admin/users') return Response.json({ users: identities, total: identities.length });
    if (url.pathname === `/auth/v1/admin/users/${googleUser().id}`) {
      return details.has(googleUser().id) ? Response.json(details.get(googleUser().id)) : Response.json({}, { status: 404 });
    }
    const value = rows[url.pathname.split('/').pop()]; assert(value);
    return Response.json(value, { headers: { 'content-range': `0-${value.length - 1}/${value.length}` } });
  } };
}
test('Google preflight is GET-only and accepts existing three plus optional one verified Google identity without passwords', async () => {
  const f = fixture(), before = JSON.stringify(f.rows);
  assert.equal((await verifyGooglePreview(env(), f.fetch, now)).googleUserPresent, false);
  f.identities.push(googleUser());
  const result = await verifyGooglePreview(env(), f.fetch, now);
  assert.equal(result.googleUserPresent, true); assert.equal(result.mutations, 0);
  assert.equal(JSON.stringify(f.rows), before); assert.equal(f.calls.length, 13);
  assert(!JSON.stringify(result).includes(googlePlan.email));
});
for (const shape of ['omitted', 'null', 'empty']) test(`a legitimate Google user with ${shape} list identities is verified by exact private GET`, async () => {
  const f = fixture(), user = googleUser();
  if (shape === 'omitted') delete user.identities;
  else user.identities = shape === 'null' ? null : [];
  f.identities.push(user);
  const before = JSON.stringify(f.rows), result = await verifyGooglePreview(env(), f.fetch, now);
  assert.equal(result.googleUserPresent, true); assert.equal(result.googleIdentityCheck, 'exact-admin-user-get');
  assert.equal(result.mutations, 0); assert.equal(f.calls.length, 7);
  assert.equal(f.calls.filter(call => new URL(call.address).pathname === `/auth/v1/admin/users/${user.id}`).length, 1);
  assert(f.calls.every(call => call.method === 'GET')); assert.equal(JSON.stringify(f.rows), before);
  assert(!JSON.stringify(result).includes(user.id));
});
for (const [name, mutate] of [
  ['missing detail', f => f.details.delete(googleUser().id)],
  ['null detail', f => f.details.set(googleUser().id, null)],
  ['wrong user detail', f => f.details.get(googleUser().id).id = plan.actors.outsider.id],
  ['wrong email detail', f => f.details.get(googleUser().id).email = 'other@example.invalid'],
  ['unconfirmed detail', f => f.details.get(googleUser().id).email_confirmed_at = null],
  ['wrong role detail', f => f.details.get(googleUser().id).role = 'service_role'],
  ['missing identity in detail', f => f.details.get(googleUser().id).identities = []],
  ['unverified Google identity', f => f.details.get(googleUser().id).identities[0].identity_data.email_verified = false],
  ['wrong provider detail', f => f.details.get(googleUser().id).identities[0].provider = 'email'],
  ['wrong identity email', f => f.details.get(googleUser().id).identities[0].identity_data.email = 'other@example.invalid'],
  ['forged user metadata', f => { const d = f.details.get(googleUser().id); d.identities = []; d.user_metadata = { provider: 'google', email_verified: true }; }],
]) test(`list projection tolerance still rejects ${name}`, async () => {
  const f = fixture(); f.identities.push({ ...googleUser(), identities: null }); mutate(f);
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now));
  assert(f.calls.every(call => call.method === 'GET'));
  assert.equal(f.calls.length, 3);
});
test('a detail timeout is not retried and never logs or returns its sensitive error', async () => {
  const f = fixture(); f.identities.push({ ...googleUser(), identities: [] }); let requests = 0;
  await assert.rejects(verifyGooglePreview(env(), async (url, options) => {
    if (new URL(url).pathname === `/auth/v1/admin/users/${googleUser().id}`) { requests++; throw Error('private provider response'); }
    return f.fetch(url, options);
  }, now), { message: 'google_preflight_read_unconfirmed' });
  assert.equal(requests, 1);
});
test('a contradictory populated list identity is rejected even when detail matches', async () => {
  const f = fixture(), user = googleUser(); user.identities[0].provider = 'email'; f.identities.push(user);
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now), /unexpected_identity/);
});
test('even a populated index cannot replace the required individual user response', () => {
  assert.throws(() => validateGoogleUsers({ users: [...users(), googleUser()], total: 4 }), /google_detail_mismatch/);
});
for (const [name, change] of [
  ['Production', e => e.VERCEL_ENV = 'production'], ['wrong project', e => e.VERCEL_PROJECT_ID = 'prj_wrong'],
  ['production DB', e => e.SUPABASE_URL = 'https://lvnfspyainrxtztjytbo.supabase.co'],
  ['wrong owner', e => e.NATORI_OWNER_USER_ID = googleUser().id], ['missing staff', e => e.NATORI_STAFF_EMAILS = plan.actors.staff.email],
  ['extra staff', e => e.NATORI_STAFF_EMAILS += ',unapproved@example.invalid'], ['key bypass', e => e.NATORI_DASHBOARD_KEY = 'not-a-real-key'],
  ['sending enabled', e => e.NATORI_NOTIFICATION_SENDING_ENABLED = '1'],
]) test(`Google preflight stops ${name} before any network`, async () => {
  const f = fixture(), input = env(); change(input);
  await assert.rejects(verifyGooglePreview(input, f.fetch, now)); assert.equal(f.calls.length, 0);
});
test('Google provider must already be enabled; preflight never configures it', async () => {
  const f = fixture(); f.settings.external.google = false;
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now), /provider_not_enabled/);
  assert.equal(f.calls.length, 1);
});
test('first Google login requires existing signup permission; an existing verified Google user needs no new signup', async () => {
  const f = fixture(); f.settings.disable_signup = true;
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now), /initial_signup_disabled/);
  assert.equal(f.calls.length, 2);
  f.identities.push(googleUser());
  assert.equal((await verifyGooglePreview(env(), f.fetch, now)).googleUserPresent, true);
});
test('unknown/duplicate/unverified identities and partial Auth lists are rejected without adopting user metadata', () => {
  for (const extra of [{ ...googleUser(), email: 'other@example.invalid' }, { ...googleUser(), identities: [], user_metadata: { provider: 'google', email_verified: true } },
    { ...googleUser(), email_confirmed_at: null }, { ...googleUser(), role: 'service_role' }]) {
    assert.throws(() => validateGoogleUsers({ users: [...users(), extra], total: 4 }));
  }
  assert.throws(() => validateGoogleUsers({ users: users(), total: 4 }));
  assert.throws(() => validateGoogleUsers({ users: [...users(), users()[0]], total: 4 }));
  assert.throws(() => validateGoogleUsers({ users: users().slice(1), total: 2 }));
});
test('fixture changes, incomplete rows and missing quote binding abort without repair', async () => {
  for (const change of [f => f.rows.natori_projects[0].user_id = googleUser().id, f => f.rows.natori_projects.pop(),
    f => f.rows.natori_case_acceptance_runs[0].enabled = true, f => f.rows.natori_projects[0].active_quote_id = null]) {
    const f = fixture(); change(f); await assert.rejects(verifyGooglePreview(env(), f.fetch, now)); assert(f.calls.every(c => c.method === 'GET'));
  }
});
test('quote-trigger hint is checked exactly for its one registered fixture without changing initial insert rows', async () => {
  const initial = JSON.stringify(fixtureRows()), f = fixture();
  assert.equal((await verifyGooglePreview(env(), f.fetch, now)).mutations, 0);
  assert.equal(f.calls.length, 6);
  assert.equal(JSON.stringify(fixtureRows()), initial);
  assert(fixtureRows().natori_projects.every(project => project.next_action === ''));
  for (const [index, hint] of [[0, ''], [0, 'arbitrary note'], [0, '見積り承諾済み・支払案内待ち'],
    [1, '見積りの承諾待ち'], [2, '見積りの承諾待ち']]) {
    const changed = fixture(); changed.rows.natori_projects[index].next_action = hint;
    await assert.rejects(verifyGooglePreview(env(), changed.fetch, now), /fixture_changed/);
    assert(changed.calls.every(call => call.method === 'GET'));
  }
});
test('PostgREST timestamp offsets, row order and generated audit fields do not cause another false mismatch', async () => {
  const f = fixture();
  for (const rows of Object.values(f.rows)) {
    rows.reverse();
    for (const row of rows) {
      row.created_at ??= '2026-10-24T02:00:00+00:00'; row.updated_at = new Date(now).toISOString();
      for (const key of Object.keys(row)) if (key.endsWith('_at') && typeof row[key] === 'string') row[key] = row[key].replace(/Z$/, '+00:00');
    }
  }
  const before = JSON.stringify(f.rows);
  assert.equal((await verifyGooglePreview(env(), f.fetch, now)).mutations, 0);
  assert.equal(JSON.stringify(f.rows), before);
});
test('the reported backwards issue/accept times fail closed with no fixture repair', async () => {
  const f = fixture();
  f.rows.natori_quotes[0].issued_at = plan.target.startsAt;
  f.rows.natori_quotes[0].accepted_at = plan.target.startsAt;
  f.rows.natori_projects[0].quote_accepted_at = plan.target.startsAt;
  const before = JSON.stringify(f.rows);
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now), /google_preflight_fixture_chronology/);
  assert.equal(JSON.stringify(f.rows), before); assert(f.calls.every(call => call.method === 'GET'));
});
for (const [name, mutate] of [
  ['missing creation time', f => delete f.rows.natori_quotes[0].created_at],
  ['invalid calendar date', f => f.rows.natori_quotes[0].created_at = '2026-02-30T00:00:00Z'],
  ['future issue', f => f.rows.natori_quotes[0].issued_at = '2026-10-24T04:00:00Z'],
  ['acceptance before issue', f => f.rows.natori_quotes[0].accepted_at = '2026-10-24T02:22:50.910863Z'],
  ['submillisecond acceptance disagreement', f => f.rows.natori_projects[0].quote_accepted_at = '2026-10-24T02:22:52.306409Z'],
  ['project update before acceptance', f => f.rows.natori_projects[0].updated_at = '2026-10-24T02:22:50.910864Z'],
]) test(`semantic preflight rejects ${name} without writes`, async () => {
  const f = fixture(); mutate(f); const before = JSON.stringify(f.rows);
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now), /google_preflight_fixture_chronology/);
  assert.equal(JSON.stringify(f.rows), before); assert(f.calls.every(call => call.method === 'GET'));
});
test('coherent but changed fixed creation microseconds still fail exact fixture checks', async () => {
  const f = fixture(); f.rows.natori_projects[0].created_at = '2026-10-24T02:22:50.314356Z';
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now), /fixture_changed/);
  assert(f.calls.every(call => call.method === 'GET'));
});
for (const [name, mutate] of [
  ['wrong quote project', f => f.rows.natori_quotes[0].project_id = plan.projects.unregistered],
  ['wrong quote owner', f => f.rows.natori_quotes[0].user_id = plan.actors.outsider.id],
  ['wrong quote ID', f => f.rows.natori_quotes[0].id = plan.projects.foreign],
  ['different quote version', f => f.rows.natori_quotes[0].version = 2],
  ['different quote amount', f => f.rows.natori_quotes[0].amount = 13000],
  ['missing quote acceptance', f => f.rows.natori_quotes[0].accepted_at = null],
  ['missing project acceptance', f => f.rows.natori_projects[0].quote_accepted_at = null],
  ['different accepted amount', f => f.rows.natori_projects[0].quote_accepted_amount = 13000],
  ['changed quote expiry', f => f.rows.natori_quotes[0].expires_at = '2026-10-26T00:00:00Z'],
  ['payment link already present', f => f.rows.natori_projects[0].payment_link_id = 'synthetic-unexpected-link'],
  ['manual payment already recorded', f => f.rows.natori_projects[0].payment_confirmed_at = plan.target.startsAt],
  ['provider payment already recorded', f => f.rows.natori_projects[0].paid_at = plan.target.startsAt],
  ['mail attempts consumed', f => f.rows.natori_case_acceptance_runs[0].used = 1],
  ['human operations consumed', f => f.rows.natori_case_acceptance_runs[0].human_used = 1],
  ['wrong registered membership', f => f.rows.natori_case_acceptance_projects[0].project_id = plan.projects.unregistered],
  ['missing expected field', f => delete f.rows.natori_projects[0].paid_at],
]) test(`correcting the trigger hint still stops ${name}`, async () => {
  const f = fixture(); mutate(f);
  const before = JSON.stringify(f.rows);
  await assert.rejects(verifyGooglePreview(env(), f.fetch, now));
  assert.equal(JSON.stringify(f.rows), before); assert(f.calls.every(call => call.method === 'GET'));
});
test('only the Google package opens exact GET callback; no Production/POST/Cron/provider route is opened', () => {
  const c = { environment: 'preview', targetEnvironment: 'preview', project: plan.target.project, databaseUrl: plan.target.url,
    publicDatabaseUrl: plan.target.url, origin: plan.target.origin, pathname: '/auth/callback', method: 'GET', imageSource: null,
    googleAccessExpiresAt: GOOGLE_READ_ENDS_AT, now };
  assert.equal(initialReadonlyDecision(c, plan.target), 404);
  assert.equal(initialReadonlyDecision(c, plan.target, true), null);
  for (const method of ['HEAD','POST','PUT','DELETE','OPTIONS']) assert.equal(initialReadonlyDecision({ ...c, method }, plan.target, true), 405);
  for (const pathname of ['/auth/callback/extra','/auth/link','/api/cron/payout-reminder','/api/webhook/stripe']) assert.equal(initialReadonlyDecision({ ...c, pathname }, plan.target, true), 404);
  assert.equal(initialReadonlyDecision({ ...c, environment: 'production' }, plan.target, true), 503);
});
test('fixed Google authorization expires all routes at the exact deadline without deleting Auth evidence', () => {
  assert.equal(GOOGLE_READ_ENDS_AT, plan.target.endsAt);
  const end = Date.parse(GOOGLE_READ_ENDS_AT);
  assert.equal(googleReadAccessAllowed(GOOGLE_READ_ENDS_AT, end - 1), true);
  for (const time of [end, end + 1, NaN, Infinity]) assert.equal(googleReadAccessAllowed(GOOGLE_READ_ENDS_AT, time), false);
  for (const value of [undefined, '', '2026-10-26T00:00:00Z', 'invalid']) assert.equal(googleReadAccessAllowed(value, end - 1), false);
  const c = { environment: 'preview', targetEnvironment: 'preview', project: plan.target.project, databaseUrl: plan.target.url,
    publicDatabaseUrl: plan.target.url, origin: plan.target.origin, method: 'GET', imageSource: null,
    googleAccessExpiresAt: GOOGLE_READ_ENDS_AT, now: end };
  for (const pathname of ['/admin-login','/auth/callback','/natori/dashboard/cases','/ja/natori/dashboard/cases',
    '/api/natori/admin/case-workspace','/api/natori/admin/case-detail','/_next/static/application.js']) {
    assert.equal(initialReadonlyDecision({ ...c, pathname }, plan.target, true), 503);
    assert.equal(initialReadonlyDecision({ ...c, pathname, now: end - 1, googleAccessExpiresAt: undefined }, plan.target, true), 503);
  }
});
test('missing, extended or expired Google grant aborts preflight before any read', async () => {
  for (const value of [undefined, '', '2026-10-26T00:00:00Z']) {
    const f = fixture(), input = env(); input.NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT = value;
    await assert.rejects(verifyGooglePreview(input, f.fetch, now), /access_expired/); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); await assert.rejects(verifyGooglePreview(env(), f.fetch, Date.parse(GOOGLE_READ_ENDS_AT)), /access_expired/);
  assert.equal(f.calls.length, 0);
});
test('compiled Google middleware denies every new request at expiry regardless of an existing Auth cookie', async () => {
  const dir = mkdtempSync(tmpdir() + '/natori-google-deadline-'); symlinkSync(root + '/node_modules', dir + '/node_modules', 'dir');
  await build({ stdin: { contents: readonlyMiddleware(readFileSync(root + '/src/middleware.ts', 'utf8'), 'google'),
    resolveDir: root + '/src', loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs',
    outfile: dir + '/middleware.cjs', tsconfig: root + '/tsconfig.json', external: ['next/*'], logLevel: 'silent',
    plugins: [{ name: 'real-dedicated-guard', setup(api) {
      api.onResolve({ filter: /^\.\/lib\/initialReadonlyPreviewGuard$/ }, () => ({ path: root + '/scripts/natori-case-initial-preview/readonly-guard.ts' }));
    } }] });
  const middleware = createRequire(import.meta.url)(dir + '/middleware.cjs').default;
  const keys = ['VERCEL_ENV','VERCEL_TARGET_ENV','VERCEL_PROJECT_ID','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL',
    'NATORI_CASE_DASHBOARD_PREVIEW_ENABLED','NATORI_NOTIFICATION_SENDING_ENABLED','NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT',
    'NATORI_CASE_ACCEPTANCE_TARGET','NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET'];
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]])), priorNow = Date.now;
  try {
    for (const key of keys) process.env[key] = env()[key];
    Date.now = () => Date.parse(GOOGLE_READ_ENDS_AT) - 1;
    for (const path of ['/admin-login','/auth/callback','/api/natori/admin/case-workspace']) {
      assert.equal((await middleware(new NextRequest(plan.target.origin + path))).headers.get('x-middleware-next'), '1');
    }
    Date.now = () => Date.parse(GOOGLE_READ_ENDS_AT);
    for (const path of ['/admin-login','/auth/callback','/natori/dashboard/cases','/api/natori/admin/case-workspace',
      '/api/natori/admin/case-detail','/_next/static/application.js','/api/cron/natori-payment-expiry']) {
      const response = await middleware(new NextRequest(plan.target.origin + path, { headers: { Cookie: 'synthetic-existing-auth=not-a-real-token' } }));
      assert.equal(response.status, 503); assert.equal(response.headers.get('x-middleware-next'), null);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
  } finally {
    Date.now = priorNow;
    for (const [key,value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('Google archive is explicit, preserves normal/password source, and its launchers run read-only preflight', () => {
  const parent = mkdtempSync(tmpdir() + '/natori-google-package-'), out = parent + '/package';
  const before = readFileSync(root + '/src/app/auth/callback/route.ts', 'utf8');
  const manifest = buildPackage(out, { authentication: 'google' });
  const archive = JSON.parse(readFileSync(out + '/archive-members.json'));
  assert.equal(manifest.authentication, 'google'); assert.equal(manifest.configuredCrons, 0);
  assert(archive.overlays['src/app/admin-login/AdminLoginClient.tsx'].includes('signInWithOAuth'));
  assert(!archive.overlays['src/app/admin-login/AdminLoginClient.tsx'].includes('signInWithPassword'));
  assert(archive.overlays['src/middleware.ts'].includes(', true);'));
  assert(archive.overlays['src/app/auth/callback/route.ts'].includes('exchangeCodeForSession(code)'));
  assert(!archive.overlays['src/app/auth/callback/route.ts'].includes('console.'));
  const launcher = privateLaunchers(manifest.archiveSHA256, 1, 'google');
  assert(launcher['preview-build.cjs'].includes('google-preflight.mjs')); assert(!launcher['preview-build.cjs'].includes('/setup.mjs'));
  assert.equal(readFileSync(root + '/src/app/auth/callback/route.ts', 'utf8'), before);
});
test('real callback overlay gates before exchange, fixes destination, rejects missing/duplicate codes and sanitizes errors', async () => {
  const out = mkdtempSync(tmpdir() + '/natori-google-callback-'); symlinkSync(root + '/node_modules', out + '/node_modules', 'dir');
  await build({ stdin: { contents: readonlyGoogleCallback(readFileSync(root + '/src/app/auth/callback/route.ts', 'utf8')),
    resolveDir: root + '/src/app/auth/callback', loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs',
    outfile: out + '/callback.cjs', external: ['next/*'], logLevel: 'silent', plugins: [{ name: 'mock-pkce-exchange', setup(api) {
      api.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
      api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export async function createClient(){return {auth:{exchangeCodeForSession:globalThis.__fixtureExchange}}}' }));
    } }] });
  const callback = createRequire(import.meta.url)(out + '/callback.cjs').GET;
  // The callback needs only nonsecret platform metadata. Never inspect or
  // temporarily replace this Work's service/provider credentials.
  const gateKeys = ['VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_PROJECT_ID', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
    'NATORI_CASE_DASHBOARD_PREVIEW_ENABLED', 'NATORI_NOTIFICATION_SENDING_ENABLED', 'NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT'];
  const input = Object.fromEntries(gateKeys.map(key => [key, env()[key]]));
  const prior = Object.fromEntries(gateKeys.map(key => [key, process.env[key]]));
  let count = 0; const priorNow = Date.now; Date.now = () => now;
  globalThis.__fixtureExchange = async () => { count++; return { error: null }; };
  try {
    Object.assign(process.env, input);
    const request = suffix => new Request(plan.target.origin + '/auth/callback' + suffix);
    const success = await callback(request('?code=synthetic&next=https://evil.invalid'));
    assert.equal(success.headers.get('location'), plan.target.origin + googlePlan.destination); assert.equal(count, 1);
    for (const suffix of ['', '?code=a&code=b', '?error_description=private-untrusted-text']) {
      const response = await callback(request(suffix));
      assert.equal(response.headers.get('location'), plan.target.origin + '/admin-login?err=oauth');
    }
    assert.equal(count, 1);
    globalThis.__fixtureExchange = async () => { count++; throw Error('private PKCE error'); };
    assert.equal((await callback(request('?code=synthetic'))).headers.get('location'), plan.target.origin + '/admin-login?err=oauth');
    process.env.VERCEL_ENV = 'production'; const before = count;
    assert.equal((await callback(request('?code=synthetic'))).status, 503); assert.equal(count, before);
    process.env.VERCEL_ENV = 'preview'; Date.now = () => Date.parse(GOOGLE_READ_ENDS_AT);
    assert.equal((await callback(request('?code=synthetic'))).status, 503); assert.equal(count, before);
  } finally {
    delete globalThis.__fixtureExchange;
    Date.now = priorNow;
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
