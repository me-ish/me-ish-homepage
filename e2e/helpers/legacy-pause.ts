import { expect, type Page } from '@playwright/test';

/** No browser requests may reach production while checking suspended screens. */
export async function observePausedPage(page: Page, path: string, english = false) {
  const writes: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port === '54321') {
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(path);
  await expect(page.getByRole('heading', {
    name: english ? 'New requests are currently paused' : '新規受付を休止しています',
  })).toBeVisible();
  await expect(page.getByRole('link', { name: english ? 'Contact us' : 'お問い合わせ', exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"], form')).toHaveCount(0);
  expect(writes).toEqual([]);
}
