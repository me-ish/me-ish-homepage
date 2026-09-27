import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { setDefaultResultOrder } from 'node:dns';
import { createRequire } from 'node:module';
const require = createRequire('/app/package.json');
const { createClient } = require('@supabase/supabase-js');
const { chromium, expect } = require('@playwright/test');
setDefaultResultOrder('ipv4first');
const appOrigin = 'http://localhost:3000', results = [], browserProblems = new Set();
const check = (ok, code) => { if (!ok) throw new Error(code); };
let stage = 'preflight', server, browser, capture;
async function test(name, fn) {
  stage = name;
  try { await fn(); results.push({ name, status: 'passed' }); console.log(`PASS phase4/${name}`); }
  catch (error) { const message = error?.message ?? ''; const code = /^[A-Z_0-9]+$/.test(message) ? message : message.includes('strict mode violation') ? 'STRICT_LOCATOR' : message.includes('toBeVisible') ? 'NOT_VISIBLE' : 'ASSERTION_FAILED'; results.push({ name, status: 'failed', code }); console.log(`FAIL phase4/${name} ${code}`); }
}
async function main() {
  check(process.env.PHASE_N_BROWSER === 'ephemeral', 'EPHEMERAL_REQUIRED');
  const { origin } = JSON.parse(readFileSync('/runtime/network.json', 'utf8'));
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), 'DESTINATION_REJECTED');
  const keys = JSON.parse(readFileSync('/runtime/credentials.json', 'utf8'));
  const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(origin, keys.service, authOptions);
  const anon = createClient(origin, keys.anon, authOptions);
  const password = randomBytes(32).toString('hex'), sharedKey = randomBytes(32).toString('hex'), apiKey = randomBytes(32).toString('hex');
  const actors = [];
  for (const name of ['phase4-owner', 'phase4-staff-a', 'phase4-staff-b', 'phase4-stranger']) {
    const email = `${name}@phase0b-browser.invalid`;
    const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    check(!r.error && r.data.user, 'AUTH_FIXTURE'); actors.push({ email, id: r.data.user.id });
  }
  const [owner, staffA, staffB, stranger] = actors;
  const past = new Date(Date.now() - 86400000).toISOString(), future = new Date(Date.now() + 86400000).toISOString();
  const hash = value => createHash('sha256').update(value).digest('hex');
  const statuses = ['inquiry', 'consulting', 'estimating', 'quoted', 'awaiting_payment', 'rough', 'lineart', 'coloring', 'waiting', 'delivery_prep', 'delivered', 'completed', 'closed'];
  async function project(status, extra = {}) {
    const token = randomBytes(32).toString('base64url');
    const row = { user_id: owner.id, title: `Phase 4 ${status}`, client_name: 'Synthetic client', client_email: 'client@phase-n.invalid', type: 'icon', status, amount: 12000, due_date: '2027-01-01', delivery_plan: 'normal', request_data: { message: 'Original synthetic request' }, agreed_terms: { immutable: true }, paid_at: past, paid_amount: 12000, delivery_token_hash: hash(randomBytes(32).toString('hex')), delivery_token_expires_at: future, ...extra };
    const r = await admin.from('natori_projects').insert(row).select('*').single(); check(!r.error && r.data, 'PROJECT_FIXTURE');
    const access = await admin.from('natori_consultation_access').insert({ project_id: r.data.id, token_hash: hash(token), expires_at: future }).select('*').single(); check(!access.error, 'ACCESS_FIXTURE');
    return { ...r.data, token, access: access.data };
  }
  const projects = [];
  for (const status of statuses) projects.push(await project(status));
  const archive = await project('rough', { title: 'Phase 4 archived', deleted_at: past });
  const foreign = await project('rough', { user_id: stranger.id, title: 'FOREIGN_SENTINEL' });
  const rough = projects.find(p => p.status === 'rough'), prep = projects.find(p => p.status === 'delivery_prep');
  for (const p of [...projects, archive, foreign]) {
    if (p.status === 'inquiry') continue;
    const r = await admin.from('natori_consultation_messages').insert({ project_id: p.id, sender: 'client', body: `History ${p.title}`, notification_status: 'sent', created_at: past }); check(!r.error, 'MESSAGE_FIXTURE');
  }
  const sameTime = '2026-09-25T09:00:00.000Z';
  const tieProject = projects.find(p => p.status === 'estimating');
  check(!(await admin.from('natori_consultation_messages').insert([
    { id: '00000000-0000-4000-8000-000000000001', project_id: tieProject.id, sender: 'client', body: 'tie client', notification_status: 'failed', created_at: future },
    { id: '00000000-0000-4000-8000-000000000002', project_id: tieProject.id, sender: 'staff', body: 'tie staff', notification_status: 'sent', created_at: future },
  ])).error, 'TIE_FIXTURE');
  const job = { project_id: rough.id, notification_key: `phase4:${rough.id}`, purpose: 'delivery_accept_artist', snapshot: {}, created_at: sameTime };
  check(!(await admin.from('natori_notification_jobs').insert([
    { ...job, attempt_no: 1, status: 'failed' },
    { ...job, attempt_no: 2, status: 'sent', sent_at: past, provider_id: 'synthetic' },
  ])).error, 'ATTEMPT_FIXTURE');
  const beforeRows = (await admin.from('natori_projects').select('*').eq('user_id', owner.id).order('id')).data;
  const beforeAccess = (await admin.from('natori_consultation_access').select('*').in('project_id', [...projects, archive].map(p => p.id)).order('id')).data;
  const rpc = ids => admin.rpc('natori_consultation_overview_v1', { p_owner_id: owner.id, p_project_ids: ids });
  await test('read-projection-owner-scope-ties-and-latest-notification-attempt', async () => {
    const r = await rpc([rough.id, tieProject.id, foreign.id]); check(!r.error && r.data.length === 2, 'RPC_OWNER_SCOPE');
    const tie = r.data.find(p => p.project_id === tieProject.id), recovered = r.data.find(p => p.project_id === rough.id);
    check(tie.latest_sender === 'staff' && tie.latest_message_id.endsWith('002') && tie.notification_failed === 1, 'TIE_OR_LEGACY_FAILURE');
    check(recovered.notification_failed === 0 && recovered.latest_sender === 'client', 'OLD_FAILURE_COUNTED');
    check((await rpc(Array(101).fill(rough.id))).data?.length === 0, 'BATCH_LIMIT');
  });
  await test('projection-denies-anonymous-and-authenticated-direct-rpc', async () => {
    check((await anon.rpc('natori_consultation_overview_v1', { p_owner_id: owner.id, p_project_ids: [rough.id] })).error?.code === '42501', 'ANON_RPC_PERMISSION');
    const auth = createClient(origin, keys.anon, authOptions); check(!(await auth.auth.signInWithPassword({ email: staffA.email, password })).error, 'AUTH_SIGNIN');
    check((await auth.rpc('natori_consultation_overview_v1', { p_owner_id: owner.id, p_project_ids: [rough.id] })).error?.code === '42501', 'AUTH_RPC_PERMISSION');
  });
  let rejectMail = false, providerCalls = 0; const mails = [];
  capture = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += String(chunk);
    try {
      const p = JSON.parse(body), recipients = [p.to, p.bcc, p.reply_to].flat().filter(Boolean);
      check(req.headers.authorization === `Bearer ${apiKey}` && p.from === 'Phase N <sender@phase-n.invalid>' && recipients.every(a => ['artist@phase-n.invalid', 'client@phase-n.invalid', 'bcc@phase-n.invalid'].includes(a)), 'CAPTURE_ALLOWLIST');
      providerCalls++; mails.push(p); res.setHeader('content-type', 'application/json');
      res.writeHead(rejectMail ? 422 : 200); res.end(JSON.stringify(rejectMail ? { message: 'synthetic rejection' } : { id: randomUUID() }));
    } catch { res.writeHead(400); res.end('{}'); }
  });
  await new Promise(resolve => capture.listen(3101, '127.0.0.1', resolve));
  stage = 'next-start';
  server = spawn(process.execPath, ['--require', '/browser-test/provider-preload.cjs', '/app/node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3000'], { cwd: '/app', env: {
    PATH: '/runtime-bin:/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', TMPDIR: '/tmp', NODE_ENV: 'development', NODE_OPTIONS: '--dns-result-order=ipv4first', NEXT_TELEMETRY_DISABLED: '1', PHASE_N_BROWSER: 'ephemeral', PHASE_0B_BROWSER: 'ephemeral',
    NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service, NATORI_DASHBOARD_KEY: sharedKey, NATORI_OWNER_USER_ID: owner.id, NATORI_OWNER_EMAILS: owner.email, NATORI_STAFF_EMAILS: `${staffA.email},${staffB.email}`, NEXT_PUBLIC_SITE_URL: appOrigin,
    NATORI_ACCEPTANCE_OUTBOX_ENABLED: '1', NATORI_NOTIFICATION_SENDING_ENABLED: '1', RESEND_API_KEY: apiKey, NATORI_ORDER_MAIL_FROM: 'Phase N <sender@phase-n.invalid>', NATORI_PORTFOLIO_CONTACT_TO: 'artist@phase-n.invalid', NATORI_MAIL_BCC: 'bcc@phase-n.invalid',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  const classifications = new Set();
  for (const stream of [server.stdout, server.stderr]) stream.on('data', b => { const s = b.toString(); for (const code of ['Module not found', 'Failed to compile', 'SyntaxError', 'EADDRINUSE']) if (s.includes(code)) classifications.add(code); });
  let ready = false; const deadline = Date.now() + 120000;
  while (Date.now() < deadline && server.exitCode === null) {
    try { const r = await fetch(`${appOrigin}/ja/fixture-session`, { signal: AbortSignal.timeout(2000), redirect: 'manual' }); if (r.ok) { ready = true; break; }
      if (r.status >= 300 && r.status < 400) {
        const location = new URL(r.headers.get('location'), appOrigin);
        check(location.origin === appOrigin, 'REDIRECT_OUTSIDE');
        const next = await fetch(location, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
        if (next.ok) { ready = true; break; }
      }
    } catch { /* bounded startup polling, no raw logs */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) { console.log(`Next startup: ${[...classifications].join(',')}`); throw new Error('NEXT_NOT_READY'); }
  browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
  const context = async () => { const c = await browser.newContext({ baseURL: appOrigin, serviceWorkers: 'block' }); c.setDefaultTimeout(15000); c.setDefaultNavigationTimeout(60000);
    c.on('page', page => {
      page.on('pageerror', () => browserProblems.add('UNHANDLED_PAGE_ERROR'));
      page.on('console', msg => {
        if (!['warning', 'error'].includes(msg.type())) return;
        const text = msg.text();
        if (/hydrat|cannot be a descendant|cannot be a child|cannot contain a nested/i.test(text)) {
          const tags = [...new Set([...text.matchAll(/<\/?[a-z][a-z0-9]*>/g)].map(m => m[0]))].join(',');
          browserProblems.add(`DOM_OR_HYDRATION${tags ? ':' + tags : ''}`);
        }
        if (/Missing.*Description|DialogContent.*DialogTitle/.test(text)) browserProblems.add('DIALOG_ACCESSIBILITY');
      });
    }); return c; };
  const client = await context(), manager = await context();
  const page = await manager.newPage(), clientPage = await client.newPage();
  await page.goto(`/natori/dashboard?natori-key=${sharedKey}`);
  await expect(page.getByRole('heading', { name: '相談の確認' })).toBeVisible({ timeout: 60000 });
  const collection = async (c, id) => { const r = await c.request.get(`/api/natori/admin/projects?projectId=${id}`); check(r.status() === 200, 'PROJECT_GET'); return r.json(); };
  await test('two-real-staff-sessions-and-shared-key-see-same-owner', async () => {
    for (const actor of [staffA, staffB]) {
      const c = await context(); const auth = await c.request.post('/api/fixture-session', { data: { email: actor.email, password } }); check(auth.ok(), 'FIXTURE_SESSION');
      const r = await collection(c, rough.id); check(r.projects.length === 1 && r.projects[0].id === rough.id, 'STAFF_OWNER');
      const history = await c.request.get(`/api/natori/admin/consultation?projectId=${rough.id}`); check(history.ok() && (await history.json()).messages.length === 1, 'STAFF_HISTORY'); await c.close();
    }
    check((await collection(manager, rough.id)).projects.length === 1, 'SHARED_OWNER');
  });
  await test('anonymous-stranger-and-foreign-project-cannot-access', async () => {
    check((await client.request.get(`/api/natori/admin/projects?projectId=${rough.id}`)).status() === 401, 'ANON_GET');
    const c = await context(); check((await c.request.post('/api/fixture-session', { data: { email: stranger.email, password } })).ok(), 'STRANGER_SESSION');
    check((await c.request.get(`/api/natori/admin/consultation?projectId=${rough.id}`)).status() === 401, 'STRANGER_GET'); await c.close();
    const r = await collection(manager, foreign.id); check(r.projects.length === 0 && r.archivedProjects.length === 0, 'FOREIGN_PROJECT');
    check((await manager.request.get(`/api/natori/admin/consultation?projectId=${foreign.id}`)).status() === 404, 'FOREIGN_HISTORY');
  });
  await test('all-thirteen-stages-and-archive-resolve-independently-of-list-filter', async () => {
    for (const p of [...projects, archive]) {
      const r = await collection(manager, p.id); check([...r.projects, ...r.archivedProjects].some(x => x.id === p.id), 'STAGE_NOT_FOUND');
      const h = await manager.request.get(`/api/natori/admin/consultation?projectId=${p.id}`); check(h.ok(), 'STAGE_HISTORY');
    }
    await page.goto(`/natori/inquiries?filter=inquiry&project=${prep.id}&view=conversation`);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(`History ${prep.title}`, { exact: true })).toBeVisible();
  });
  await test('legacy-email-url-opens-production-history-and-preserves-facts', async () => {
    await page.goto(`/natori/inquiries?project=${rough.id}`);
    await expect(page.getByRole('button', { name: '相談に返信', exact: true })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: '相談に返信', exact: true }).click();
    await expect(page.getByText(`History ${rough.title}`, { exact: true })).toBeVisible();
    const after = await admin.from('natori_projects').select('*').eq('user_id', owner.id).order('id');
    const access = await admin.from('natori_consultation_access').select('*').in('project_id', [...projects, archive].map(p => p.id)).order('id');
    check(JSON.stringify(after.data) === JSON.stringify(beforeRows) && JSON.stringify(access.data) === JSON.stringify(beforeAccess), 'READ_MUTATED_FACTS');
  });
  await test('closed-and-archived-history-is-readable-without-send-controls', async () => {
    for (const p of [projects.find(x => x.status === 'closed'), archive]) {
      await page.goto(`/natori/inquiries?project=${p.id}&view=conversation`);
      await expect(page.getByText(`History ${p.title}`, { exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'メッセージ', exact: true })).toHaveCount(0);
      const sent = await manager.request.post('/api/natori/admin/consultation', { headers: { 'x-requested-with': 'me-ish' }, data: { projectId: p.id, body: 'Must not write' } }); check(sent.status() === 404, 'CLOSED_WRITE');
      const clientSent = await client.request.post(`/api/natori/consult/${p.token}`, { headers: { 'x-requested-with': 'me-ish' }, data: { body: 'Must not write' } }); check(clientSent.status() === 404, 'CLOSED_CLIENT_WRITE');
    }
  });
  await test('keyboard-button-dialog-escape-and-focus-restoration', async () => {
    await page.goto('/natori/inquiries');
    const opener = page.getByRole('button', { name: `Synthetic client ${rough.title}`, exact: false }).filter({ visible: true }).first();
    await opener.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Tab'); check(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), 'FOCUS_ESCAPED');
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(opener).toBeFocused();
  });
  await test('staff-reply-flips-waiting-owner-without-regressing-production', async () => {
    await page.goto(`/natori/inquiries?project=${rough.id}&view=conversation`);
    await page.getByRole('textbox', { name: 'メッセージ', exact: true }).fill('Staff reply for Phase 4');
    await page.getByRole('button', { name: 'メッセージを送信', exact: true }).click();
    await expect(page.getByText('Staff reply for Phase 4', { exact: true })).toBeVisible();
    await expect.poll(async () => (await rpc([rough.id])).data[0].latest_sender).toBe('staff');
    check((await admin.from('natori_projects').select('status,paid_at,agreed_terms').eq('id', rough.id).single()).data.status === 'rough', 'STATUS_REGRESSION');
    check((await admin.from('natori_consultation_access').select('token_hash,expires_at').eq('id', rough.access.id).single()).data.token_hash === rough.access.token_hash, 'OLD_LINK_ROTATED');
  });
  await test('client-return-and-manual-refresh-retain-history-and-draft', async () => {
    await clientPage.goto(`/natori/consult/${rough.token}`);
    await expect(clientPage.getByText('Staff reply for Phase 4', { exact: true })).toBeVisible({ timeout: 30000 });
    await clientPage.getByRole('textbox', { name: 'メッセージ', exact: true }).fill('Unsent client draft');
    check(!(await admin.from('natori_consultation_messages').insert({ project_id: rough.id, sender: 'staff', body: 'Message while away', notification_status: 'sent' })).error, 'AWAY_FIXTURE');
    await new Promise(resolve => setTimeout(resolve, 1100));
    await clientPage.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect(clientPage.getByText('Message while away', { exact: true })).toBeVisible();
    await expect(clientPage.getByRole('textbox', { name: 'メッセージ', exact: true })).toHaveValue('Unsent client draft');
    await clientPage.getByRole('button', { name: '履歴を更新', exact: true }).click();
    await expect(clientPage.getByText('Staff reply for Phase 4', { exact: true })).toBeVisible();
  });
  await test('notification-failure-is-distinct-from-saved-client-message-and-reply-wait', async () => {
    rejectMail = true;
    await clientPage.getByRole('textbox', { name: 'メッセージ', exact: true }).fill('Client reply despite mail rejection');
    await clientPage.getByRole('button', { name: 'メッセージを送信', exact: true }).click();
    await expect(clientPage.getByText('Client reply despite mail rejection', { exact: true })).toBeVisible();
    await expect(clientPage.getByText('相談内容は保存されましたが、メール通知に失敗しました。別の方法でもご連絡ください。', { exact: true })).toBeVisible();
    const r = await rpc([rough.id]); check(r.data[0].latest_sender === 'client' && r.data[0].notification_failed === 1, 'REPLY_AND_MAIL_MIXED');
    check(mails.some(m => m.text?.includes(`/natori/inquiries?project=${rough.id}&view=conversation`)), 'MAIL_DEEP_LINK');
    rejectMail = false;
  });
  await test('existing-private-attachment-opens-for-staff-and-client-with-real-bytes', async () => {
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP40DD7PwAHegMLe6mEsQAAAABJRU5ErkJggg==', 'base64');
    const path = `${rough.id}/phase4-fixture.png`;
    check(!(await admin.storage.from('natori-consultations').upload(path, bytes, { contentType: 'image/png' })).error, 'STORAGE_FIXTURE');
    const message = await admin.from('natori_consultation_messages').select('id').eq('project_id', rough.id).order('created_at').limit(1).single();
    check(!message.error, 'ATTACHMENT_MESSAGE');
    check(!(await admin.from('natori_consultation_files').insert({ project_id: rough.id, message_id: message.data.id, storage_path: path, file_name: 'fixture.png', mime_type: 'image/png', size_bytes: bytes.length })).error, 'ATTACHMENT_FIXTURE');
    for (const [c, endpoint] of [[manager, `/api/natori/admin/consultation?projectId=${rough.id}`], [client, `/api/natori/consult/${rough.token}`]]) {
      const r = await c.request.get(endpoint); check(r.ok(), 'ATTACHMENT_HISTORY');
      const body = await r.json(), file = body.messages.flatMap(m => m.files).find(f => f.name === 'fixture.png');
      check(file && new URL(file.url).origin === origin, 'ATTACHMENT_DESTINATION');
      const download = await c.request.get(file.url); check(download.ok() && (await download.body()).equals(bytes), 'ATTACHMENT_BYTES');
    }
  });
  await test('home-attention-includes-production-and-latest-sender', async () => {
    await page.goto('/natori/dashboard');
    const panel = page.getByRole('region', { name: '相談の確認' }); await expect(panel).toBeVisible();
    await expect(panel.getByText(/ナトリの返信待ち/).first()).toBeVisible();
    await panel.getByRole('link', { name: /要確認の相談をすべて見る/ }).click();
    await expect(page.getByText(rough.title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    const r = await collection(manager, rough.id); check(r.projects[0].consultation.notificationFailed === 1, 'SUMMARY_FAILURE_MISSING');
  });
  await test('mobile-360-and-390-no-nested-thread-scroll-or-horizontal-overflow', async () => {
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/natori/inquiries?project=${rough.id}&view=conversation`);
      await expect(page.getByRole('textbox', { name: 'メッセージ', exact: true })).toBeVisible();
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'MOBILE_OVERFLOW');
      check(await page.locator('[aria-label="相談のやり取り"] ol').evaluate(node => getComputedStyle(node).overflowY !== 'auto'), 'NESTED_SCROLL');
    }
    await page.getByRole('dialog').screenshot({ path: '/results/phase4-consultation-mobile.png' });
  });
  await test('history-error-is-not-empty-and-saved-send-is-not-reported-as-unsent', async () => {
    await clientPage.route('**/api/natori/consult/*', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
    await clientPage.getByRole('textbox', { name: 'メッセージ', exact: true }).fill('Saved before history outage');
    await clientPage.getByRole('button', { name: 'メッセージを送信', exact: true }).click();
    await expect(clientPage.getByRole('alert').filter({ hasText: '送信は保存済み' })).toBeVisible();
    await expect(clientPage.getByText(/返信はまだありません/)).toHaveCount(0);
    await expect(clientPage.getByRole('button', { name: 'メッセージを送信', exact: true })).toBeDisabled();
    const saved = await admin.from('natori_consultation_messages').select('id').eq('project_id', rough.id).eq('body', 'Saved before history outage'); check(saved.data?.length === 1, 'SAVED_MESSAGE_COUNT');
    await clientPage.unroute('**/api/natori/consult/*'); await clientPage.getByRole('button', { name: '履歴を更新', exact: true }).click();
    await expect(clientPage.getByText('Saved before history outage', { exact: true })).toBeVisible();
  });
  await test('detail-fetch-failure-is-visible-and-retry-recovers', async () => {
    await page.route('**/api/natori/admin/projects?projectId=*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto(`/natori/inquiries?project=${prep.id}`);
    await expect(page.getByRole('alert').filter({ hasText: '案件の詳細を取得できませんでした。再試行してください。' })).toBeVisible();
    await page.unroute('**/api/natori/admin/projects?projectId=*'); await page.getByRole('button', { name: '詳細を再試行' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '相談に返信', exact: true }).click();
    await page.route('**/api/natori/admin/projects?projectId=*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.getByRole('textbox', { name: 'メッセージ', exact: true }).fill('Reply before detail refresh outage');
    await page.getByRole('button', { name: 'メッセージを送信', exact: true }).click();
    await expect(page.getByText('Reply before detail refresh outage', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('alert').filter({ hasText: '表示中の案件情報が古い可能性があります。' })).toBeVisible();
    await page.unroute('**/api/natori/admin/projects?projectId=*');
    await page.getByRole('button', { name: '案件情報を再取得', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('依頼者の返信待ち', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '案件情報を再取得', exact: true })).toHaveCount(0);
  });
  await test('no-unhandled-browser-or-hydration-errors', async () => {
    check(browserProblems.size === 0, 'BROWSER_RUNTIME_ERRORS');
  });
  console.log(`Phase 4 browser diagnostics: ${[...browserProblems].join(',') || 'none'}`);
  await client.close(); await manager.close();
  const summary = { tests: results, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, skipped: 0, engine: 'Chromium 1.58.2; mobile viewport only, not iPhone Safari', providerRequests: providerCalls, browserProblems: [...browserProblems] };
  writeFileSync('/results/phase4-browser.json', JSON.stringify(summary, null, 2));
  console.log(`PHASE 4 ${summary.passed} passed / ${summary.failed} failed / 0 skipped`);
  check(results.length === 17 && summary.failed === 0, 'PHASE4_FAILED');
}
main().catch(() => { console.error(`Phase 4 failed at ${stage}; raw URLs and credentials withheld`); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (server?.exitCode === null) { server.kill('SIGTERM'); await Promise.race([new Promise(r => server.once('exit', r)), new Promise(r => setTimeout(() => { server.kill('SIGKILL'); r(); }, 5000))]); }
  if (capture) await new Promise(r => capture.close(r));
});
