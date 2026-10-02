import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setDefaultResultOrder } from 'node:dns';
const require = createRequire('/app/package.json');
const { createClient } = require('@supabase/supabase-js'), { chromium, expect } = require('@playwright/test');
const Stripe = require('stripe');
setDefaultResultOrder('ipv4first');
const tests = [], check = (value, code) => { if (!value) throw new Error(code); };
let stage = 'preflight', server, browser, fixtureSignInStatus = null;
const errors = new Set();
const diagnosticStages = new Set(['preflight', 'auth-fixture', 'completed-project-fixture', 'completed-transaction-fixture',
  'active-project-fixture', 'active-transaction-fixture', 'active-task-fixture', 'server-start', 'server-ready', 'chromium-start', 'owner-sign-in', 'complete']);
const diagnosticCodes = new Set(['EPHEMERAL_REQUIRED', 'DESTINATION_REJECTED', 'AUTH_FIXTURE', 'PROJECT_FIXTURE', 'TRANSACTION_FIXTURE',
  'ACTIVE_PROJECT_FIXTURE', 'ACTIVE_TRANSACTION_FIXTURE', 'ACTIVE_TASK_FIXTURE', 'NEXT_READY', 'OWNER_SIGN_IN', 'BROWSER_FAILED']);
function writeReport(failure) {
  writeFileSync('/results/phase2d-browser.json', JSON.stringify({ tests, passed: tests.filter(test => test.status === 'passed').length,
    failed: tests.filter(test => test.status === 'failed').length, skipped: 0, expectedTests: 5, reachedTests: tests.length,
    status: failure ? 'failed' : 'passed', engine: 'Chromium 1.58.2 at 390px; not iPhone Safari', provider: 'synthetic SDK-signed Stripe only', compileErrors: [...errors],
    diagnostic: { stage: diagnosticStages.has(stage) ? stage : 'browser-assertions',
      code: failure ? (diagnosticCodes.has(failure.message) ? failure.message : 'BROWSER_PREFLIGHT_FAILED') : null,
      fixtureSignInStatus: Number.isInteger(fixtureSignInStatus) && fixtureSignInStatus >= 100 && fixtureSignInStatus <= 599 ? fixtureSignInStatus : null },
  }, null, 2));
}
async function test(name, run) { stage = name; try { await run(); tests.push({ name, status: 'passed' }); console.log(`PASS phase2d-browser/${name}`); }
  catch (error) {
    const code = new Set(['SIGNED_REFUND_ACK', 'ANON_DENIED', 'BUSINESS_FACTS_PRESERVED', 'CSV_STREAM', 'CSV_BOUND', 'CSV_MATCHES_UI',
      'COMPLETED_RETAINED', 'MOBILE_NO_OVERFLOW', 'NO_REFUND_ACTION', 'ACTIVE_FACTS_READ', 'ACTIVE_BASELINE', 'ACTIVE_NO_REFUND_ACTION',
      'ACTIVE_BUSINESS_FACTS_PRESERVED', 'ACTIVE_MOBILE_NO_OVERFLOW']).has(error?.message) ? error.message : 'ASSERTION_FAILED';
    tests.push({ name, status: 'failed', code }); console.log(`FAIL phase2d-browser/${name}`);
  } }

async function main() {
  check(process.env.PHASE_N_BROWSER === 'ephemeral', 'EPHEMERAL_REQUIRED');
  const { origin } = JSON.parse(readFileSync('/runtime/network.json', 'utf8'));
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), 'DESTINATION_REJECTED');
  const keys = JSON.parse(readFileSync('/runtime/credentials.json', 'utf8'));
  const db = createClient(origin, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  stage = 'auth-fixture';
  const password = randomBytes(32).toString('hex'), email = 'phase2d-owner@phase0b-browser.invalid';
  const auth = await db.auth.admin.createUser({ email, password, email_confirm: true }); check(!auth.error && auth.data.user, 'AUTH_FIXTURE'); const owner = auth.data.user.id;
  const when = new Date().toISOString(), session = 'cs_test_' + randomUUID(), intent = 'pi_test_' + randomUUID(), charge = 'ch_test_' + randomUUID();
  stage = 'completed-project-fixture';
  const project = await db.from('natori_projects').insert({ user_id: owner, title: 'Browser refund fixture', client_name: 'Synthetic', client_email: 'client@phase2d.invalid',
    type: 'illustration', status: 'completed', amount: 12000, paid_amount: 12000, paid_at: when, payment_confirmed_at: when, completed_at: when,
    stripe_payment_session_id: session, next_action: 'Keep completed' }).select('id').single(); check(!project.error && project.data, 'PROJECT_FIXTURE'); const id = project.data.id;
  stage = 'completed-transaction-fixture';
  check(!(await db.from('natori_payment_transactions').insert({ project_id: id, stripe_session_id: session, amount: 12000, status: 'received', received_at: when,
    stripe_account_scope: 'platform', stripe_livemode: false, stripe_payment_intent_id: intent, stripe_charge_id: charge, stripe_currency: 'jpy' })).error, 'TRANSACTION_FIXTURE');
  const activeSession = 'cs_test_' + randomUUID(), activeIntent = 'pi_test_' + randomUUID(), activeCharge = 'ch_test_' + randomUUID();
  stage = 'active-project-fixture';
  const activeProject = await db.from('natori_projects').insert({ user_id: owner, title: 'Browser active refund fixture', client_name: 'Synthetic', client_email: 'active@phase2d.invalid',
    type: 'illustration', status: 'rough', amount: 12000, paid_amount: 12000, paid_at: when, payment_confirmed_at: when,
    stripe_payment_session_id: activeSession, next_action: 'Keep rough production' }).select('id').single();
  check(!activeProject.error && activeProject.data, 'ACTIVE_PROJECT_FIXTURE'); const activeId = activeProject.data.id;
  stage = 'active-transaction-fixture';
  check(!(await db.from('natori_payment_transactions').insert({ project_id: activeId, stripe_session_id: activeSession, amount: 12000, status: 'received', received_at: when,
    stripe_account_scope: 'platform', stripe_livemode: false, stripe_payment_intent_id: activeIntent, stripe_charge_id: activeCharge, stripe_currency: 'jpy' })).error, 'ACTIVE_TRANSACTION_FIXTURE');
  stage = 'active-task-fixture';
  check(!(await db.from('natori_project_tasks').insert({ project_id: activeId, task_key: 'rough', label: 'ラフ', stage: 'rough', done: false,
    estimated_hours: 1, sort_order: 0 })).error, 'ACTIVE_TASK_FIXTURE');
  const activeTarget = { projectId: activeId, intent: activeIntent, charge: activeCharge };
  const app = 'http://localhost:3000', secret = 'whsec_' + randomBytes(32).toString('hex'), key = 'sk_test_' + randomBytes(32).toString('hex');
  const stripe = new Stripe(key);
  stage = 'server-start';
  server = spawn(process.execPath, ['/app/node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3000'], { cwd: '/app',
    env: { PATH: '/runtime-bin:/usr/local/bin:/usr/bin:/bin', TMPDIR: '/tmp', NODE_ENV: 'development', NODE_OPTIONS: '--dns-result-order=ipv4first',
      NEXT_TELEMETRY_DISABLED: '1', PHASE_N_BROWSER: 'ephemeral', PHASE_0B_BROWSER: 'ephemeral', PHASE_2D_BROWSER: 'ephemeral',
      NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service,
      NATORI_OWNER_USER_ID: owner, NATORI_OWNER_EMAILS: email, NATORI_DASHBOARD_KEY: randomBytes(32).toString('hex'), NEXT_PUBLIC_SITE_URL: app,
      NATORI_PAYMENT_INTEGRITY_ENABLED: '1', NATORI_REFUND_LEDGER_ENABLED: '1', NATORI_STRIPE_MODE: 'test', STRIPE_SECRET_KEY: key, STRIPE_WEBHOOK_SECRET: secret,
      NATORI_ACCEPTANCE_OUTBOX_ENABLED: '1', NATORI_NOTIFICATION_SENDING_ENABLED: '0', RESEND_API_KEY: '', ADMIN_API_TOKEN: '' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', buffer => {
    for (const code of ['Module not found', 'Failed to compile', 'SyntaxError', 'EADDRINUSE']) if (buffer.toString().includes(code)) errors.add(code);
  });
  stage = 'server-ready';
  let ready = false; const until = Date.now() + 120000;
  while (Date.now() < until && server.exitCode === null) { try { if ((await fetch(`${app}/ja/fixture-session`, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 400)); } check(ready, 'NEXT_READY');
  stage = 'chromium-start';
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }), page = await context.newPage();
  await context.route('**/*', route => { const url = new URL(route.request().url()); return url.origin === app ? route.continue() : route.abort('blockedbyclient'); });
  stage = 'owner-sign-in';
  await page.goto(`${app}/ja/fixture-session`); await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(password);
  const signInResponse = page.waitForResponse(response => response.url() === `${app}/api/fixture-session` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in' }).click(); fixtureSignInStatus = (await signInResponse).status();
  check(fixtureSignInStatus === 200, 'OWNER_SIGN_IN'); await expect(page.getByText('Session ready')).toBeVisible();
  let eventCreated = Math.floor(Date.now() / 1000) - 100;
  async function post(amount, status = 'succeeded', options = {}) {
    const target = options.target ?? { projectId: id, intent, charge };
    const event = { id: 'evt_' + randomUUID(), type: 'refund.created', livemode: false, created: ++eventCreated,
      data: { object: { id: options.id ?? 're_' + randomUUID(), amount, currency: 'jpy', status, charge: options.unknown ? 'ch_unknown' : target.charge,
        payment_intent: options.unknown ? 'pi_unknown' : target.intent, metadata: { kind: 'natori_commission', projectId: target.projectId } } } };
    const payload = JSON.stringify(event), signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const response = await context.request.post(`${app}/api/webhook/stripe`, { data: payload, headers: { 'stripe-signature': signature, 'content-type': 'application/json' } });
    check(response.status() === 200, 'SIGNED_REFUND_ACK'); return event;
  }
  const region = () => page.getByRole('region', { name: '返金と純入金' });
  await test('owner-session-and-anonymous-results-api', async () => {
    const anon = await browser.newContext(); check((await anon.request.get(`${app}/api/natori/admin/projects`)).status() === 401, 'ANON_DENIED'); await anon.close();
    await page.goto(`${app}/ja/fixture-refund-results`); await expect(region()).toContainText('￥12,000');
  });
  await test('partial-refund-gross-net-and-status-stay-distinct', async () => {
    await post(3000); await page.reload(); await expect(region()).toContainText('￥9,000'); await expect(page.getByText('一部返金', { exact: true })).toBeVisible();
    const facts = await db.from('natori_projects').select('status,paid_amount,paid_at,completed_at,next_action').eq('id', id).single();
    check(facts.data?.status === 'completed' && facts.data.paid_amount === 12000 && Date.parse(facts.data.paid_at) === Date.parse(when)
      && Date.parse(facts.data.completed_at) === Date.parse(when) && facts.data.next_action === 'Keep completed', 'BUSINESS_FACTS_PRESERVED');
  });
  await test('pending-and-unmatched-visible-but-excluded-from-csv', async () => {
    await post(2000, 'pending'); await post(1000, 'succeeded', { unknown: true }); await page.reload();
    await expect(region()).toContainText('返金処理中 1件'); await expect(region()).toContainText('返金要確認 1件'); await expect(region()).toContainText('￥9,000');
    await expect(page.getByText('返金と元の入金が未照合です。金額には含めていません。', { exact: true })).toBeVisible();
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: /CSV/ }).click(); const download = await pending;
    const stream = await download.createReadStream(); check(stream, 'CSV_STREAM'); let csv = ''; for await (const chunk of stream) { csv += chunk.toString(); check(csv.length < 65536, 'CSV_BOUND'); }
    const row = csv.slice(1).split('\r\n')[1].split(','); check(Number(row[4]) === 12000 && Number(row[6]) === 3000 && Number(row[7]) === 9000, 'CSV_MATCHES_UI');
  });
  await test('full-refund-has-zero-net-with-completed-project-retained', async () => {
    await post(9000); await page.reload(); await expect(region()).toContainText('￥0'); await expect(page.getByText(/全額返金 \/ 返金処理中 1件 \/ 返金要確認 1件/)).toBeVisible();
    check((await db.from('natori_projects').select('status,paid_amount').eq('id', id).single()).data?.status === 'completed', 'COMPLETED_RETAINED');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'MOBILE_NO_OVERFLOW');
    check(await page.getByRole('button', { name: /返金を実行|返金する/ }).count() === 0, 'NO_REFUND_ACTION');
  });
  await test('active-rough-project-displays-partial-then-full-refund-with-controls-preserved', async () => {
    async function facts() {
      const [project, tasks] = await Promise.all([
        db.from('natori_projects').select('status,paid_amount,paid_at,payment_confirmed_at,completed_at,next_action,stripe_payment_session_id').eq('id', activeId).single(),
        db.from('natori_project_tasks').select('task_key,label,stage,done,estimated_hours,sort_order').eq('project_id', activeId).order('sort_order', { ascending: true }),
      ]);
      check(!project.error && project.data && !tasks.error && tasks.data?.length === 1, 'ACTIVE_FACTS_READ');
      return { project: project.data, tasks: tasks.data };
    }
    const before = await facts();
    check(before.project.status === 'rough' && before.project.paid_amount === 12000 && before.project.completed_at === null
      && before.project.next_action === 'Keep rough production' && before.tasks[0].done === false, 'ACTIVE_BASELINE');
    const activeRegion = () => page.getByRole('region', { name: 'Active refund project' });
    const card = () => activeRegion().getByRole('article', { name: 'Browser active refund fixture' });
    async function controlsRemainAvailable() {
      await expect(card().getByText('ラフ', { exact: true }).first()).toBeVisible();
      await expect(card().getByText('Keep rough production', { exact: true })).toBeVisible();
      await expect(card().getByRole('button', { name: '線画へ進む' })).toBeEnabled();
      await card().getByRole('button', { name: /タスク/ }).click();
      const task = card().getByRole('button', { name: 'ラフ ラフ', exact: true });
      await expect(task).toBeEnabled(); await expect(task).toHaveAttribute('aria-pressed', 'false');
      await task.click(); await expect(activeRegion().getByRole('status')).toHaveText('Task control active');
      await card().getByRole('button', { name: 'ラフ提出メール' }).click();
      await expect(activeRegion().getByRole('status')).toHaveText('Rough mail control active');
      check(await card().getByRole('button', { name: /返金を実行|返金する/ }).count() === 0, 'ACTIVE_NO_REFUND_ACTION');
      check(JSON.stringify(await facts()) === JSON.stringify(before), 'ACTIVE_BUSINESS_FACTS_PRESERVED');
    }
    await post(3000, 'succeeded', { target: activeTarget }); await page.reload();
    await expect(card()).toContainText('元の入金 ￥12,000 / 確定返金 ￥3,000 / 純入金 ￥9,000');
    await expect(card().getByText('一部返金', { exact: true })).toBeVisible(); await controlsRemainAvailable();
    await post(9000, 'succeeded', { target: activeTarget }); await page.reload();
    await expect(card()).toContainText('元の入金 ￥12,000 / 確定返金 ￥12,000 / 純入金 ￥0');
    await expect(card().getByText('全額返金', { exact: true })).toBeVisible(); await controlsRemainAvailable();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'ACTIVE_MOBILE_NO_OVERFLOW');
  });
  await context.close();
  check(tests.length === 5 && tests.every(test => test.status === 'passed') && errors.size === 0, 'BROWSER_FAILED');
  stage = 'complete'; writeReport();
}
main().catch(error => { writeReport(error); console.error(`Phase 2D browser failed at ${stage}; raw logs withheld`); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); if (server?.exitCode === null) { server.kill('SIGTERM'); await Promise.race([new Promise(resolve => server.once('exit', resolve)),
    new Promise(resolve => setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 5000))]); }
});
