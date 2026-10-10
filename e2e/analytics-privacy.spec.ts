import { expect, test, type Page } from '@playwright/test';

const GA_FLAG = 'ga-disable-G-EZR21G5Q2T';
const PUBLIC_PATH = '/ja/service-paused?service=aura';
// Intentionally shorter than the service token minimum: no DB lookup is needed.
const PRIVATE_PATH = '/ja/natori/quote/synthetic-token';

// Small vendor models exercise synchronous history collection. Every script and
// collection request is intercepted: no test telemetry reaches either vendor.
const googleScript = `(() => {
  function send() {
    if (window['${GA_FLAG}'] === true) return;
    fetch('https://www.google-analytics.com/g/collect', { method: 'POST', body: JSON.stringify({url: location.href, referrer: document.referrer}) });
  }
  const push = history.pushState.bind(history);
  history.pushState = function(...args) { push(...args); send(); };
  addEventListener('popstate', send);
  send();
})();`;

const vercelScript = `(() => {
  let beforeSend = event => event;
  window.va = (type, value) => { if (type === 'beforeSend') beforeSend = value; };
  (window.vaq || []).forEach(([type, value]) => window.va(type, value));
  function send() {
    const event = beforeSend({type: 'pageview', url: location.href});
    if (event === null) return;
    fetch('/_vercel/insights/view', { method: 'POST', body: JSON.stringify({...event, referrer: document.referrer}) });
  }
  const push = history.pushState.bind(history);
  history.pushState = function(...args) { push(...args); send(); };
  addEventListener('popstate', send);
  send();
})();`;

async function interceptAnalytics(page: Page) {
  const scripts: string[] = [];
  const events: string[] = [];
  const writes: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
      scripts.push('google');
      return route.fulfill({ contentType: 'application/javascript', body: googleScript });
    }
    if ((url.hostname === 'va.vercel-scripts.com' && url.pathname.endsWith('.js')) || url.pathname === '/_vercel/insights/script.js') {
      scripts.push('vercel');
      return route.fulfill({ contentType: 'application/javascript', body: vercelScript });
    }
    if (url.hostname === 'www.google-analytics.com' || url.pathname.startsWith('/_vercel/insights/')) {
      events.push(request.postData() ?? request.url());
      return route.fulfill({ status: 204, body: '' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    if (url.hostname !== 'localhost' || url.port !== '3000') return route.abort();
    return route.continue();
  });
  return { scripts, events, writes };
}

for (const locale of ['', '/ja', '/en']) {
  for (const surface of ['consult', 'quote', 'delivery']) {
    test(`no analytics loads on ${locale || 'default'}/${surface}`, async ({ page }) => {
      const observed = await interceptAnalytics(page);
      await page.goto(`${locale}/natori/${surface}/synthetic-token`);
      await expect(page.locator('body')).toHaveClass(/font-zen/);
      // Proves that the root client gate hydrated; an error shell is insufficient.
      await expect.poll(() => page.evaluate((flag) => Reflect.get(window, flag), GA_FLAG)).toBe(true);
      expect(observed.scripts).toEqual([]);
      expect(observed.events).toEqual([]);
      expect(observed.writes).toEqual([]);
    });
  }
}

test('public analytics works, then private navigation stops synchronous and later events', async ({ page }) => {
  const observed = await interceptAnalytics(page);
  await page.goto(PUBLIC_PATH);
  await expect.poll(() => observed.scripts.length).toBe(2);
  await expect.poll(() => observed.events.length).toBe(2);
  const before = observed.events.length;
  await page.evaluate((path) => history.pushState({}, '', path), PRIVATE_PATH);
  await expect.poll(() => page.evaluate((flag) => Reflect.get(window, flag), GA_FLAG)).toBe(true);
  await page.evaluate((path) => history.pushState({}, '', path), PUBLIC_PATH);
  await expect(page.getByRole('heading', { name: '新規受付を休止しています' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(observed.events).toHaveLength(before);
  expect(observed.events.some((event) => event.includes('synthetic-token'))).toBe(false);
  expect(observed.writes).toEqual([]);
});

test('a private referrer prevents analytics on a fresh public document', async ({ page }) => {
  const observed = await interceptAnalytics(page);
  await page.goto(PUBLIC_PATH, { referer: `http://localhost:3000${PRIVATE_PATH}` });
  await expect.poll(() => page.evaluate((flag) => Reflect.get(window, flag), GA_FLAG)).toBe(true);
  expect(observed.scripts).toEqual([]);
  expect(observed.events).toEqual([]);
  expect(observed.writes).toEqual([]);
});
