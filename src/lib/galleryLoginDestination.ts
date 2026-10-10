import { LEGACY_SERVICES_PAUSED } from '@/lib/legacyServiceSuspension';

/** Keep the retained settlement login on a supported, same-site destination. */
export function galleryLoginDestination(requested: string | null, locale: string): string {
  const fallback = LEGACY_SERVICES_PAUSED
    ? `${locale === 'en' ? '/en' : ''}/settings/bank`
    : '/mypage';
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\')) {
    return fallback;
  }
  try {
    const url = new URL(requested, 'https://meish-login.invalid');
    if (url.origin !== 'https://meish-login.invalid') return fallback;
    if (LEGACY_SERVICES_PAUSED && !/^\/(?:ja\/|en\/)?settings\/bank\/?$/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
