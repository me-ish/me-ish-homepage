'use client';

import { isAnalyticsExcludedPath } from './analyticsPrivacy';

export const GA_ID = 'G-EZR21G5Q2T';
const GA_DISABLED = `ga-disable-${GA_ID}`;
type PrivacyGuard = (eventUrl?: string | null) => boolean;
const guards = new WeakMap<Window, PrivacyGuard>();

/** Install before either vendor loads. A private visit disables this document. */
export function getAnalyticsPrivacyGuard(browser: Window): PrivacyGuard {
  const existing = guards.get(browser);
  if (existing) return existing;

  let blocked = false;
  const shouldBlock: PrivacyGuard = (eventUrl) => {
    blocked ||= isAnalyticsExcludedPath(eventUrl)
      || isAnalyticsExcludedPath(browser.location.href)
      || isAnalyticsExcludedPath(browser.document.referrer);
    return blocked;
  };

  try {
    // Preserve a visitor's existing opt-out. Never re-enable tracking after a
    // private route: delayed events and referrers may still contain its token.
    blocked = Reflect.get(browser, GA_DISABLED) === true;
    Object.defineProperty(browser, GA_DISABLED, {
      configurable: true,
      // GA reads this synchronously while sending, before React effects may run.
      get: () => shouldBlock(),
      set: (disabled: unknown) => { if (disabled === true) blocked = true; },
    });
  } catch {
    // If another script owns a non-configurable flag, do not load our vendors.
    blocked = true;
  }
  guards.set(browser, shouldBlock);
  shouldBlock();
  return shouldBlock;
}

export function shouldBlockAnalytics(eventUrl?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  return getAnalyticsPrivacyGuard(window)(eventUrl);
}
