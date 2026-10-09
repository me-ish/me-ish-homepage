import { test } from '@playwright/test';
import { observePausedPage } from './helpers/legacy-pause';

for (const path of ['/mypage', '/mypage/portfolio']) {
  test(`gallery workspace is paused without creating a profile: ${path}`, async ({ page }) => {
    await observePausedPage(page, path);
  });
}
