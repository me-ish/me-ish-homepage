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
let stage = 'preflight', checkpoint = 'START', server, browser, capture;
async function test(name, fn) {
  stage = name; checkpoint = 'START';
  try { await fn(); results.push({ name, status: 'passed' }); console.log(`PASS phase1-browser/${name}`); }
  catch (error) {
    const message = error?.message ?? '', code = /^[A-Z_0-9]+$/.test(message) ? message
      : message.includes('strict mode violation') ? 'STRICT_LOCATOR' : 'ASSERTION_FAILED';
    const line = error?.stack?.match(/browser\.mjs:\d+:\d+/)?.[0] ?? '';
    results.push({ name, status: 'failed', code, checkpoint, line }); console.log(`FAIL phase1-browser/${name} ${code} ${checkpoint} ${line}`);
  }
}
async function main() {
  check(process.env.PHASE_N_BROWSER === 'ephemeral', 'EPHEMERAL_REQUIRED');
  const { origin } = JSON.parse(readFileSync('/runtime/network.json', 'utf8'));
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), 'DESTINATION_REJECTED');
  const keys = JSON.parse(readFileSync('/runtime/credentials.json', 'utf8'));
  const admin = createClient(origin, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const password = randomBytes(32).toString('hex'), sharedKey = randomBytes(32).toString('hex'), apiKey = randomBytes(32).toString('hex');
  const ownerEmail = 'phase1-owner@phase0b-browser.invalid';
  const auth = await admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
  check(!auth.error && auth.data.user, 'AUTH_FIXTURE'); const owner = auth.data.user.id;
  const hash = value => createHash('sha256').update(value).digest('hex');
  const past = new Date(Date.now() - 3600000).toISOString();
  async function project(title, extra = {}) {
    const r = await admin.from('natori_projects').insert({ user_id: owner, title, client_name: 'Synthetic browser',
      client_email: 'client@phase-1.invalid', amount: 12000, type: 'icon', status: 'delivery_prep',
      payment_confirmed_at: past, paid_at: past, paid_amount: 12000, request_data: { original: true }, agreed_terms: { original: true }, ...extra }).select('*').single();
    check(!r.error && r.data, 'PROJECT_FIXTURE'); return r.data;
  }
  const primary = await project('Phase 1 browser delivery');
  let rejectReceipts = false, providerCalls = 0; const messages = new Map();
  capture = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += String(chunk);
    try {
      const p = JSON.parse(body), recipients = [p.to, p.bcc, p.reply_to].flat().filter(Boolean), key = req.headers['idempotency-key'];
      check(req.headers.authorization === `Bearer ${apiKey}` && p.from === 'Phase 1 <sender@phase-1.invalid>'
        && recipients.every(a => ['artist@phase-1.invalid', 'client@phase-1.invalid', 'bcc@phase-1.invalid'].includes(a)), 'CAPTURE_ALLOWLIST');
      providerCalls++; res.setHeader('content-type', 'application/json');
      if (rejectReceipts && p.headers?.['X-Meish-Template'] !== 'natori-delivery') { res.writeHead(422); res.end('{}'); return; }
      const previous = messages.get(key); if (previous && previous.body !== body) { res.writeHead(409); res.end('{}'); return; }
      const id = previous?.id ?? randomUUID(); messages.set(key, { id, body }); res.end(JSON.stringify({ id }));
    } catch { res.writeHead(400); res.end('{}'); }
  });
  await new Promise(resolve => capture.listen(3101, '127.0.0.1', resolve));
  stage = 'next-start';
  server = spawn(process.execPath, ['--require', '/browser-test/provider-preload.cjs', '/app/node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3000'], { cwd: '/app', env: {
    PATH: '/runtime-bin:/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', TMPDIR: '/tmp', NODE_ENV: 'development', NODE_OPTIONS: '--dns-result-order=ipv4first', NEXT_TELEMETRY_DISABLED: '1', PHASE_N_BROWSER: 'ephemeral', PHASE_0B_BROWSER: 'ephemeral',
    NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service,
    NATORI_DASHBOARD_KEY: sharedKey, NATORI_OWNER_USER_ID: owner, NATORI_OWNER_EMAILS: ownerEmail, NEXT_PUBLIC_SITE_URL: appOrigin,
    NATORI_ACCEPTANCE_OUTBOX_ENABLED: '1', NATORI_NOTIFICATION_SENDING_ENABLED: '1', NATORI_DELIVERY_INTEGRITY_ENABLED: '1',
    NATORI_DELIVERY_NOTIFICATION_KEY: randomBytes(32).toString('hex'), RESEND_API_KEY: apiKey,
    NATORI_ORDER_MAIL_FROM: 'Phase 1 <sender@phase-1.invalid>', NATORI_PORTFOLIO_CONTACT_TO: 'artist@phase-1.invalid', NATORI_MAIL_BCC: 'bcc@phase-1.invalid',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  const classifications = new Set();
  for (const stream of [server.stdout, server.stderr]) stream.on('data', b => {
    const s = b.toString(); for (const code of ['Module not found', 'Failed to compile', 'SyntaxError', 'EADDRINUSE']) if (s.includes(code)) classifications.add(code);
  });
  let ready = false; const deadline = Date.now() + 120000;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      const r = await fetch(`${appOrigin}/ja/fixture-session`, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
      if (r.ok) { ready = true; break; }
      if (r.status >= 300 && r.status < 400) {
        const next = new URL(r.headers.get('location'), appOrigin); check(next.origin === appOrigin, 'REDIRECT_OUTSIDE');
        if ((await fetch(next, { signal: AbortSignal.timeout(2000), redirect: 'manual' })).ok) { ready = true; break; }
      }
    } catch { /* bounded polling; no raw URLs */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) { console.log(`Next startup: ${[...classifications].join(',')}`); throw new Error('NEXT_NOT_READY'); }
  browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
  async function context() {
    const c = await browser.newContext({ baseURL: appOrigin, serviceWorkers: 'block' }); c.setDefaultTimeout(15000); c.setDefaultNavigationTimeout(60000);
    c.on('page', page => {
      page.on('pageerror', () => browserProblems.add('UNHANDLED_PAGE_ERROR'));
      page.on('console', message => {
        if (!['warning', 'error'].includes(message.type())) return;
        if (/hydrat|cannot be a descendant|cannot contain a nested/i.test(message.text())) browserProblems.add('DOM_OR_HYDRATION');
      });
    }); return c;
  }
  const manager = await context(), client = await context(), page = await manager.newPage(), clientPage = await client.newPage();
  await page.goto(`/natori/dashboard?natori-key=${sharedKey}`);
  await expect(page.getByRole('heading', { name: '承諾・受取のメール通知' })).toBeVisible({ timeout: 60000 });
  const headers = { 'x-requested-with': 'me-ish' };
  const projectRow = async id => { const r = await admin.from('natori_projects').select('*').eq('id', id).single(); check(!r.error && r.data, 'PROJECT_READ'); return r.data; };
  const jobs = async id => { const r = await admin.from('natori_notification_jobs').select('*').eq('project_id', id).order('created_at'); check(!r.error, 'JOBS_READ'); return r.data; };
  async function token(id) {
    const [job] = (await jobs(id)).filter(j => j.purpose === 'delivery_issue_client' && j.status === 'sent'); check(job, 'NOTICE_SENT');
    const p = JSON.parse(messages.get(`natori-notice/${job.id}`)?.body ?? '{}');
    const match = p.text?.match(/\/natori\/delivery\/([A-Za-z0-9_-]{20,64})/); check(match, 'CAPTURE_TOKEN'); return match[1];
  }
  async function upload(id, name = 'synthetic.bin') {
    const bytes = Buffer.from('Synthetic browser delivery bytes'), fileId = randomUUID();
    const r = await manager.request.post('/api/natori/admin/delivery-files', { headers, data: { projectId: id, folder: 'final', fileName: name, sizeBytes: bytes.length, contentType: 'application/octet-stream', fileId } });
    check(r.ok(), 'RESERVE_HTTP'); const f = await r.json();
    check(!(await admin.storage.from('natori-deliveries').uploadToSignedUrl(f.path, f.token, bytes, { contentType: 'application/octet-stream' })).error, 'UPLOAD_STORAGE');
    check((await manager.request.patch('/api/natori/admin/delivery-files', { headers, data: { fileId } })).ok(), 'FINALIZE_HTTP'); return { ...f, bytes };
  }
  async function publish(id, files, operationId = randomUUID()) {
    const r = await manager.request.post('/api/natori/admin/order-mail', { headers, data: { kind: 'delivery', projectId: id, fileIds: files.map(f => f.fileId), operationId, to: 'client@phase-1.invalid', subject: 'Synthetic delivery', body: 'Synthetic\n{納品リンク}', amount: 12000 } });
    check(r.ok() && (await r.json()).ok, 'PUBLISH_HTTP'); return token(id);
  }
  let primaryToken, first, partial, partialFiles, partialToken;
  const acceptButton = () => clientPage.getByRole('button', { name: '内容を確認し、受け取りを完了する', exact: true });
  await test('admin-auth-csrf-and-foreign-owner-boundary', async () => {
    check((await client.request.patch('/api/natori/admin/delivery-files', { headers, data: { fileId: randomUUID() } })).status() === 401, 'ANON_FINALIZE');
    check((await manager.request.patch('/api/natori/admin/delivery-files', { data: { fileId: randomUUID() } })).status() === 403, 'FINALIZE_CSRF');
    const outsider = await admin.auth.admin.createUser({ email: 'phase1-stranger@phase0b-browser.invalid', password, email_confirm: true }); check(outsider.data.user, 'FOREIGN_AUTH');
    const p = await project('FOREIGN_SENTINEL', { user_id: outsider.data.user.id });
    const r = await manager.request.post('/api/natori/admin/delivery-files', { headers, data: { projectId: p.id, folder: 'final', fileName: 'foreign.bin', sizeBytes: 32 } });
    check(r.status() === 404, 'FOREIGN_WRITE');
  });
  await test('real-management-ui-upload-finalize-and-publication', async () => {
    checkpoint = 'PROJECTS'; await page.goto('/natori/projects');
    const card = page.getByRole('article').filter({ hasText: primary.title }); await expect(card).toBeVisible({ timeout: 60000 });
    await card.getByRole('button', { name: '納品メール', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '納品メールを送る' }); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '納品メールを送信', exact: true })).toBeDisabled();
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6S8AAAAASUVORK5CYII=', 'base64');
    checkpoint = 'UPLOAD'; await dialog.locator('input[type="file"]').setInputFiles({ name: 'browser-synthetic.png', mimeType: 'image/png', buffer: bytes });
    await expect(dialog.getByText('保存確認済み', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByRole('button', { name: '納品メールを送信', exact: true })).toBeEnabled();
    checkpoint = 'SEND'; await dialog.getByRole('button', { name: '納品メールを送信', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('送信しました。', { timeout: 30000 });
    primaryToken = await token(primary.id); first = await projectRow(primary.id);
    check(first.status === 'delivered' && first.delivered_mail_at && first.delivery_accepted_at === null, 'PUBLICATION_STATE');
    await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  });
  await test('public-get-is-readonly-download-has-real-bytes-and-refresh-resigns', async () => {
    check(primaryToken, 'PRIMARY_NOT_READY'); const before = await projectRow(primary.id), beforeJobs = await jobs(primary.id);
    await clientPage.goto(`/natori/delivery/${primaryToken}`); await expect(acceptButton()).toBeEnabled({ timeout: 30000 });
    const link = clientPage.getByRole('link', { name: /browser-synthetic.png/ });
    await expect(link).toHaveAttribute('target', '_blank'); const href = await link.getAttribute('href');
    const data = await client.request.get(href); check(data.ok() && (await data.body()).length === 68, 'FILE_DOWNLOAD');
    await expect(clientPage.getByText('保存期限：', { exact: false })).toBeVisible();
    await clientPage.getByRole('button', { name: 'ファイルと受取状況を更新' }).click(); await expect(acceptButton()).toBeEnabled();
    check(JSON.stringify(before) === JSON.stringify(await projectRow(primary.id)) && JSON.stringify(beforeJobs) === JSON.stringify(await jobs(primary.id)), 'GET_WROTE_STATE');
  });
  await test('real-browser-signed-tus-upload-over-six-mib-and-finalize', async () => {
    const p = await project('Phase 1 browser resumable upload'); await page.reload();
    const card = page.getByRole('article').filter({ hasText: p.title }); await expect(card).toBeVisible({ timeout: 30000 });
    await card.getByRole('button', { name: '納品メール', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '納品メールを送る' }), bytes = Buffer.alloc(7 * 1024 * 1024, 0x4b);
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'browser-resumable.bin', mimeType: 'application/octet-stream', buffer: bytes });
    await expect(dialog.getByText('保存確認済み', { exact: true })).toBeVisible({ timeout: 30000 });
    const files = await admin.from('natori_delivery_files').select('*').eq('project_id', p.id); check(!files.error && files.data.length === 1 && files.data[0].state === 'ready', 'BROWSER_TUS_READY');
    const signed = await admin.storage.from('natori-deliveries').createSignedUrl(files.data[0].storage_path, 60); check(signed.data, 'BROWSER_TUS_READ_SIGN');
    const downloaded = await client.request.get(signed.data.signedUrl); check(downloaded.ok() && (await downloaded.body()).equals(bytes), 'BROWSER_TUS_BYTES');
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  });
  await test('accepted-focus-and-reload-survive-both-receipt-mail-failures', async () => {
    rejectReceipts = true; await acceptButton().focus(); await clientPage.keyboard.press('Enter');
    await expect(clientPage.getByRole('status')).toContainText('受け取りを確認しました。', { timeout: 30000 });
    check(await clientPage.evaluate(() => document.activeElement?.getAttribute('role') === 'status'), 'ACCEPT_FOCUS');
    await expect.poll(async () => (await jobs(primary.id)).filter(j => j.purpose.startsWith('delivery_accept_') && j.status === 'failed').length, { timeout: 30000 }).toBe(2);
    const done = await projectRow(primary.id); check(done.status === 'completed' && done.delivery_accepted_at, 'ACCEPT_COMMIT');
    await clientPage.reload(); await expect(clientPage.getByRole('status')).toContainText('受け取りを確認しました。');
    check((await projectRow(primary.id)).delivery_accepted_at === done.delivery_accepted_at, 'RELOAD_RESET'); rejectReceipts = false;
  });
  await test('completed-management-resend-keeps-original-link-and-receipt', async () => {
    const before = await projectRow(primary.id); await page.reload();
    const card = page.getByRole('article').filter({ hasText: primary.title });
    checkpoint = 'RESEND_CONTROL'; await card.getByRole('button', { name: '納品メールを再送', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '納品メールを送る' });
    await expect(dialog.getByText('納品発行済み', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'ファイルを追加', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: '納品メールを送信', exact: true }).click(); await expect(dialog.getByRole('status')).toContainText('送信しました。', { timeout: 30000 });
    const after = await projectRow(primary.id); check(JSON.stringify(before) === JSON.stringify(after), 'RESEND_MUTATED_FACTS');
    await clientPage.goto(`/natori/delivery/${primaryToken}`); await expect(clientPage.getByRole('status')).toContainText('受け取りを確認しました。');
    await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  });
  await test('stale-enabled-page-rejects-acceptance-after-file-disappears', async () => {
    partial = await project('Partial browser delivery'); partialFiles = [await upload(partial.id, 'remaining.bin'), await upload(partial.id, 'missing.bin')];
    partialToken = await publish(partial.id, partialFiles); await clientPage.goto(`/natori/delivery/${partialToken}`); await expect(acceptButton()).toBeEnabled();
    check(!(await admin.storage.from('natori-deliveries').remove([partialFiles[1].path])).error, 'REMOVE_FIXTURE');
    await acceptButton().click(); await expect(clientPage.getByRole('alert')).toContainText('受取は完了していません。');
    check((await projectRow(partial.id)).delivery_accepted_at === null && (await projectRow(partial.id)).status === 'delivered', 'STALE_ACCEPTED');
  });
  await test('partial-file-is-not-hidden-and-mobile-cta-is-disabled', async () => {
    await clientPage.getByRole('button', { name: 'ファイルと受取状況を更新' }).click();
    await expect(acceptButton()).toBeDisabled(); await expect(clientPage.getByText('missing.bin', { exact: true })).toBeVisible();
    await expect(clientPage.getByText('このファイルを取得できません。', { exact: true })).toBeVisible();
    await expect(clientPage.getByRole('link', { name: /remaining.bin/ })).toBeVisible();
    await clientPage.setViewportSize({ width: 390, height: 844 });
    check(await clientPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'MOBILE_OVERFLOW');
    await clientPage.screenshot({ path: '/results/phase1-partial-mobile.png' });
  });
  await test('expired-legacy-link-shows-contact-and-does-not-extend', async () => {
    const t = randomBytes(24).toString('base64url'), p = await project('Expired browser delivery', { status: 'delivered', delivery_token_hash: hash(t), delivery_token_expires_at: past, delivered_mail_at: past });
    const before = await projectRow(p.id); await clientPage.goto(`/natori/delivery/${t}`);
    await expect(clientPage.getByText('納品ページの有効期限が切れています。', { exact: false })).toBeVisible();
    await expect(acceptButton()).toHaveCount(0); check(JSON.stringify(before) === JSON.stringify(await projectRow(p.id)) && (await jobs(p.id)).length === 0, 'EXPIRY_REISSUED');
  });
  await test('acceptance-response-loss-shows-unconfirmed-and-refresh-recovers', async () => {
    // Browser response loss after a real accepted POST must recover via readonly refresh.
    const p = await project('Response loss browser delivery'), f = await upload(p.id); const t = await publish(p.id, [f]);
    await clientPage.goto(`/natori/delivery/${t}`); await expect(acceptButton()).toBeEnabled();
    await clientPage.route('**/api/natori/delivery/accept', async route => { await route.fetch(); await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
    await acceptButton().click(); await expect(clientPage.getByRole('alert')).toContainText('受取結果を確認できませんでした。');
    const confirmed = await projectRow(p.id); check(confirmed.delivery_accepted_at && confirmed.status === 'completed', 'RESPONSE_LOSS_NOT_COMMITTED');
    await clientPage.unroute('**/api/natori/delivery/accept'); await clientPage.getByRole('button', { name: 'ファイルと受取状況を更新' }).click();
    await expect(clientPage.getByRole('status')).toContainText('受け取りを確認しました。');
    check((await projectRow(p.id)).delivery_accepted_at === confirmed.delivery_accepted_at, 'REFRESH_DUPLICATE');
  });
  await test('ciphertext-only-history-and-no-browser-dom-errors', async () => {
    const records = await jobs(primary.id); check(records.filter(j => j.purpose === 'delivery_issue_client').length === 2, 'RESEND_COUNT');
    check(records.filter(j => j.purpose === 'delivery_issue_client').every(j => !JSON.stringify(j).includes(primaryToken) && j.payload.format === 'natori-delivery-aes256gcm-v1'), 'PLAIN_TOKEN_STORED');
    check(browserProblems.size === 0, [...browserProblems].join('_') || 'BROWSER_ERROR');
  });
  await manager.close(); await client.close();
  writeFileSync('/results/phase1-browser.json', JSON.stringify({ tests: results, passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length, skipped: 0, providerRequests: providerCalls,
    engine: 'Chromium 1.58.2; mobile viewport only, not iPhone Safari', browserProblems: [...browserProblems] }, null, 2));
  console.log(`PHASE 1 BROWSER ${results.filter(r => r.status === 'passed').length} passed / ${results.filter(r => r.status === 'failed').length} failed / 0 skipped`);
  check(results.length === 11 && results.every(r => r.status === 'passed'), 'BROWSER_FAILED');
}
main().catch(() => { console.error(`Phase 1 browser failed at ${stage}; raw URLs, credentials and logs withheld`); process.exitCode = 1; })
  .finally(async () => {
    await browser?.close();
    if (server?.exitCode === null) { server.kill('SIGTERM'); await Promise.race([new Promise(r => server.once('exit', r)), new Promise(r => setTimeout(() => { server.kill('SIGKILL'); r(); }, 5000))]); }
    if (capture) await new Promise(r => capture.close(r));
  });
