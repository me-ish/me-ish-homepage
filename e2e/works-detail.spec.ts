import { test, expect } from '@playwright/test';

test('old works no longer publish content, including localized IDs', async ({ page }) => {
  await page.goto('/ja/works/legacy.id');
  await expect(page.getByRole('heading', { name: '公開を終了しました' })).toBeVisible();
  await expect(page.locator('form, canvas')).toHaveCount(0);
});

test('old Natori artist address leads to the current portfolio', async ({ page }) => {
  await page.goto('/artists/natori');
  await expect(page).toHaveURL(/\/natori\/portfolio$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
