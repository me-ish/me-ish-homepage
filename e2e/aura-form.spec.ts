import { test } from '@playwright/test';
import { observePausedPage } from './helpers/legacy-pause';

for (const path of ['/aura', '/aura/form', '/aura/form?natori-key=invalid', '/aura/studio/new', '/card', '/card/form']) {
  test(`creation is paused without DB or Storage writes: ${path}`, async ({ page }) => {
    await observePausedPage(page, path);
  });
}

test('English creation URL displays the English pause notice', async ({ page }) => {
  await observePausedPage(page, '/en/aura/form', true);
});
