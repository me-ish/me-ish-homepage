import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// The parent runner supplies an already-running disposable app. No DB/client
// credentials or real tokens are needed, and every network mutation is blocked.
let app, output, chromium, expect, browser, stage = 'preflight';
const observations = [], results = [], blocked = [], harnessFailures = [], motionObservations = [];
const check = (value, code) => { if (!value) throw new Error(code); };
const knownCodes = new Set(["ASSERTION_FAILED", "AUTOPLAY_NOT_RUNNING", "INITIAL_AUTOPLAY_NOT_RUNNING", "AUTOPLAY_BEFORE_INTERVAL", "AUTOPLAY_PRECONDITION_NOT_READY", "CLOCK_NOT_FROZEN", "BROWSER_CLOSE_FAILED", "BROWSER_SETUP_FAILED", "CTA_COMPOSITING_REQUIRES_REVIEW", "DRAG_CLEARED_PAUSE", "DRAG_NOT_TRACKING", "EPHEMERAL_REQUIRED", "LOCAL_APP_REQUIRED", "LONG_FINAL_CONDITION", "LONG_REPLY_TRUNCATED", "MANUAL_PAUSE_LOST", "MANUAL_RESUME_FAILED", "MANUAL_RESUME_BEFORE_INTERVAL", "PAUSED_DRAG_BLOCKED", "PUBLIC_CONFIRMATION_FLOW", "PUBLIC_IMMEDIATE_QUOTE_PROMISE", "PUBLIC_IMPORTANT_TERMS_PRESERVED", "PUBLIC_NOT_CONFIRMED", "PUBLIC_REPLY_PROMISE", "REDUCED_MOTION_AUTOPLAY", "REDUCED_MOTION_MANUAL_BLOCKED", "RESULT_WRITE_FAILED", "SHORT_MULTILINE_FIXTURE", "SHORT_REPLY_TRUNCATED", "UNKNOWN_FAILURE", "UNSUPPORTED_COMPUTED_COLOR", "VERTICAL_TOUCH_CHANGED_IMAGE", "VERTICAL_TOUCH_MOVED_SLIDE"]);
const ctaIds = ['hero', 'quote', 'consultation', 'delivery', 'delivery-disabled', 'download', 'mass-production', 'form-next', 'form-submit', 'mobile'];
for (const name of ctaIds) {
  knownCodes.add(`CTA_FOCUS_${name}`);
  for (const theme of ['light', 'dark']) for (const state of ['normal', 'hover', 'focus', 'disabled', 'disabled-hover']) knownCodes.add(`CTA_CONTRAST_${name}_${theme}_${state}`);
}
for (const theme of ['light', 'dark']) knownCodes.add(`APP_THEME_CLASS_${theme}`);
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
  console.error(`Phase 6B browser failed at ${stage}: ${code}; raw logs withheld`); process.exitCode = 1;
}
async function test(name, run) {
  try { await run(); results.push({ name, status: 'passed' }); console.log(`PASS phase6b/${name}`); }
  catch (error) { results.push({ name, status: 'failed', message: safeFailure(error, 'ASSERTION_FAILED') }); console.log(`FAIL phase6b/${name}`); }
}
async function isolate(context) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== app || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push({ destination: url.origin === app ? 'local-mutation' : 'external', method: request.method() });
      return route.abort('blockedbyclient');
    }
    if (url.pathname === '/api/natori/consult/phase6b-synthetic-only') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [], closed: false }) });
    }
    // No other API reads are necessary for this synthetic rendering fixture.
    if (url.pathname.startsWith('/api/')) return route.abort('blockedbyclient');
    return route.continue();
  });
}
async function colors(locator) {
  return locator.evaluate(element => {
    const rgba = value => {
      const parts = value.match(/[\d.]+/g)?.map(Number);
      if (!parts || parts.length < 3) throw new Error('UNSUPPORTED_COMPUTED_COLOR');
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [...front.slice(0, 3).map((channel, index) => (channel * front[3] + back[index] * back[3] * (1 - front[3])) / alpha), alpha];
    };
    const chain = [];
    for (let node = element; node; node = node.parentElement) chain.unshift(node);
    let background = [255, 255, 255, 1];
    for (const node of chain) {
      const style = getComputedStyle(node);
      if (Number(style.opacity) !== 1 || style.filter !== 'none') throw new Error('CTA_COMPOSITING_REQUIRES_REVIEW');
      background = over(rgba(style.backgroundColor), background);
    }
    const style = getComputedStyle(element), foreground = over(rgba(style.color), background);
    const luminance = value => {
      const channels = value.slice(0, 3).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    const focusElement = element.closest('button,a') ?? element;
    return { foreground, background, contrast: (values[1] + 0.05) / (values[0] + 0.05), focusVisible: focusElement.matches(':focus-visible'), outline: getComputedStyle(focusElement).outlineStyle, opacity: style.opacity };
  });
}
async function contrastStates(page, name, locator, theme, disabled = false) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  for (const state of disabled ? ['disabled', 'disabled-hover'] : ['normal', 'hover', 'focus']) {
    await page.mouse.move(1, 1);
    await page.getByTestId('outside-focus').focus();
    if (state.includes('hover')) await locator.hover({ force: true });
    if (state === 'focus') { await page.keyboard.press('Tab'); await locator.evaluate(element => (element.closest('button,a') ?? element).focus()); }
    const value = await colors(locator);
    observations.push({ name, theme, state, ...value });
    check(value.contrast >= 4.5, `CTA_CONTRAST_${name}_${theme}_${state}`);
    if (state === 'focus') check(value.focusVisible && value.outline !== 'none', `CTA_FOCUS_${name}`);
  }
}
async function touch(page, locator, points) {
  await locator.evaluate((element, coordinates) => {
    const [from, to] = coordinates;
    const value = point => new Touch({ identifier: 42, target: element, clientX: point[0], clientY: point[1] });
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [value(from)] }));
    element.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [value(to)] }));
  }, points);
}
async function endTouch(locator, point) {
  await locator.evaluate((element, value) => element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [new Touch({ identifier: 42, target: element, clientX: value[0], clientY: value[1] })] })), point);
}
const motionCheckpoints = ['INITIAL_AUTOPLAY_BASELINE', 'INITIAL_AUTOPLAY_OBSERVED', 'HYDRATED_PAUSE', 'FROZEN_PAUSE', 'AUTOPLAY_BASELINE', 'AUTOPLAY_BEFORE_INTERVAL', 'AUTOPLAY_PENDING', 'AUTOPLAY_SETTLED', 'MANUAL_PAUSE_BASELINE', 'MANUAL_PAUSE_RETAINED', 'DRAG_TRACKING', 'PAUSED_DRAG_SETTLED', 'DRAG_PAUSE_RETAINED', 'VERTICAL_TOUCH_RETAINED', 'RESUME_BASELINE', 'RESUME_BEFORE_INTERVAL', 'RESUME_PENDING', 'RESUME_SETTLED'];
async function recordMotion(hero, checkpoint, clockOrigin = null) {
  check(motionCheckpoints.includes(checkpoint), 'AUTOPLAY_PRECONDITION_NOT_READY');
  const value = await hero.evaluate((element, origin) => {
    const region = element.querySelector('[role="region"][aria-label="代表作品"]');
    const track = element.querySelector('[data-testid="hero-slide-track"]');
    const button = region?.querySelector('button[aria-pressed]');
    const dots = Array.from(region?.querySelectorAll('button[aria-current],button[aria-label$="枚目を表示"]') ?? []);
    const index = dots.findIndex(dot => dot.getAttribute('aria-current') === 'true');
    const transitionActive = (track?.style.transition ?? 'none') !== 'none';
    const rawOffset = track ? new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 + track.parentElement.clientWidth : null;
    const trackOffsetPx = rawOffset !== null && Number.isFinite(rawOffset) && Math.abs(rawOffset) <= 4096 ? Math.round(rawOffset * 1000) / 1000 : null;
    const trackState = trackOffsetPx === null ? 'unknown' : trackOffsetPx === 0 ? 'center' : transitionActive ? (trackOffsetPx < 0 ? 'next' : 'previous') : 'drag';
    return {
      virtualElapsedMs: origin === null ? null : Date.now() - origin,
      manualPausePressed: button?.getAttribute('aria-pressed') === 'true',
      pauseControlDisabled: button?.disabled === true,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      hoverWithin: region?.matches(':hover') ?? false,
      focusWithin: region?.contains(document.activeElement) ?? false,
      activeIndex: index === 0 || index === 1 ? index : null,
      trackState,
      trackOffsetPx,
      transitionActive,
    };
  }, clockOrigin);
  motionObservations.push({ checkpoint, ...value });
  return value;
}
try {
  check(process.env.PHASE_6B_BROWSER === 'ephemeral', 'EPHEMERAL_REQUIRED');
  app = process.env.PHASE_6B_APP_URL ?? 'http://localhost:3000';
  check(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(app), 'LOCAL_APP_REQUIRED');
  const require = createRequire('/app/package.json');
  ({ chromium, expect } = require('@playwright/test'));
  output = resolve(process.env.PHASE_6B_RESULTS ?? '/tmp/phase6b-browser-results');
  mkdirSync(output, { recursive: true });
  stage = 'browser-setup';
  browser = await chromium.launch({ headless: true });
  stage = 'cases';
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme, hasTouch: true, reducedMotion: 'no-preference' });
    await isolate(context); const page = await context.newPage();
    await page.goto(`${app}/ja/fixture-phase6b`);
    await test(`important-cta-all-states-${theme}`, async () => {
      const previouslyDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      try {
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
        check(await page.evaluate(() => document.documentElement.classList.contains('dark')) === (theme === 'dark'), `APP_THEME_CLASS_${theme}`);
        await contrastStates(page, 'hero', page.getByTestId('hero').getByRole('link', { name: '相談・見積もり', exact: true }), theme);
        const quote = page.getByTestId('quote').getByRole('button', { name: 'この内容で依頼を確定する', exact: true });
        await expect(quote).toBeDisabled(); await contrastStates(page, 'quote', quote, theme, true);
        await page.getByTestId('quote').getByRole('checkbox').check(); await contrastStates(page, 'quote', quote, theme);
        const consult = page.getByTestId('consultation').getByRole('button', { name: 'メッセージを送信', exact: true });
        await expect(consult).toBeDisabled(); await contrastStates(page, 'consultation', consult, theme, true);
        await page.getByTestId('consultation').getByLabel('メッセージ', { exact: true }).fill('Synthetic reply');
        await expect(consult).toBeEnabled(); await contrastStates(page, 'consultation', consult, theme);
        await contrastStates(page, 'delivery', page.getByTestId('delivery').getByRole('button', { name: '内容を確認し、受け取りを完了する', exact: true }), theme);
        await contrastStates(page, 'delivery-disabled', page.getByTestId('delivery-disabled').getByRole('button', { name: '内容を確認し、受け取りを完了する', exact: true }), theme, true);
        await contrastStates(page, 'download', page.getByTestId('delivery').locator('a[href="/phase6b-a.svg"] > span').last(), theme);
        const mass = page.getByTestId('pricing').getByRole('link', { name: 'このプランで相談', exact: true }).last();
        await contrastStates(page, 'mass-production', mass, theme);
        const form = page.getByTestId('form');
        await contrastStates(page, 'form-next', form.getByRole('button', { name: '内容を確認する', exact: true }), theme);
        await form.getByLabel(/お名前/).fill('Synthetic'); await form.getByLabel(/メールアドレス/).fill('client@phase6b.invalid'); await form.getByLabel(/ご相談・ご依頼の内容/).fill('Synthetic consultation');
        await form.getByRole('button', { name: '内容を確認する', exact: true }).click();
        const submit = form.getByRole('button', { name: '相談内容を送信する', exact: true });
        await contrastStates(page, 'form-submit', submit, theme);
        // Native disabled semantics are sampled without triggering submission.
        await submit.evaluate(button => { button.disabled = true; });
        await contrastStates(page, 'form-submit', submit, theme, true);
        await submit.evaluate(button => { button.disabled = false; });
        await page.getByTestId('short-summary').scrollIntoViewIfNeeded();
        const mobile = page.locator('a.fixed').filter({ hasText: '相談・見積もり' });
        await expect(mobile).toBeVisible(); await contrastStates(page, 'mobile', mobile, theme);
        await page.screenshot({ path: resolve(output, `mobile-${theme}.png`), fullPage: true });
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(mobile).toBeHidden(); await page.screenshot({ path: resolve(output, `desktop-${theme}.png`), fullPage: true });
      } finally {
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), previouslyDark);
      }
    });
    await test(`observed-public-copy-projection-${theme}`, async () => {
      const workflow = page.getByTestId('workflow');
      await expect(workflow.locator('li')).toHaveCount(5);
      const reply = workflow.locator('li').nth(1);
      await reply.scrollIntoViewIfNeeded();
      await expect(reply.getByText('内容のご相談・お見積もり', { exact: true })).toBeVisible();
      check((await reply.textContent()).includes('2〜3日以内にお返事します。'), 'PUBLIC_REPLY_PROMISE');
      check((await reply.textContent()).includes('金額・納期とご依頼確定のページ'), 'PUBLIC_CONFIRMATION_FLOW');
      check(!(await reply.textContent()).includes('以内にお見積もりメール'), 'PUBLIC_IMMEDIATE_QUOTE_PROMISE');
      check((await workflow.locator('li').nth(0).textContent()).includes('フォームの送信だけでご依頼は確定しません。'), 'PUBLIC_NOT_CONFIRMED');
      check((await workflow.locator('li').nth(3).textContent()).includes('量産イラストは原則リテイクなし'), 'PUBLIC_IMPORTANT_TERMS_PRESERVED');
    });
    await test(`short-and-long-original-text-${theme}`, async () => {
      for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
        await page.setViewportSize(size);
        const short = page.getByTestId('short-summary').locator('[data-field="message"]'), long = page.getByTestId('long-summary').locator('[data-field="message"]');
        const values = await short.evaluate(element => ({ text: element.textContent, height: element.clientHeight, scrollHeight: element.scrollHeight, lineClamp: getComputedStyle(element).webkitLineClamp, whiteSpace: getComputedStyle(element).whiteSpace }));
        check(values.text.length <= 140 && values.text.split('\n').length === 6, 'SHORT_MULTILINE_FIXTURE');
        check(values.scrollHeight <= values.height && ['none', '0', ''].includes(values.lineClamp) && values.whiteSpace === 'pre-wrap', 'SHORT_REPLY_TRUNCATED');
        check((await long.textContent()).endsWith('最後の条件：AI学習は禁止です。'), 'LONG_FINAL_CONDITION');
        check(await long.evaluate(element => element.scrollHeight <= element.clientHeight && getComputedStyle(element).whiteSpace === 'pre-wrap'), 'LONG_REPLY_TRUNCATED');
      }
    });
    await context.close();
  }
  await test('manual-pause-resume-touch-and-vertical-scroll', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'no-preference' });
    await isolate(context); const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-01-01T00:00:00.000Z') });
    await page.goto(`${app}/ja/fixture-phase6b`);
    const hero = page.getByTestId('hero'), surface = hero.getByTestId('hero-slide-surface'), track = hero.getByTestId('hero-slide-track');
    const active = () => hero.locator('[aria-hidden="false"] img').getAttribute('alt');
    // Observe untouched default autoplay before any manual control, sampling the
    // actual image instead of a single full-cycle endpoint on the natural clock.
    await page.mouse.move(1, 1); await page.getByTestId('outside-focus').focus();
    const initial = await active(); await recordMotion(hero, 'INITIAL_AUTOPLAY_BASELINE');
    try { await expect.poll(active, { timeout: 10000, intervals: [100] }).not.toBe(initial); }
    catch { throw new Error('INITIAL_AUTOPLAY_NOT_RUNNING'); }
    await recordMotion(hero, 'INITIAL_AUTOPLAY_OBSERVED');
    // A successful actual React handler and settled manual pause establish hydration.
    await hero.getByRole('button', { name: '自動送りを停止', exact: true }).click();
    await expect(hero.getByRole('button', { name: '自動送りを再開', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => track.evaluate(element => element.style.transition)).toBe('none');
    await recordMotion(hero, 'HYDRATED_PAUSE');
    // Freeze while paused, so the jump cannot advance the two-image carousel.
    const clockOrigin = new Date('2026-01-02T00:00:00.000Z').getTime();
    await page.clock.pauseAt(clockOrigin);
    check(await page.evaluate(() => Date.now()) === clockOrigin, 'CLOCK_NOT_FROZEN');
    await recordMotion(hero, 'FROZEN_PAUSE', clockOrigin);
    await hero.getByRole('button', { name: '自動送りを再開', exact: true }).click();
    await expect(hero.getByRole('button', { name: '自動送りを停止', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(1, 1); await page.getByTestId('outside-focus').focus();
    const baseline = await recordMotion(hero, 'AUTOPLAY_BASELINE', clockOrigin);
    check(!baseline.manualPausePressed && !baseline.pauseControlDisabled && !baseline.reducedMotion && !baseline.hoverWithin && !baseline.focusWithin && !baseline.transitionActive, 'AUTOPLAY_PRECONDITION_NOT_READY');
    const first = await active();
    await page.clock.runFor(4999); await recordMotion(hero, 'AUTOPLAY_BEFORE_INTERVAL', clockOrigin);
    check(await active() === first, 'AUTOPLAY_BEFORE_INTERVAL');
    await page.clock.runFor(1);
    await expect.poll(async () => await track.evaluate(element => element.style.transition !== 'none') || await active() !== first).toBe(true);
    await recordMotion(hero, 'AUTOPLAY_PENDING', clockOrigin);
    await page.clock.runFor(600); await recordMotion(hero, 'AUTOPLAY_SETTLED', clockOrigin);
    check(await active() !== first, 'AUTOPLAY_NOT_RUNNING');
    await hero.getByRole('button', { name: '自動送りを停止', exact: true }).click();
    await page.mouse.move(1, 1); await page.getByTestId('outside-focus').focus(); const paused = await active();
    await recordMotion(hero, 'MANUAL_PAUSE_BASELINE', clockOrigin);
    await page.clock.runFor(16000); await recordMotion(hero, 'MANUAL_PAUSE_RETAINED', clockOrigin); check(await active() === paused, 'MANUAL_PAUSE_LOST');
    await touch(page, surface, [[250, 150], [170, 152]]);
    const dragging = await recordMotion(hero, 'DRAG_TRACKING', clockOrigin);
    // CSSOM may serialize '+ -80px' as '- 80px'; measure the actual displacement.
    check(dragging.trackOffsetPx === -80, 'DRAG_NOT_TRACKING');
    await endTouch(surface, [120, 152]); await page.clock.runFor(600); await recordMotion(hero, 'PAUSED_DRAG_SETTLED', clockOrigin); check(await active() !== paused, 'PAUSED_DRAG_BLOCKED');
    const swiped = await active(); await page.clock.runFor(16000); await recordMotion(hero, 'DRAG_PAUSE_RETAINED', clockOrigin); check(await active() === swiped, 'DRAG_CLEARED_PAUSE');
    await touch(page, surface, [[170, 150], [175, 260]]); check(!(await track.getAttribute('style')).includes('105px'), 'VERTICAL_TOUCH_MOVED_SLIDE');
    // Sample during the touchmove, before touchend can snap a wrong drag back.
    const vertical = await recordMotion(hero, 'VERTICAL_TOUCH_RETAINED', clockOrigin);
    check(vertical.trackOffsetPx === 0, 'VERTICAL_TOUCH_MOVED_SLIDE');
    await endTouch(surface, [175, 260]); check(await active() === swiped, 'VERTICAL_TOUCH_CHANGED_IMAGE');
    await hero.getByRole('button', { name: '自動送りを再開', exact: true }).click(); await page.mouse.move(1, 1); await page.getByTestId('outside-focus').focus();
    await recordMotion(hero, 'RESUME_BASELINE', clockOrigin);
    await page.clock.runFor(4999); await recordMotion(hero, 'RESUME_BEFORE_INTERVAL', clockOrigin);
    check(await active() === swiped, 'MANUAL_RESUME_BEFORE_INTERVAL');
    await page.clock.runFor(1);
    // Let the actual React transition commit before advancing its settle budget.
    // A slow transport may already observe a completed CSS transition.
    await expect.poll(async () => await track.evaluate(element => element.style.transition !== 'none') || await active() !== swiped).toBe(true);
    await recordMotion(hero, 'RESUME_PENDING', clockOrigin);
    await page.clock.runFor(600); await recordMotion(hero, 'RESUME_SETTLED', clockOrigin); check(await active() !== swiped, 'MANUAL_RESUME_FAILED');
    // Chromium touch event arbitration is evidence for axis handling only.
    // Real iPhone vertical scroll/back-button acceptance remains a Phase 7 step.
    await context.close();
  });
  await test('reduced-motion-honored-manual-navigation-preserved', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await isolate(context); const page = await context.newPage(); await page.clock.install(); await page.goto(`${app}/ja/fixture-phase6b`);
    const hero = page.getByTestId('hero'), active = () => hero.locator('[aria-hidden="false"] img').getAttribute('alt');
    await expect(hero.getByRole('button', { name: '自動送り停止中', exact: true })).toBeDisabled();
    const first = await active(); await page.clock.runFor(16000); check(await active() === first, 'REDUCED_MOTION_AUTOPLAY');
    await hero.getByRole('button', { name: '次の作品', exact: true }).click(); check(await active() !== first, 'REDUCED_MOTION_MANUAL_BLOCKED');
    await context.close();
  });
} catch (error) {
  recordHarnessFailure(stage, safeFailure(error, 'BROWSER_SETUP_FAILED'));
} finally {
  if (browser) {
    try { await browser.close(); }
    catch (error) { recordHarnessFailure('browser-close', safeFailure(error, 'BROWSER_CLOSE_FAILED')); }
  }
  if (output) {
    try {
      writeFileSync(resolve(output, 'result.json'), JSON.stringify({ results, observations, blocked, harnessFailures, motionObservations, realProvider: false, productionContentWrite: false, realEmail: false, iPhoneAcceptance: 'pending' }, null, 2));
    } catch (error) { recordHarnessFailure('result-write', safeFailure(error, 'RESULT_WRITE_FAILED')); }
  }
}
if (results.some(result => result.status !== 'passed') || harnessFailures.length > 0) process.exitCode = 1;
