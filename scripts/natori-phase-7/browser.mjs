import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
let createClient, chromium, expect, fixture, execution, contract, evidence, browser, activePage, stage = 'preflight';
const check = (value, code) => { if (!value) throw new Error(code); };
const app = 'http://localhost:3000', output = '/results/phase7-screens';
const results = [], blocked = [], harnessFailures = [], managementContrast = [], estimateContrast = [];
const ids = ['gallery-list-and-modal', 'works-showcase-index', 'intake-confirmation-and-edit', 'estimate-return-link-and-review', 'client-quote-full-conditions', 'latest-management-card'];
const knownCodes = new Set(["ACTUAL_DRAFT_READ", "ACTUAL_SOURCE_CHANGED", "ASSERTION_FAILED", "BROWSER_CLOSE_FAILED", "BROWSER_FAILED", "BROWSER_RESULT_WRITE_FAILED", "BROWSER_SETUP_FAILED", "BUSINESS_FACTS_PRESERVED", "BUSINESS_FACTS_READ", "DECORATION_PRESERVED", "DESTINATION_REJECTED", "EDIT_TARGET_SIZE", "EPHEMERAL_REQUIRED", "ESTIMATE_CTA_COLOR_REQUIRED", "ESTIMATE_CTA_CONTRAST", "ESTIMATE_CTA_FOCUS", "FIELD_DISCLOSURE_LOOP", "HISTORICAL_DRAFT_LOCK", "HORIZONTAL_OVERFLOW", "MANAGEMENT_CTA_COLOR_REQUIRED", "MANAGEMENT_CTA_CONTRAST", "MANAGEMENT_CTA_FOCUS", "MODAL_CLOSE_TARGET", "NAMED_EDIT_TARGETS", "RESULT_WRITE_FAILED", "SCREEN_EVIDENCE_WRITE_FAILED", "SCREEN_TEMPLATE_REQUIRED", "SHOWCASE_NO_SALES_CTA", "SNAPSHOT_CHANGED", "SURFACE_WRAPPER_REQUIRED", "SYNTHETIC_FIXTURE_REQUIRED", "UNEXPECTED_MUTATION", "UNKNOWN_FAILURE"]);
function diagnosticMessage(error) {
  try { const message = error?.message; return typeof message === 'string' ? message : ''; }
  catch { return ''; }
}
function safeFailure(error, fallback) {
  const message = diagnosticMessage(error);
  return knownCodes.has(message) ? message : knownCodes.has(fallback) ? fallback : 'UNKNOWN_FAILURE';
}
function recordHarnessFailure(stage, code) {
  if (!harnessFailures.some(failure => failure.stage === stage && failure.code === code)) harnessFailures.push({ stage, code });
  console.error(`Phase 7 browser failed at ${stage}: ${code}; raw logs withheld`); process.exitCode = 1;
}
function updateEvidenceStatus() {
  evidence.status = harnessFailures.length === 0 && results.length === 18 && results.every(result => result.status === 'passed') ? 'captured_pending_human_evaluation' : 'capture_incomplete_or_failed';
  for (const capture of evidence.captures) {
    const tests = results.filter(result => result.screen === capture.screen);
    capture.status = harnessFailures.length > 0 ? 'capture_failed' : tests.length === 3 && tests.every(result => result.status === 'passed') ? 'captured_pending_human_review' : tests.some(result => result.status === 'failed') ? 'capture_failed' : 'not_run';
  }
}
function persist() {
  let writeFailed = false;
  if (evidence) {
    try { updateEvidenceStatus(); writeFileSync('/results/phase7-screen-evidence.json', JSON.stringify(evidence, null, 2)); }
    catch { writeFailed = true; recordHarnessFailure('result-write', 'SCREEN_EVIDENCE_WRITE_FAILED'); }
  }
  try {
    writeFileSync('/results/phase7-browser.json', JSON.stringify({ tests: results, passed: results.filter(result => result.status === 'passed').length,
      failed: results.filter(result => result.status === 'failed').length, skipped: 0, blocked, harnessFailures, managementContrast, estimateContrast,
      engine: 'Playwright Chromium 1.58.2; PC1280/360/390px; not physical iPhone Safari', provider: 'No Stripe provider mutation or financial operation configured',
      human_evaluation: 'Actual captures must still be reviewed; no comprehension or conversion claim' }, null, 2));
  } catch { writeFailed = true; recordHarnessFailure('result-write', 'BROWSER_RESULT_WRITE_FAILED'); }
  if (writeFailed) {
    if (evidence) { try { updateEvidenceStatus(); writeFileSync('/results/phase7-screen-evidence.json', JSON.stringify(evidence, null, 2)); } catch { /* Fixed failure already recorded. */ } }
    throw new Error('RESULT_WRITE_FAILED');
  }
}
async function test(screen, width, run) {
  stage = `${screen}-${width}`;
  try { await run(); results.push({ screen, width, status: 'passed' }); console.log(`PASS phase7/${stage}`); }
  catch (error) {
    const message = diagnosticMessage(error), matcher = ['toBeVisible', 'toHaveText', 'toContainText', 'toHaveCount', 'toHaveValue', 'toBeEnabled', 'toBeFocused'].find(name => message.includes(name)) ?? null;
    results.push({ screen, width, status: 'failed', code: safeFailure(error, 'ASSERTION_FAILED'), strictLocatorViolation: message.includes('strict mode violation'), matcher });
    console.log(`FAIL phase7/${stage}`);
    try { if (activePage && await activePage.locator('[data-phase7-surface]').count() === 1) await screenshot(activePage, screen, width, 'failed-current-screen'); }
    catch { /* Best-effort failure capture cannot erase the failed test. */ }
  } finally { persist(); }
}
async function isolated(context) {
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== app) { blocked.push({ kind: 'external', method: request.method() }); return route.abort('blockedbyclient'); }
    if (!['GET', 'HEAD'].includes(request.method()) && !(request.method() === 'POST' && url.pathname === '/api/fixture-session')) {
      const telemetry = url.pathname === '/api/natori/track'; blocked.push({ kind: telemetry ? 'analytics-excluded' : 'unexpected-local-mutation', method: request.method() });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
}
async function screenshot(page, screen, width, state, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  for (const image of await page.locator('[data-phase7-surface] img').all()) {
    await image.evaluate(element => { element.loading = 'eager'; });
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0), { timeout: 15000 }).toBe(true);
  }
  check(await page.locator('[data-phase7-surface]').count() === 1, 'SURFACE_WRAPPER_REQUIRED');
  const relative = `phase7-screens/${screen}-${width}-${state}.png`, path = '/results/' + relative;
  await page.screenshot({ path, fullPage, animations: 'disabled', style: 'nextjs-portal{display:none!important}' });
  const bytes = readFileSync(path), capture = evidence.captures.find(entry => entry.screen === screen);
  capture.artifacts.push({ path: relative, viewport_width: width, state, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    synthetic_art: true, actual_product_source: true, human_review: 'pending' });
  persist();
}
async function managementColors(locator) {
  return locator.evaluate(element => {
    const fail = () => { throw new Error('MANAGEMENT_CTA_COLOR_REQUIRED'); };
    const rgba = text => {
      const match = /^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/.exec(text);
      if (!match) return fail();
      const value = [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
      if (!value.every(Number.isFinite) || value.slice(0, 3).some(channel => channel < 0 || channel > 255) || value[3] < 0 || value[3] > 1) return fail();
      return value;
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (!(alpha > 0)) return fail();
      return [...front.slice(0, 3).map((channel, index) => (channel * front[3] + back[index] * back[3] * (1 - front[3])) / alpha), alpha];
    };
    const chain = []; for (let node = element; node; node = node.parentElement) chain.unshift(node);
    let background = [255, 255, 255, 1];
    for (const node of chain) {
      const style = getComputedStyle(node);
      if (Number(style.opacity) !== 1 || style.filter !== 'none') return fail();
      background = over(rgba(style.backgroundColor), background);
    }
    const style = getComputedStyle(element), foreground = over(rgba(style.color), background);
    const luminance = value => value.slice(0, 3).map(channel => channel / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const levels = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    const contrast = (levels[1] + 0.05) / (levels[0] + 0.05);
    if (!Number.isFinite(contrast) || contrast < 1 || contrast > 21) return fail();
    return { foreground, background, contrast, hovered: element.matches(':hover'), focused: document.activeElement === element,
      focusVisible: element.matches(':focus-visible'), outlineVisible: !['none', 'hidden'].includes(style.outlineStyle) && parseFloat(style.outlineWidth) > 0 };
  });
}
async function managementContrastStates(page, width, action, locator) {
  await expect(locator).toBeVisible(); await expect(locator).toBeEnabled(); await locator.scrollIntoViewIfNeeded();
  for (const state of ['normal', 'hover', 'focus']) {
    await page.mouse.move(1, 1); await locator.evaluate(element => element.ownerDocument.activeElement?.blur());
    if (state === 'hover') await locator.hover();
    if (state === 'focus') { await page.keyboard.press('Tab'); await locator.focus(); }
    // Observe the settled shared CTA state; a transition's intermediate color is not a hover measurement.
    await expect.poll(() => locator.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(state === 'hover' ? 'rgb(157, 23, 77)' : 'rgb(190, 24, 93)');
    const value = await managementColors(locator);
    managementContrast.push({ width, action, state, ...value });
    check(value.contrast >= 4.5, 'MANAGEMENT_CTA_CONTRAST');
    check(state === 'hover' ? value.hovered : !value.hovered, 'MANAGEMENT_CTA_COLOR_REQUIRED');
    check(state === 'focus' ? value.focused && value.focusVisible && value.outlineVisible : !value.focused, 'MANAGEMENT_CTA_FOCUS');
  }
  await page.mouse.move(1, 1); await locator.evaluate(element => element.ownerDocument.activeElement?.blur());
}
async function estimateContrastStates(page, width, step, control, locator) {
  await expect(locator).toHaveCount(1); await expect(locator).toBeVisible(); await expect(locator).toBeEnabled(); await locator.scrollIntoViewIfNeeded();
  for (const state of ['normal', 'hover', 'focus']) {
    await page.mouse.move(1, 1); await locator.evaluate(element => element.ownerDocument.activeElement?.blur());
    if (state === 'hover') await locator.hover();
    if (state === 'focus') { await page.keyboard.press('Tab'); await locator.focus(); }
    await expect.poll(() => locator.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(state === 'hover' ? 'rgb(157, 23, 77)' : 'rgb(190, 24, 93)');
    let value;
    try { value = await managementColors(locator); } catch { throw new Error('ESTIMATE_CTA_COLOR_REQUIRED'); }
    estimateContrast.push({ width, step, control, state, ...value });
    check(value.contrast >= 4.5, 'ESTIMATE_CTA_CONTRAST');
    check(state === 'hover' ? value.hovered : !value.hovered, 'ESTIMATE_CTA_COLOR_REQUIRED');
    check(state === 'focus' ? value.focused && value.focusVisible && value.outlineVisible : !value.focused, 'ESTIMATE_CTA_FOCUS');
  }
  await page.mouse.move(1, 1); await locator.evaluate(element => element.ownerDocument.activeElement?.blur());
}
async function revealField(page, selector) {
  const field = page.locator(selector);
  const closed = () => field.locator('xpath=ancestor::details[not(@open)]');
  for (let count = 0; await closed().count() > 0; count++) { check(count < 6, 'FIELD_DISCLOSURE_LOOP'); await closed().first().locator(':scope > summary').click(); }
  return field;
}
async function noOverflow(page) { check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'HORIZONTAL_OVERFLOW'); }
async function main() {
  const require = createRequire('/app/package.json');
  ({ createClient } = require('@supabase/supabase-js')); ({ chromium, expect } = require('@playwright/test'));
  check(process.env.PHASE_7_BROWSER === 'ephemeral' && process.env.PHASE_N_BROWSER === 'ephemeral', 'EPHEMERAL_REQUIRED');
  mkdirSync(output, { recursive: true });
  fixture = JSON.parse(process.env.PHASE_7_FIXTURE_STATE ?? '{}');
  check(typeof fixture.quoteToken === 'string' && typeof fixture.email === 'string' && fixture.email.endsWith('@phase0b-browser.invalid'), 'SYNTHETIC_FIXTURE_REQUIRED');
  const checksumBytes = readFileSync('/app/source-checksums.json'); execution = JSON.parse(readFileSync('/app/phase7-execution.json', 'utf8'));
  check(createHash('sha256').update(checksumBytes).digest('hex') === execution.source_checksum_sha256, 'SNAPSHOT_CHANGED');
  contract = JSON.parse(readFileSync('/app/phase7-surface-contract.json', 'utf8'));
  for (const [path, sha] of Object.entries(contract.actual_source_sha256)) check(createHash('sha256').update(readFileSync('/app/' + path)).digest('hex') === sha, 'ACTUAL_SOURCE_CHANGED');
  const template = JSON.parse(readFileSync('/phase7-browser/screen-evidence.template.json', 'utf8'));
  check(Array.isArray(template?.captures) && template.captures.length === 6 && template.captures.every((capture, index) => capture?.screen === ids[index] && Array.isArray(capture.artifacts) && Array.isArray(capture.observed_findings)), 'SCREEN_TEMPLATE_REQUIRED');
  evidence = template;
  Object.assign(evidence, { integrated_head_sha: execution.head_sha, base_sha: execution.base_sha, ci_run_url: execution.ci_run_url,
    source_checksum_artifact: 'browser-source-checksums.json', execution, source_contract_sha256: createHash('sha256').update(readFileSync('/app/phase7-surface-contract.json')).digest('hex') });
  const { origin } = JSON.parse(readFileSync('/runtime/network.json', 'utf8')); check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), 'DESTINATION_REJECTED');
  const keys = JSON.parse(readFileSync('/runtime/credentials.json', 'utf8')), db = createClient(origin, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  async function facts() {
    const [projects, quotes, tasks, content, drafts] = await Promise.all([
      db.from('natori_projects').select('*').eq('user_id', fixture.owner).order('id'),
      db.from('natori_quotes').select('*').eq('user_id', fixture.owner).order('id'),
      db.from('natori_project_tasks').select('*').eq('project_id', fixture.managementId).order('task_key'),
      db.from('natori_portfolio_content').select('content').eq('id', 'main').single(),
      db.from('natori_estimate_drafts').select('*').eq('user_id', fixture.owner).order('project_id'),
    ]);
    check(!projects.error && !quotes.error && !tasks.error && !content.error && !drafts.error, 'BUSINESS_FACTS_READ');
    return createHash('sha256').update(JSON.stringify([projects.data, quotes.data, tasks.data, content.data, drafts.data])).digest('hex');
  }
  const before = await facts(); browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 800 }, { width: 390, height: 844 }]) {
    const width = viewport.width, context = await browser.newContext({ viewport, reducedMotion: 'reduce' }), page = await context.newPage();
    await isolated(context); activePage = page;
    try {
      await test(ids[0], width, async () => {
        await page.goto(app + '/ja/fixture-phase7/gallery');
        const first = page.getByRole('button', { name: 'Phase 7 synthetic work 1 を拡大表示', exact: true }); await expect(first).toBeVisible();
        const categories = page.getByRole('group', { name: '作品のカテゴリ' }); await expect(categories).toBeVisible();
        await expect(page.locator('#portfolio-gallery-results .pf-pin-card')).toHaveCount(6);
        const decoration = await first.locator('..').evaluate(element => ({ rotation: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
        evidence.captures[0].observed_findings.push({ width, decoration, interpretation: 'Decoration retained; synthetic work does not decide artist preference' });
        check(decoration.rotation !== 'none' && decoration.shadow !== 'none', 'DECORATION_PRESERVED');
        await screenshot(page, ids[0], width, 'list'); await noOverflow(page);
        await page.getByRole('button', { name: '全8作品を見る', exact: true }).click(); await expect(page.locator('#portfolio-gallery-results .pf-pin-card')).toHaveCount(8);
        await first.click(); const modal = page.getByRole('dialog', { name: 'Phase 7 synthetic work 1', exact: true }); await expect(modal).toBeVisible();
        await screenshot(page, ids[0], width, 'modal', false);
        const details = modal.getByRole('region', { name: '作品画像と詳細' }); await details.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await expect(modal.getByRole('link', { name: 'Synthetic usage reference' })).toHaveAttribute('href', 'https://phase7.invalid/usage');
        // Measure the existing 44px button target; its 36px inner circle is decorative.
        const close = modal.getByRole('button', { name: '閉じる', exact: true }), box = await close.boundingBox();
        evidence.captures[0].observed_findings.push({ width, close_target: { width: box?.width ?? null, height: box?.height ?? null, baseline_px: 44, review_decision: 'Existing 44px button target retained; physical iPhone touch assessment pending' } });
        check(box && box.width >= 44 && box.height >= 44, 'MODAL_CLOSE_TARGET');
        await screenshot(page, ids[0], width, 'modal-details', false); await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(first).toBeFocused();
        await page.getByRole('button', { name: 'Phase 7 synthetic work 2 を拡大表示', exact: true }).click();
        const second = page.getByRole('dialog', { name: 'Phase 7 synthetic work 2', exact: true }); await expect(second).toBeVisible(); await second.getByRole('button', { name: '閉じる' }).click(); await expect(second).toHaveCount(0);
        await categories.getByRole('button').nth(1).click(); await expect(page.locator('#portfolio-gallery-results .pf-pin-card')).toHaveCount(4); await noOverflow(page);
      });
      await test(ids[1], width, async () => {
        await page.goto(app + '/ja/fixture-phase7/showcase'); const root = page.locator('[data-phase7-surface=showcase]');
        await expect(root.getByRole('button', { name: 'Phase 7 synthetic work 1 を拡大表示', exact: true })).toBeVisible();
        check(await root.locator('a[href*="/contact"],a[href*="#commission"],a[href*="#pricing"],form').count() === 0, 'SHOWCASE_NO_SALES_CTA');
        await screenshot(page, ids[1], width, 'index'); await noOverflow(page);
        await root.getByRole('button', { name: 'Phase 7 synthetic work 1 を拡大表示', exact: true }).click();
        const modal = page.getByRole('dialog', { name: 'Phase 7 synthetic work 1', exact: true }); await expect(modal).toBeVisible();
        await expect(modal.getByRole('link', { name: 'Synthetic usage reference' })).toHaveCount(0); await screenshot(page, ids[1], width, 'modal', false);
        await modal.getByRole('button', { name: '閉じる' }).click(); await noOverflow(page);
      });
      await test(ids[2], width, async () => {
        await page.goto(app + '/ja/fixture-phase7/intake');
        await (await revealField(page, '#pf-request-type')).selectOption('illustration'); await (await revealField(page, '#pf-scope')).selectOption('full_body');
        await page.locator('#pf-message').fill('Synthetic original request\nLine 2: preserve character\nLine 3: preserve expression\nLine 4: preserve usage\nLine 5: preserve publication\nImportant final condition: no AI training');
        await page.getByRole('button', { name: '条件・連絡先へ', exact: true }).click();
        await page.locator('#pf-name').fill('Synthetic Phase 7 client'); await page.locator('#pf-email').fill('client@phase7.invalid');
        await (await revealField(page, '#pf-commercial')).selectOption('yes'); await page.locator('#pf-publication').selectOption('delayed'); await page.locator('#pf-publication-allowed-from').fill('2026-11-15');
        await (await revealField(page, '#pf-budget-kind')).selectOption('fixed'); await page.locator('#pf-budget-fixed').fill('12000');
        await page.locator('#pf-deadline-kind').selectOption('preferred_date'); await page.locator('#pf-deadline-date').fill('2026-11-15');
        await page.getByRole('button', { name: '内容を確認する', exact: true }).click(); const confirmation = page.getByRole('region', { name: '送信前の確認' });
        for (const text of ['Important final condition: no AI training', '全身', '商用利用する', '2026年11月15日', '12,000', 'Synthetic Phase 7 client', 'client@phase7.invalid']) await expect(confirmation).toContainText(text);
        await screenshot(page, ids[2], width, 'confirmation'); await noOverflow(page);
        const edits = confirmation.getByRole('button', { name: /を修正する$/ }); check(await edits.count() >= 5, 'NAMED_EDIT_TARGETS');
        for (const edit of await edits.all()) { const box = await edit.boundingBox(); check(box && box.width >= 44 && box.height >= 44, 'EDIT_TARGET_SIZE'); }
        await confirmation.getByRole('button', { name: '用途・条件を修正する', exact: true }).click();
        await expect(page.locator('#pf-commercial')).toHaveValue('yes'); await expect(page.locator('#pf-publication-allowed-from')).toHaveValue('2026-11-15');
        await screenshot(page, ids[2], width, 'edit-preserved'); await page.getByRole('button', { name: '内容を確認する', exact: true }).click();
        await expect(confirmation).toContainText('Important final condition: no AI training');
      });
      await test(ids[4], width, async () => {
        await page.goto(app + '/ja/fixture-phase7/quote/' + fixture.quoteToken); const quote = page.locator('[data-phase7-surface=quote]');
        for (const label of ['制作するもの', '制作範囲', '用途', '商用利用', '実績公開', '金額の内訳', 'お支払い方法', '承諾時のお支払条件', '現在の支払期限', '納品日', 'キャンセル・返金について']) await expect(quote.locator('dt').filter({ hasText: new RegExp('^' + label + '$') })).toBeVisible();
        for (const text of ['全身イラスト1点・表情差分1点、PNGで納品', '動画サムネイル・SNS告知', 'AI学習は禁止', '12,000', '2026年11月15日']) await expect(quote).toContainText(text);
        const deadline = quote.locator('dt').filter({ hasText: /^現在の支払期限$/ }).locator('..').locator('dd');
        await expect(deadline).toContainText(new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(fixture.deadline)));
        await expect(deadline).toContainText('再通知では期限は延長されません');
        await screenshot(page, ids[4], width, 'full-conditions'); await noOverflow(page);
      });
      await page.goto(app + '/ja/fixture-session'); await page.getByLabel('Email').fill(fixture.email); await page.getByLabel('Password').fill(fixture.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByText('Session ready', { exact: true })).toBeVisible();
      await test(ids[3], width, async () => {
        const isProjectRead = (response, pathname) => {
          const url = new URL(response.url());
          return url.pathname === pathname && url.searchParams.get('projectId') === fixture.estimateId && response.request().method() === 'GET';
        };
        const draftResponse = page.waitForResponse(response => isProjectRead(response, '/api/natori/admin/estimate-draft'));
        const recoveryResponse = page.waitForResponse(response => isProjectRead(response, '/api/natori/admin/structured-quote'));
        void draftResponse.catch(() => {}); void recoveryResponse.catch(() => {}); // Observe orphaned waits; both original promises remain awaited and asserted below.
        await page.goto(app + '/ja/fixture-phase7/estimate');
        const [response, recovered] = await Promise.all([draftResponse, recoveryResponse]);
        check(response.ok() && recovered.ok(), 'ACTUAL_DRAFT_READ');
        const data = await response.json(); check(data.editable === false && data.draft?.revision === 1, 'HISTORICAL_DRAFT_LOCK');
        await expect(data.draft.agreedTerms).toEqual({
          scope: 'full_body', scopeNote: '', deliverables: '全身イラスト1点・表情差分1点、PNGで納品',
          usage: '動画サムネイル・SNS告知', commercialUse: 'yes', publication: '2026年11月15日以降に公開可。AI学習は禁止',
          dueDate: '2026-11-15', memo: 'Synthetic internal memo',
        });
        await expect(data.draft.items).toEqual([{
          id: 'phase7-base', presetItemId: null, kind: 'manual', labelSnapshot: '全身イラスト・表情差分', quantity: 1,
          unitAmount: 12000, amount: 12000, automatic: false, sourceFields: [], ruleId: null, note: 'Synthetic saved item',
        }]);
        await expect(data.draft.items.reduce((total, item) => total + item.amount, 0)).toBe(12000);
        await expect(data.draft.mailDraft).toEqual({
          subject: 'Synthetic historical quote', body: 'Synthetic saved mail; not sent', templateBody: 'Synthetic saved mail; not sent',
        });
        const recovery = await recovered.json();
        check(recovery.enabled === true && recovery.issue?.version === 1 && recovery.issue.notificationStatus === 'legacy_unknown'
          && typeof recovery.issue.quoteId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recovery.issue.quoteId), 'HISTORICAL_DRAFT_LOCK');
        const root = page.locator('[data-phase7-surface=estimate]'), back = root.getByRole('link', { name: '← ダッシュボードへ戻る', exact: true });
        await expect(back).toHaveAttribute('href', '/natori/dashboard');
        await expect(root.getByRole('heading', { name: '正式見積りを発行しました', exact: true })).toBeVisible();
        await expect(root).toContainText('第1版の見積りは保存済みです');
        await expect(root).toContainText('条件と金額は変更できません');
        await expect(root.getByRole('heading', { name: '相手に見える内容を確認', exact: true })).toHaveCount(0);
        await expect(root.locator('#estimate-to, #estimate-subject, #estimate-body')).toHaveCount(0);
        await expect(root.getByRole('button', { name: '新しい版の作成を確認', exact: true })).toHaveCount(0);
        await expect(root.getByRole('button', { name: /^正式見積り .* を発行$/ })).toHaveCount(0);
        await screenshot(page, ids[3], width, 'return-and-review'); await noOverflow(page);

        // A separate unaccepted saved draft reaches the real editable controls without saving or issuing.
        const editableProjectRead = (response, pathname) => {
          const url = new URL(response.url());
          return url.pathname === pathname && url.searchParams.get('projectId') === fixture.editableEstimateId && response.request().method() === 'GET';
        };
        const editableDraftResponse = page.waitForResponse(response => editableProjectRead(response, '/api/natori/admin/estimate-draft'));
        const editableRecoveryResponse = page.waitForResponse(response => editableProjectRead(response, '/api/natori/admin/structured-quote'));
        void editableDraftResponse.catch(() => {}); void editableRecoveryResponse.catch(() => {});
        await page.goto(app + '/ja/fixture-phase7/editable-estimate');
        const [editableDraftRead, editableRecoveryRead] = await Promise.all([editableDraftResponse, editableRecoveryResponse]);
        check(editableDraftRead.ok() && editableRecoveryRead.ok(), 'ACTUAL_DRAFT_READ');
        const editableData = await editableDraftRead.json(), editableRecovery = await editableRecoveryRead.json();
        await expect(editableData.ok).toBe(true); await expect(editableData.editable).toBe(true);
        await expect(editableData.draft?.revision).toBe(1);
        await expect(editableData.draft.agreedTerms).toEqual(data.draft.agreedTerms);
        await expect(editableData.draft.items).toEqual(data.draft.items);
        await expect(editableData.draft.mailDraft).toBeUndefined();
        await expect(editableRecovery.enabled).toBe(true); await expect(editableRecovery.issue).toBeNull();
        const editable = page.locator('[data-phase7-surface=estimate]');
        await expect(editable.getByRole('heading', { name: '今回決まった条件', exact: true })).toBeVisible();
        await expect(editable.getByRole('link', { name: '← ダッシュボードへ戻る', exact: true })).toHaveAttribute('href', '/natori/dashboard');
        await expect(editable.locator('#estimate-scope')).toHaveValue('full_body');
        for (const [selector, value] of [['#estimate-deliverables', data.draft.agreedTerms.deliverables], ['#estimate-usage', data.draft.agreedTerms.usage],
          ['#estimate-commercial', 'yes'], ['#estimate-publication', data.draft.agreedTerms.publication], ['#estimate-due', '2026-11-15'], ['#estimate-memo', data.draft.agreedTerms.memo]]) {
          await expect(editable.locator(selector)).toHaveValue(value);
        }
        const navigation = editable.getByRole('navigation', { name: '見積りの手順', exact: true });
        const nav1 = navigation.getByRole('button', { name: '① 条件を整理', exact: true });
        const termsNext = editable.getByRole('button', { name: '条件を保存して金額へ →', exact: true });
        await expect(nav1).toHaveAttribute('aria-current', 'step');
        await estimateContrastStates(page, width, 1, 'navigation', nav1); await estimateContrastStates(page, width, 1, 'primary', termsNext);
        await screenshot(page, ids[3], width, 'editable-conditions'); await noOverflow(page);
        await termsNext.click();
        await expect(editable.getByRole('heading', { name: '今回の金額を決める', exact: true })).toBeVisible();
        await expect(editable.getByRole('textbox', { name: '明細名', exact: true })).toHaveValue(data.draft.items[0].labelSnapshot);
        await expect(editable.getByRole('spinbutton', { name: data.draft.items[0].labelSnapshot + 'の数量', exact: true })).toHaveValue('1');
        await expect(editable.getByRole('spinbutton', { name: data.draft.items[0].labelSnapshot + 'の単価', exact: true })).toHaveValue('12000');
        await expect(editable.getByText('今回の見積り合計', { exact: true }).locator('..')).toContainText('12,000');
        const nav2 = navigation.getByRole('button', { name: '② 金額を決める', exact: true });
        const priceNext = editable.getByRole('button', { name: '明細を保存して送信確認へ →', exact: true });
        await expect(nav2).toHaveAttribute('aria-current', 'step');
        await estimateContrastStates(page, width, 2, 'navigation', nav2); await estimateContrastStates(page, width, 2, 'primary', priceNext);
        await screenshot(page, ids[3], width, 'editable-price'); await noOverflow(page);
        await priceNext.click();
        await expect(editable.getByRole('heading', { name: '相手に見える内容を確認', exact: true })).toBeVisible();
        await expect(editable.getByRole('heading', { name: '正式見積りを発行しました', exact: true })).toHaveCount(0);
        for (const text of [data.draft.agreedTerms.deliverables, data.draft.agreedTerms.usage, data.draft.agreedTerms.publication, '12,000', '2026年11月15日']) await expect(editable).toContainText(text);
        await expect(editable.locator('#estimate-to')).toHaveValue('client@phase7.invalid');
        await expect(editable.locator('#estimate-subject')).not.toHaveValue(''); await expect(editable.locator('#estimate-body')).not.toHaveValue('');
        const acknowledge = editable.getByRole('checkbox', { name: '依頼者に見える内容と宛先を確認しました。', exact: true });
        await acknowledge.check();
        const nav3 = navigation.getByRole('button', { name: '③ 確認して送る', exact: true });
        const issue = editable.getByRole('button', { name: /^正式見積り .* を発行$/ });
        await expect(nav3).toHaveAttribute('aria-current', 'step');
        await estimateContrastStates(page, width, 3, 'navigation', nav3); await estimateContrastStates(page, width, 3, 'primary', issue);
        // Do not click issue or change any saved field. The same owner-scoped DB facts are compared after all cases.
        await screenshot(page, ids[3], width, 'editable-review'); await noOverflow(page);
        check(!blocked.some(item => item.kind === 'unexpected-local-mutation'), 'UNEXPECTED_MUTATION');
      });
      await test(ids[5], width, async () => {
        await page.goto(app + '/ja/fixture-phase7/management'); const card = page.getByRole('article', { name: 'Phase 7 active production', exact: true }); await expect(card).toBeVisible();
        for (const text of ['Synthetic Phase 7 client', 'ラフ', 'Synthetic rough: preserve original conditions']) await expect(card).toContainText(text);
        const expectedDueDate = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(2026, 10, 15));
        await expect(card.getByText('納期', { exact: true }).locator('..')).toContainText(expectedDueDate);
        const advance = card.getByRole('button', { name: '線画へ進む', exact: true }); await expect(advance).toBeEnabled();
        const paymentCard = page.getByRole('article', { name: 'Phase 7 historical estimate', exact: true }); await expect(paymentCard).toBeVisible();
        await expect(paymentCard).toContainText('Synthetic Phase 7 client');
        await expect(paymentCard).toContainText('入金待ち');
        await expect(paymentCard).toContainText('見積りの承諾待ち');
        const payment = paymentCard.getByRole('button', { name: '入金確認してラフ開始', exact: true }); await expect(payment).toBeEnabled();
        await managementContrastStates(page, width, 'advance', advance);
        await managementContrastStates(page, width, 'payment', payment);
        await screenshot(page, ids[5], width, 'latest-card'); await noOverflow(page);
        const taskDisclosure = card.getByRole('button', { name: /タスク/ });
        await expect(taskDisclosure).toHaveCount(1);
        // Observe the actual responsive default after its mounted effect.
        await expect(taskDisclosure).toHaveAttribute('aria-expanded', width >= 640 ? 'true' : 'false');
        if (await taskDisclosure.getAttribute('aria-expanded') === 'false') await taskDisclosure.click();
        await expect(taskDisclosure).toHaveAttribute('aria-expanded', 'true');
        await expect(card.getByRole('button', { name: /Synthetic rough task/ })).toBeEnabled();
        await screenshot(page, ids[5], width, 'tasks-visible'); await noOverflow(page);
      });
    } finally { await context.close(); }
  }
  check(await facts() === before, 'BUSINESS_FACTS_PRESERVED');
  check(!blocked.some(item => item.kind === 'unexpected-local-mutation'), 'UNEXPECTED_MUTATION');
  evidence.business_facts_unchanged = true; persist();
  check(results.length === 18 && results.every(result => result.status === 'passed'), 'BROWSER_FAILED');
}
try { await main(); }
catch (error) { recordHarnessFailure(stage, safeFailure(error, 'BROWSER_SETUP_FAILED')); }
finally {
  if (browser) {
    try { await browser.close(); }
    catch (error) { recordHarnessFailure('browser-close', safeFailure(error, 'BROWSER_CLOSE_FAILED')); }
  }
  try { persist(); }
  catch (error) { recordHarnessFailure('result-write', safeFailure(error, 'RESULT_WRITE_FAILED')); }
}
if (harnessFailures.length > 0 || results.some(result => result.status !== 'passed')) process.exitCode = 1;
