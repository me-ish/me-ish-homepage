import { describe, expect, it } from 'vitest';
import {
  getLegacyPauseDestination,
  getSuspendedLegacyApi,
  getSuspendedLegacyPage,
  isLegacyEmailAllowedDuringSuspension,
} from '@/lib/legacyServiceSuspension';

describe('legacy service suspension boundary', () => {
  it.each([
    ['/entry', 'gallery'], ['/ja/entry/file.png', 'gallery'],
    ['/en/mypage/portfolio', 'gallery'], ['/renew', 'gallery'],
    ['/auth/link', 'gallery'],
    ['/aura', 'aura'], ['/en/aura/studio/new', 'aura'],
    ['/card/form', 'card'], ['/ja/card/form/dotted.id', 'card'],
    ['/%61ura/form', 'aura'], ['/ja/%65ntry', 'gallery'],
    ['/aura/form?next=/aura/p/existing', 'aura'],
  ])('pauses %s', (path, service) => {
    expect(getSuspendedLegacyPage(path)).toBe(service);
  });

  it.each([
    '/natori/portfolio', '/ja/natori/portfolio/contact', '/en/natori/projects',
    '/ja/etorie/demo/app/portfolio', '/aura/p/existing', '/en/aura/u/existing',
    '/aura/studio/p/existing', '/card/p/existing', '/aura/preview/id',
    '/card/preview/id', '/settings/bank', '/login', '/en/login', '/contact', '/cert/1',
    '/receipt/cs_existing', '/purchase/success', '/admin-login', '/auth/callback',
    '/white/2d', '/float', '/works/1', '/artists/natori', '/service-paused',
    '/aura-other', '/cardinal', '/entries', '/entrypoint',
  ])('preserves page %s', (path) => {
    expect(getSuspendedLegacyPage(path)).toBeNull();
  });

  it.each([
    ['/api/aura/assets?path=works/id/file.png', 'GET', 'aura'],
    ['/api/card/assets', 'HEAD', 'card'], ['/api/aura/request/id', 'GET', 'aura'],
    ['/api/card/request/dotted.id', 'GET', 'card'],
    ['/api/aura/save/id', 'POST', 'aura'], ['/api/card/save/id', 'POST', 'card'],
    ['/api/aura/public-slug', 'POST', 'aura'],
    ['/api/aura/checkout', 'GET', 'aura'],
    ['/api/card/checkout', 'HEAD', 'card'],
    ['/api/aura/form/submit?test_openai=1', 'GET', 'aura'],
    ['/api/aura/draft', 'POST', 'aura'],
    ['/api/aura/request/id/email', 'POST', 'aura'],
    ['/api/card/save/id/nested', 'POST', 'card'],
    ['/api/aura/save/id', 'GET', 'aura'],
    ['/api/aura/public-slug', 'GET', 'aura'],
    ['/api/aura/public-slug/nested', 'POST', 'aura'],
    ['/api/card/public-slug', 'POST', 'card'],
    ['/api/aura/studio/publish/id', 'POST', 'aura'],
    ['/api/entry/upload', 'POST', 'gallery'],
    ['/api/cert/download', 'GET', 'gallery'], ['/api/files/download', 'GET', 'gallery'],
    ['/api/purchase/stripe', 'POST', 'gallery'],
    ['/api/ai-guide', 'POST', 'gallery'],
    ['/api/internal/send-submit-email', 'POST', 'gallery'],
    ['/api/entries/1/like', 'POST', 'gallery'],
    ['/api/entries/1/comments/2', 'DELETE', 'gallery'],
    ['/api/entries/1/view', 'POST', 'gallery'],
    ['/admin/api/entries/1/plan-checkout', 'POST', 'gallery'],
    ['/admin/api/entries/1', 'PATCH', 'gallery'],
    ['/api/cron/exhibit-delete', 'GET', 'gallery'],
    ['/api/cron/exhibit-end', 'POST', 'gallery'],
    ['/api/cron/exhibit-ending-soon', 'GET', 'gallery'],
    ['/api/cron/float-daily-slots', 'POST', 'gallery'],
    ['/api/send-email/submit', 'POST', 'gallery'],
    ['/api/send-email/planPaymentRequest', 'POST', 'gallery'],
    ['/api/%61ura/checkout', 'GET', 'aura'],
    ['/api/%2561ura/draft', 'POST', 'aura'],
    ['/api/aura/req%75est/id%2femail', 'GET', 'aura'],
    ['/api/aura/assets-extra', 'GET', 'aura'],
    ['/api/aura/assets/nested', 'GET', 'aura'],
    ['/api/aura/assets', 'POST', 'aura'],
    ['/api/card/request/dotted.id', 'POST', 'card'],
    ['/api/entries/1/comments', 'GET', 'gallery'],
    ['/api/entries/1/like', 'GET', 'gallery'],
  ])('blocks %s %s', (path, method, service) => {
    expect(getSuspendedLegacyApi(path, method)).toBe(service);
  });

  it.each([
    ['/api/webhook/stripe', 'POST'], ['/api/account/delete', 'POST'],
    ['/api/purchase/success', 'GET'], ['/api/cert/reissue', 'GET'],
    ['/api/send-email/purchaseBuyer', 'POST'],
    ['/api/send-email/purchaseArtist', 'POST'],
    ['/api/send-email/payoutComplete', 'POST'],
    ['/api/send-email/contact', 'POST'], ['/api/send-email/send-contact', 'POST'],
    ['/api/cron/payout-reminder', 'GET'], ['/api/cron/close-monthly-payout', 'POST'],
    ['/api/admin/payouts/mark-paid', 'POST'],
    ['/api/natori/portfolio/contact', 'POST'], ['/api/natori/consult/token', 'POST'],
    ['/api/natori/delivery/accept', 'POST'], ['/api/natori/admin/projects', 'DELETE'],
    ['/api/cron/natori-payment-expiry', 'GET'],
    ['/api/natori/maintenance/inquiry-orphans', 'POST'],
    ['/admin/api/entries', 'GET'],
    ['/admin/api/inquiries/1', 'PATCH'], ['/admin/api/announcements', 'POST'],
    ['/api/natori/portfolio/content?path=/api/aura/draft', 'GET'],
  ])('preserves %s %s', (path, method) => {
    expect(getSuspendedLegacyApi(path, method)).toBeNull();
  });

  it('does not confuse email names or locale prefixes', () => {
    expect(isLegacyEmailAllowedDuringSuspension('contact')).toBe(true);
    expect(isLegacyEmailAllowedDuringSuspension('contact/submit')).toBe(false);
    expect(isLegacyEmailAllowedDuringSuspension('purchaseBuyerExtra')).toBe(false);
    expect(getLegacyPauseDestination('/en/aura/form', 'aura')).toBe('/en/service-paused?service=aura');
    expect(getLegacyPauseDestination('/entry', 'gallery')).toBe('/ja/service-paused?service=gallery');
    expect(getLegacyPauseDestination('/english/card', 'card')).toBe('/ja/service-paused?service=card');
  });
});
