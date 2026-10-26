import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { buildAuthBootstrap, installNetworkPolicy, networkDecision } from './browser.mjs';
import { approvePlan, describePlan, planDigest, validateDeploymentEvidence, validatePlan } from './config.mjs';
import { controlUrls, runHostedReadOnly, validateRun } from './runner.mjs';
import { main, parseArguments } from './run.mjs';

const now = Date.parse('2026-10-22T10:00:00Z');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function fixture() {
  return {
    version: 1, purpose: 'hosted-password-read-only', sourceCommit: 'f'.repeat(40),
    target: { profile: 'hosted', ref: 'abcdefghijklmnopqrst', project: 'prj_synthetic', url: 'https://abcdefghijklmnopqrst.supabase.co', origin: 'https://case-synthetic.vercel.app', run: id(1), startsAt: '2026-10-22T09:00:00Z', endsAt: '2026-10-22T11:00:00Z' },
    owner: id(2), stripe: { account: 'acct_synthetic', mode: 'test' },
    mail: { scope: 'resend-synthetic', allowedTo: ['reviewer@example.com'], maxAttempts: 12 },
    fixtures: { staff: { id: id(3), email: 'staff@example.invalid' }, outsider: { id: id(4), email: 'outsider@example.invalid' }, projects: [id(5), id(6)], foreignProject: id(7) },
  };
}
function control(plan) {
  return [
    [{ id: plan.target.run, owner_id: plan.owner, project_ref: plan.target.ref, origin: plan.target.origin,
      provider_scope: plan.mail.scope, stripe_account: plan.stripe.account, starts_at: plan.target.startsAt, ends_at: plan.target.endsAt, enabled: true,
      allowed_to: plan.mail.allowedTo, human_to: plan.mail.allowedTo, mail_limit: 12, human_limit: 12, used: 0, human_used: 0 }],
    plan.fixtures.projects.map(project_id => ({ project_id })),
    [...plan.fixtures.projects.map(id => ({ id, user_id: plan.owner, deleted_at: null })), { id: plan.fixtures.foreignProject, user_id: plan.fixtures.outsider.id, deleted_at: null }],
  ];
}
const reject = (fn, code) => assert.throws(fn, e => e.code === code);
const credentials = { anon: 'synthetic-anon', service: 'synthetic-service', staff: 'synthetic-staff-password', outsider: 'synthetic-outsider-password' };
const deployment = () => ({ version: 1, origin: fixture().target.origin, project: fixture().target.project,
  sourceCommit: fixture().sourceCommit, environment: 'preview', status: 'READY', observedAt: '2026-10-22T09:59:00Z' });

function noMailFixture() {
  const p = fixture(); p.purpose = 'hosted-no-mail-read-only';
  p.mail.allowedTo = []; p.mail.maxAttempts = 0; return p;
}
test('no-mail plan keeps a zero mail contract despite the schema mail_limit of 12', () => {
  const p = validatePlan(noMailFixture(), now), c = control(p);
  c[0][0].human_limit = 0;
  assert.doesNotThrow(() => validateRun(p, ...c, now));
  assert.match(describePlan(p).mailVerification, /not performed; all mail disabled/);
  for (const mutate of [r => r.allowed_to.push('reviewer@example.com'), r => r.human_to.push('reviewer@example.com'),
    r => r.human_limit = 12, r => r.used = 1, r => r.human_used = 1, r => r.mail_limit = 30]) {
    const changed = structuredClone(c); mutate(changed[0][0]);
    reject(() => validateRun(p, ...changed, now), 'mail_contract_mismatch');
  }
});
test('no-mail purpose, budget and deployment suppression evidence must agree', () => {
  const p = noMailFixture(), receipt = { ...deployment(), mailMode: 'disabled', notificationSendingEnabled: false, resendKeyConfigured: false };
  assert.doesNotThrow(() => validateDeploymentEvidence(p, receipt, now));
  for (const field of ['mailMode', 'notificationSendingEnabled', 'resendKeyConfigured']) {
    const partial = { ...receipt }; delete partial[field];
    reject(() => validateDeploymentEvidence(p, partial, now), 'no_mail_deployment_unconfirmed');
  }
  for (const field of ['notificationSendingEnabled', 'resendKeyConfigured']) {
    reject(() => validateDeploymentEvidence(p, { ...receipt, [field]: true }, now), 'deployment_evidence_required');
  }
  reject(() => validatePlan({ ...p, purpose: 'hosted-password-read-only' }, now), 'mail_contract_mismatch');
  reject(() => validatePlan({ ...fixture(), purpose: p.purpose }, now), 'mail_contract_mismatch');
  reject(() => approvePlan(p, planDigest(fixture())), 'approval_mismatch');
});

test('approved hosted plan uses the actual application target validator; canonical digest is stable', () => {
  const plan = validatePlan(fixture(), now);
  const reordered = Object.fromEntries(Object.entries(plan).reverse());
  assert.equal(planDigest(plan), planDigest(reordered)); approvePlan(plan, planDigest(plan));
  assert.equal(describePlan(plan).mail.maxAttempts, 12);
});
for (const [label, mutate, code] of [
  ['production Supabase', p => { p.target.ref = 'lvnfspyainrxtztjytbo'; p.target.url = 'https://lvnfspyainrxtztjytbo.supabase.co'; }, 'target_invalid'],
  ['production Vercel', p => p.target.project = 'prj_kmLUjzMOcRofMAVsNL2O97Q3GQRj', 'target_invalid'],
  ['local profile', p => p.target.profile = 'local', 'plan_invalid'],
  ['live Stripe', p => p.stripe.mode = 'live', 'plan_invalid'],
  ['missing account', p => p.stripe.account = '', 'plan_invalid'],
  ['arbitrary host', p => p.target.origin = 'https://attacker.example', 'host_invalid'],
  ['production host', p => p.target.origin = 'https://me-ish.art', 'target_invalid'],
  ['suffix spoof', p => p.target.url += '.attacker.example', 'target_invalid'],
  ['target userinfo', p => p.target.url = 'https://user@abcdefghijklmnopqrst.supabase.co', 'target_invalid'],
  ['target path', p => p.target.url += '/different', 'target_invalid'],
  ['target trailing slash', p => p.target.url += '/', 'target_invalid'],
  ['HTTP', p => p.target.origin = 'http://case-synthetic.vercel.app', 'target_invalid'],
  ['port', p => p.target.origin += ':444', 'target_invalid'],
  ['not started', p => p.target.startsAt = '2026-10-22T10:00:01Z', 'target_invalid'],
  ['exact expiry', p => p.target.endsAt = '2026-10-22T10:00:00Z', 'target_invalid'],
  ['unknown setting', p => p.skipGuards = true, 'plan_invalid'],
  ['credential inside plan', p => p.password = 'synthetic-secret', 'plan_invalid'],
  ['total budget 30', p => p.mail.maxAttempts = 30, 'plan_invalid'],
  ['third recipient', p => p.mail.allowedTo.push('two@example.com', 'three@example.com'), 'plan_invalid'],
  ['duplicate recipient', p => p.mail.allowedTo.push(p.mail.allowedTo[0]), 'recipients_invalid'],
  ['empty recipients', p => p.mail.allowedTo = [], 'plan_invalid'],
  ['duplicate actor', p => p.fixtures.outsider.id = p.fixtures.staff.id, 'actors_invalid'],
  ['real Auth email', p => p.fixtures.staff.email = 'person@example.com', 'plan_invalid'],
  ['foreign member', p => p.fixtures.foreignProject = p.fixtures.projects[0], 'projects_invalid'],
  ['duplicate member', p => p.fixtures.projects.push(p.fixtures.projects[0]), 'projects_invalid'],
]) test(`plan rejects ${label}`, () => { const p = fixture(); mutate(p); reject(() => validatePlan(p, now), code); });

test('an approved digest cannot authorize another host/run/account/recipient/budget', () => {
  const p = fixture(), digest = planDigest(p);
  for (const change of [x => x.target.origin = 'https://other-synthetic.vercel.app', x => x.target.run = id(20), x => x.stripe.account = 'acct_other', x => x.mail.allowedTo = ['other@example.com']]) {
    const changed = structuredClone(p); change(changed); reject(() => approvePlan(changed, digest), 'approval_mismatch');
  }
  reject(() => approvePlan(p, undefined), 'approval_required');
});
for (const [label, mutate, code] of [
  ['missing', () => undefined, 'deployment_evidence_required'],
  ['production', e => ({ ...e, environment: 'production' }), 'deployment_evidence_required'],
  ['wrong host', e => ({ ...e, origin: 'https://other-synthetic.vercel.app' }), 'deployment_evidence_mismatch'],
  ['wrong project', e => ({ ...e, project: 'prj_other' }), 'deployment_evidence_mismatch'],
  ['wrong commit', e => ({ ...e, sourceCommit: 'a'.repeat(40) }), 'deployment_evidence_mismatch'],
  ['not ready', e => ({ ...e, status: 'BUILDING' }), 'deployment_evidence_required'],
  ['stale', e => ({ ...e, observedAt: '2026-10-22T09:54:59Z' }), 'deployment_evidence_stale'],
  ['future', e => ({ ...e, observedAt: '2026-10-22T10:00:01Z' }), 'deployment_evidence_stale'],
]) test(`deployment evidence rejects ${label}`, () => reject(() => validateDeploymentEvidence(fixture(), mutate(deployment()), now), code));
for (const [label, mutate, code] of [
  ['missing run', c => c[0] = [], 'run_unconfirmed'],
  ['wrong owner', c => c[0][0].owner_id = id(30), 'run_scope_mismatch'],
  ['wrong ref', c => c[0][0].project_ref = 'other', 'run_scope_mismatch'],
  ['wrong origin', c => c[0][0].origin = 'https://other-synthetic.vercel.app', 'run_scope_mismatch'],
  ['wrong account', c => c[0][0].stripe_account = 'acct_other', 'run_scope_mismatch'],
  ['wrong mail scope', c => c[0][0].provider_scope = 'other', 'run_scope_mismatch'],
  ['paused run', c => c[0][0].enabled = false, 'run_inactive'],
  ['changed end', c => c[0][0].ends_at = '2026-10-22T12:00:00Z', 'run_inactive'],
  ['30 attempts', c => c[0][0].mail_limit = 30, 'mail_contract_mismatch'],
  ['human bypass', c => c[0][0].human_limit = 30, 'mail_contract_mismatch'],
  ['extra recipient', c => c[0][0].allowed_to = ['reviewer@example.com', 'other@example.com'], 'mail_contract_mismatch'],
  ['unclassified human', c => c[0][0].human_to = [], 'mail_contract_mismatch'],
  ['spent over cap', c => c[0][0].used = 13, 'mail_contract_mismatch'],
  ['human count exceeds total', c => c[0][0].human_used = 1, 'mail_contract_mismatch'],
  ['missing membership', c => c[1].pop(), 'membership_mismatch'],
  ['duplicate membership', c => c[1].push(c[1][0]), 'membership_mismatch'],
  ['extra membership', c => c[1].push({ project_id: id(31) }), 'membership_mismatch'],
  ['owned case wrong owner', c => c[2][0].user_id = id(30), 'ownership_mismatch'],
  ['foreign case same owner', c => c[2][2].user_id = id(2), 'ownership_mismatch'],
  ['deleted case', c => c[2][0].deleted_at = '2026-10-22T09:59:00Z', 'ownership_mismatch'],
]) test(`DB contract rejects ${label}`, () => {
  const p = fixture(), c = structuredClone(control(p)); mutate(c); reject(() => validateRun(p, ...c, now), code);
});

test('browser permits only exact approved auth/read targets and blocks mutations/redirect destinations', () => {
  const p = fixture(), app = p.target.origin, api = p.target.url;
  for (const [url, method, expected] of [
    [app + '/admin-login', 'GET', 'page'],
    [app + '/natori/dashboard/cases?entry=today&case=' + id(5) + '&section=overview', 'GET', 'page'],
    [app + '/api/natori/admin/case-workspace', 'GET', 'read'],
    [app + '/api/natori/admin/case-payment?projectId=' + id(7), 'GET', 'read'],
    [api + '/auth/v1/token?grant_type=password', 'POST', 'auth'],
    [api + '/auth/v1/token?grant_type=refresh_token', 'POST', 'auth'],
    [api + '/auth/v1/logout?scope=local', 'POST', 'auth'],
    [api + '/auth/v1/user', 'GET', 'auth'],
    ['https://fonts.googleapis.com/css2?family=Synthetic', 'GET', 'font-placeholder'],
    [app + '/api/natori/admin/case-payment?projectId=' + id(5), 'POST', 'deny'],
    [app + '/api/natori/admin/case-payment?projectId=' + id(90), 'GET', 'deny'],
    [app + '/api/natori/admin/case-payment?projectId=' + id(5) + '&projectId=' + id(7), 'GET', 'deny'],
    [app + '/api/contact', 'POST', 'deny'],
    [app + '/_next/image?url=https%3A%2F%2Fattacker.example', 'GET', 'deny'],
    [app + '/admin-login?next=https://attacker.example', 'GET', 'deny'],
    [app + '/natori/dashboard/cases?case=' + id(90), 'GET', 'deny'],
    ['https://other-synthetic.vercel.app/admin-login', 'GET', 'deny'],
    ['https://api.stripe.com/v1/account', 'GET', 'deny'],
    ['https://api.resend.com/emails', 'POST', 'deny'],
    [api + '/auth/v1/authorize?provider=google', 'GET', 'deny'],
    [api + '/auth/v1/admin/users', 'POST', 'deny'],
    [api + '/auth/v1/signup', 'POST', 'deny'],
    [api + '/auth/v1/recover', 'POST', 'deny'],
    [api + '/auth/v1/logout?scope=global', 'POST', 'deny'],
    [api + '/rest/v1/natori_projects', 'GET', 'deny'],
    [api + '/storage/v1/object/upload', 'POST', 'deny'],
  ]) assert.equal(networkDecision(p, url, method, now), expected, `${method} synthetic request`);
  assert.equal(networkDecision(p, app + '/admin-login', 'GET', Date.parse(p.target.endsAt)), 'deny');
});

test('route transport never follows redirects/retries and does not log raw errors', async () => {
  let handler, socketHandler;
  const state = await installNetworkPolicy({ route: async (_, h) => handler = h, routeWebSocket: async (_, h) => socketHandler = h }, fixture(), () => now);
  let options, aborted, fulfilled;
  const route = status => ({ request: () => ({ url: () => fixture().target.origin + '/admin-login', method: () => 'GET' }),
    fetch: async o => { options = o; return { status: () => status }; },
    abort: async reason => aborted = reason, fulfill: async o => fulfilled = o,
  });
  await handler(route(302)); assert.equal(options.maxRedirects, 0); assert.equal(options.maxRetries, 0); assert.equal(aborted, 'blockedbyclient'); assert.equal(fulfilled, undefined);
  await handler(route(200)); assert.ok(fulfilled);
  await handler({ ...route(200), fetch: async () => { throw Error('synthetic password and token must not be retained'); } });
  socketHandler({ close() {} });
  assert.deepEqual(state.denied, ['redirect', 'transport', 'websocket']);
});

function harness(changes = {}) {
  const p = fixture(), calls = [], urls = controlUrls(p); let reads = 0, closed = 0;
  const transport = async (url, options) => {
    calls.push('control'); assert.equal(url, urls[reads % 3]); assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.apikey, credentials.service);
    const data = structuredClone(control(p)); changes.control?.(data, reads);
    return new Response(JSON.stringify(data[reads++ % 3]), { status: changes.status ?? 200 });
  };
  const browser = {};
  for (const name of ['unauthenticated', 'signIn', 'denied', 'refresh', 'read', 'views', 'signOut']) browser[name] = async (...args) => {
    calls.push(name); await changes.browser?.(name, args);
  };
  browser.close = async () => { closed++; };
  browser.evidence = () => ({ denied: changes.denied ?? [], counts: { auth: 4, read: 8 }, pageErrors: 0 });
  return { options: { input: p, approvedDigest: planDigest(p), deploymentEvidence: deployment(), credentials, transport, openBrowser: async () => { calls.push('open'); return browser; }, now: () => now }, calls, closed: () => closed };
}
test('fake transport/browser run follows the scoped Auth/read lifecycle and closes without business operations', async () => {
  const h = harness(), result = await runHostedReadOnly(h.options);
  assert.equal(result.success, true); assert.equal(h.closed(), 1);
  assert.deepEqual(h.calls, ['control', 'control', 'control', 'open', 'unauthenticated', 'signIn', 'denied', 'signOut', 'unauthenticated', 'signIn', 'refresh', 'read', 'views', 'signOut', 'unauthenticated', 'control', 'control', 'control']);
  for (const secret of Object.values(credentials)) assert.equal(JSON.stringify(result).includes(secret), false);
});
test('missing/wrong approval or expired target refuses before transport/browser', async () => {
  for (const changed of [{ approvedDigest: undefined }, { approvedDigest: '0'.repeat(64) }, { deploymentEvidence: undefined }, { now: () => Date.parse(fixture().target.endsAt) }]) {
    const h = harness(); await assert.rejects(runHostedReadOnly({ ...h.options, ...changed })); assert.deepEqual(h.calls, []);
  }
});
test('DB mismatch refuses before password login; non-200 never opens browser', async () => {
  const h = harness({ control: c => c[0][0].mail_limit = 30 });
  await assert.rejects(runHostedReadOnly(h.options), e => e.code === 'mail_contract_mismatch'); assert.equal(h.calls.includes('open'), false);
  const bad = harness({ status: 403 }); await assert.rejects(runHostedReadOnly(bad.options), e => e.code === 'control_read_failed'); assert.equal(bad.calls.includes('open'), false);
});
test('control transport exception never leaks a raw provider/credential error or retries', async () => {
  const h = harness(); let calls = 0;
  h.options.transport = async () => { calls++; throw Error('synthetic-private-value'); };
  await assert.rejects(runHostedReadOnly(h.options), e => e.code === 'control_read_failed' && !e.message.includes('private-value'));
  assert.equal(calls, 1); assert.equal(h.calls.includes('open'), false);
});
test('oversized control response refuses without browser or retained body', async () => {
  const h = harness(); h.options.transport = async () => new Response('x'.repeat(70000));
  await assert.rejects(runHostedReadOnly(h.options), e => e.code === 'control_response_too_large'); assert.equal(h.calls.includes('open'), false);
});
test('browser cleanup failure refuses a success result without leaking details', async () => {
  const h = harness(), open = h.options.openBrowser;
  h.options.openBrowser = async (...args) => ({ ...await open(...args), close: async () => { throw Error('synthetic-private-value'); } });
  await assert.rejects(runHostedReadOnly(h.options), e => e.code === 'browser_cleanup_unconfirmed' && !e.message.includes('private-value'));
});
test('browser exception is sanitized, closed once, and not retried', async () => {
  const h = harness({ browser: name => { if (name === 'refresh') throw Error('synthetic-private-value'); } });
  await assert.rejects(runHostedReadOnly(h.options), e => e.code === 'hosted_read_unconfirmed' && !e.message.includes('private-value'));
  assert.equal(h.closed(), 1); assert.equal(h.calls.filter(x => x === 'refresh').length, 1);
});
test('mail spend change and unexpected network deny a successful result', async () => {
  const changed = harness({ control: (c, reads) => { if (reads >= 3) c[0][0].used = 1; } });
  await assert.rejects(runHostedReadOnly(changed.options), e => e.code === 'mail_spend_changed'); assert.equal(changed.closed(), 1);
  const denied = harness({ denied: ['request'] }); await assert.rejects(runHostedReadOnly(denied.options), e => e.code === 'unexpected_browser_request');
});
test('run expiring after preflight cannot begin another login', async () => {
  const h = harness(); let time = now;
  h.options.now = () => time;
  const open = h.options.openBrowser; h.options.openBrowser = async (...args) => { time = Date.parse(fixture().target.endsAt); return open(...args); };
  await assert.rejects(runHostedReadOnly(h.options), e => e.code === 'target_invalid'); assert.equal(h.calls.includes('signIn'), false); assert.equal(h.closed(), 1);
});
test('CLI plan/help never touches injected credentials, transport or browser', async () => {
  const forbidden = () => { throw Error('unexpected I/O'); };
  const deps = { readFile: async () => JSON.stringify(fixture()), now: () => now, getCredentials: forbidden, transport: forbidden, openBrowser: forbidden };
  assert.equal((await main(['plan', '--config', '/tmp/synthetic-plan.json'], deps)).digest, planDigest(fixture()));
  assert.ok((await main([], deps)).help);
  for (const args of [['plan', '--config', '.env'], ['plan', '--config', 'x.json', '--url', 'https://other.example'], ['execute-read-only', '--config', 'x.json']]) reject(() => parseArguments(args), args[2] === '.env' ? 'environment_file_forbidden' : args[0] === 'execute-read-only' ? 'approval_required' : 'arguments_invalid');
});
test('CLI wrong approval does not read credentials or create output', async () => {
  const out = '/tmp/case-hosted-must-not-create-' + process.pid;
  assert.equal(existsSync(out), false);
  await assert.rejects(main(['execute-read-only', '--config', '/tmp/synthetic-plan.json', '--approved-sha256', '0'.repeat(64), '--deployment-evidence', '/tmp/synthetic-deployment.json', '--out', out], {
    readFile: async () => JSON.stringify(fixture()), now: () => now, getCredentials: () => { throw Error('unexpected secret read'); },
  }), e => e.code === 'approval_mismatch');
  assert.equal(existsSync(out), false);
});
test('real application SSR client bundles in memory without an auth route or password artifact', async () => {
  const code = await buildAuthBootstrap(fixture(), 'synthetic-public-anon');
  assert.ok(code.includes('__caseHostedAuth')); assert.ok(code.includes('synthetic-public-anon'));
  assert.equal(code.includes(credentials.staff), false); assert.equal(code.includes('/__case-local-auth.js'), false);
});
