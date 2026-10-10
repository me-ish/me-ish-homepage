import { test, expect } from '@playwright/test';

const retiredRoutes = [
  '/float', '/float/2d', '/white', '/white/2d', '/galleries/forest', '/white-install',
  '/works/1', '/artists/legacy-user', '/modal/about', '/modal/creators', '/modal/buyers',
  '/modal/pricing', '/special-thanks', '/aura/p/legacy.slug', '/aura/u/portfolio',
  '/aura/preview/legacy-request', '/aura/studio/p/legacy-public-id',
  '/card/p/me-ish', '/card/preview/legacy-request',
];

test.describe('Ended legacy publications', () => {
  for (const locale of ['', '/en']) {
    for (const path of retiredRoutes) {
      test(`shows the ending notice without legacy rendering: ${locale}${path}`, async ({ page }) => {
        const errors: string[] = [];
        const legacyReads: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => {
          if (/\/rest\/v1\/(entries|portfolio_settings|aura_requests|card_requests)/.test(request.url())) {
            legacyReads.push(request.url());
          }
        });
        await page.goto(`${locale}${path}`);
        await expect(page.getByRole('heading', { name: locale ? 'Publication has ended' : '公開を終了しました' })).toBeVisible();
        await expect(page.locator('canvas')).toHaveCount(0);
        await expect(page.getByRole('link', { name: locale ? 'Atelier Natori' : 'ナトリのポートフォリオ' })).toHaveAttribute('href', `${locale}/natori/portfolio`);
        await expect(page.getByRole('link', { name: locale ? 'Contact us' : 'お問い合わせ' })).toHaveAttribute('href', `${locale}/contact`);
        await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveAttribute('content', /noindex/);
        expect(legacyReads).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  }
});
