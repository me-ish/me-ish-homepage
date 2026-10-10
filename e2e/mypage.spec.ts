import { test } from '@playwright/test';
import { observePausedPage } from './helpers/legacy-pause';

for (const path of ['/mypage', '/mypage/portfolio', '/renew']) {
  for (const prefix of ['', '/en']) {
    test(`gallery workspace stays paused without writes: ${prefix}${path}`, async ({ page }) => {
      await observePausedPage(page, `${prefix}${path}`, prefix === '/en');
    });
  }
}
