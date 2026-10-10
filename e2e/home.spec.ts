import { test, expect } from '@playwright/test';

test.describe('Home entry', () => {
  test.use({ locale: 'ja-JP' });
  for (const locale of ['', '/ja', '/en']) {
    test(`opens the current Natori portfolio from ${locale || '/'}`, async ({ page }) => {
      await page.goto(locale || '/');
      // Wait for the server redirect and cold compilation before asserting.
      await page.waitForURL(`**${locale === '/en' ? '/en' : ''}/natori/portfolio`);
      await expect(page).toHaveURL(`http://localhost:3000${locale === '/en' ? '/en' : ''}/natori/portfolio`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }
});
