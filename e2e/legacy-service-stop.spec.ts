import { expect, test } from '@playwright/test';

// The web server configuration pins every Supabase client to the local dummy
// endpoint. These requests must be rejected before a legacy handler runs.
const blockedRequests = [
  ['GET', '/api/aura/checkout?requestId=offline'],
  ['GET', '/api/aura/form/submit?test_openai=1'],
  ['GET', '/api/card/checkout?requestId=offline'],
  ['POST', '/api/aura/draft'],
  ['POST', '/api/card/draft'],
  ['POST', '/api/entry/upload'],
  ['POST', '/api/purchase/stripe'],
  ['POST', '/api/ai-guide'],
  ['POST', '/api/entries/1/like'],
  ['POST', '/api/entries/1/comments'],
  ['POST', '/admin/api/entries/1/approve'],
  ['GET', '/api/cron/exhibit-end'],
  ['GET', '/api/cron/float-daily-slots'],
] as const;

for (const [method, path] of blockedRequests) {
  test(`legacy operation stops before side effects: ${method} ${path}`, async ({ request, baseURL }) => {
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const response = await request.fetch(path, {
      method,
      ...(method === 'POST' ? { data: { synthetic: true } } : {}),
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'legacy_service_paused' });
  });
}

test('old ownership link is stopped before its GET mutation', async ({ request }) => {
  const response = await request.get('/auth/link?token=offline', { maxRedirects: 0 });
  expect([307, 308]).toContain(response.status());
  expect(response.headers().location).toContain('/service-paused?service=gallery');
});

test('Natori login callback still returns to the requested management page', async ({ request }) => {
  const response = await request.get('/auth/callback?redirect=%2Fnatori%2Fdashboard', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location).pathname).toBe('/natori/dashboard');
});

test('signed-out artists can reach settlement login in their locale', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) && url.port !== '54321'
      ? route.continue()
      : route.abort();
  });
  await page.goto('/en/settings/bank');
  // The client redirect can compile /login on its first visit in the dev server.
  // Wait as a navigation rather than using the 5-second assertion timeout.
  await page.waitForURL(/\/en\/login\?redirect=%2Fen%2Fsettings%2Fbank/, { timeout: 30_000 });
  await expect(page.getByText('Existing artists can sign in to manage payout details. New service requests are paused.')).toBeVisible();
});

for (const path of ['/', '/natori/portfolio', '/etorie/demo/app/portfolio', '/footer/privacy']) {
  test(`retained public page is available: ${path}`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(new URL(response.url()).pathname).not.toContain('/service-paused');
  });
}
