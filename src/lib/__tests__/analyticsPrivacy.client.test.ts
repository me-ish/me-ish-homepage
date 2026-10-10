import { describe, expect, it } from 'vitest';
import { GA_ID, getAnalyticsPrivacyGuard } from '@/lib/analyticsPrivacy.client';

const flag = `ga-disable-${GA_ID}`;
const publicUrl = 'https://www.me-ish.art/ja/natori/portfolio';
const privateUrl = 'https://www.me-ish.art/ja/natori/consult/synthetic-token';

function browserAt(href = publicUrl, referrer = '') {
  // Fresh browser-shaped objects keep documents separate without real navigation.
  return { location: { href }, document: { referrer } } as unknown as Window;
}

describe('analytics privacy at the vendor send boundary', () => {
  it('allows public measurement and reuses the guard across both vendors', () => {
    const browser = browserAt();
    const guard = getAnalyticsPrivacyGuard(browser);
    expect(guard(publicUrl)).toBe(false);
    expect(Reflect.get(browser, flag)).toBe(false);
    expect(getAnalyticsPrivacyGuard(browser)).toBe(guard);
  });

  it('blocks a private document before a vendor is mounted', () => {
    const browser = browserAt(privateUrl);
    expect(getAnalyticsPrivacyGuard(browser)()).toBe(true);
    expect(Reflect.get(browser, flag)).toBe(true);
  });

  it('blocks GA synchronously after history changes, without a React effect', () => {
    const browser = browserAt();
    const guard = getAnalyticsPrivacyGuard(browser);
    browser.location.href = privateUrl;
    expect(Reflect.get(browser, flag)).toBe(true);
    browser.location.href = publicUrl;
    expect(guard(publicUrl)).toBe(true);
    Reflect.set(browser, flag, false);
    expect(Reflect.get(browser, flag)).toBe(true);
  });

  it('drops a queued private event even after location has returned to public', () => {
    const browser = browserAt();
    const guard = getAnalyticsPrivacyGuard(browser);
    expect(guard(privateUrl)).toBe(true);
    expect(guard(publicUrl)).toBe(true);
    expect(Reflect.get(browser, flag)).toBe(true);
  });

  it('blocks a public document whose referrer contains a private URL', () => {
    const browser = browserAt(publicUrl, privateUrl);
    expect(getAnalyticsPrivacyGuard(browser)()).toBe(true);
  });

  it('preserves an existing opt-out and a later explicit opt-out', () => {
    const optedOut = browserAt();
    Reflect.set(optedOut, flag, true);
    expect(getAnalyticsPrivacyGuard(optedOut)()).toBe(true);
    const browser = browserAt();
    const guard = getAnalyticsPrivacyGuard(browser);
    Reflect.set(browser, flag, true);
    expect(guard(publicUrl)).toBe(true);
  });

  it('does not load vendors if another script owns an immutable flag', () => {
    const browser = browserAt();
    Object.defineProperty(browser, flag, { value: false, configurable: false });
    expect(getAnalyticsPrivacyGuard(browser)()).toBe(true);
  });
});
