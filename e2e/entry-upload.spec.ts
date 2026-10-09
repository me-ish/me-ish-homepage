import { test } from '@playwright/test';
import { observePausedPage } from './helpers/legacy-pause';

for (const path of ['/entry', '/ja/entry', '/renew']) {
  test(`gallery intake is paused without uploading: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await observePausedPage(page, path);
  });
}
