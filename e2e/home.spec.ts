import { test, expect } from '@playwright/test';

test.describe('Home entry', () => {
  for (const locale of ['', '/ja', '/en']) {
    test(`opens the current Natori portfolio from ${locale || '/'}`, async ({ page }) => {
      await page.goto(locale || '/');
      await expect(page).toHaveURL(new RegExp(`${locale === '/en' ? '/en' : ''}/natori/portfolio$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }
});
