// Shared by middleware and client controls. Reopening requires a reviewed code
// change; a query parameter, cookie, or environment variable cannot bypass it.
export const LEGACY_SERVICES_PAUSED = true;

export type LegacyService = 'gallery' | 'aura' | 'card';

export const LEGACY_SERVICE_PAUSED_MESSAGE =
  'このサービスの新規受付・作成・購入は現在休止しています。';

function normalizePathname(pathname: string): string {
  // The callers pass a pathname. Strip any accidental query before decoding so
  // encoded characters cannot turn query text into an allowlisted route.
  let path = pathname.split(/[?#]/, 1)[0];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    } catch {
      break;
    }
  }
  return path.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function isPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function withoutLocale(path: string): string {
  return path.replace(/^\/(?:ja|en)(?=\/|$)/, '') || '/';
}

export function getLegacyPauseDestination(
  pathname: string,
  service: LegacyService,
): string {
  const locale = /^\/en(?:\/|$)/.test(normalizePathname(pathname)) ? 'en' : 'ja';
  return `/${locale}/service-paused?service=${service}`;
}

export function getSuspendedLegacyPage(pathname: string): LegacyService | null {
  if (!LEGACY_SERVICES_PAUSED) return null;
  const path = withoutLocale(normalizePathname(pathname));

  if (['/entry', '/renew', '/mypage', '/auth/link'].some((p) => isPath(path, p))) {
    return 'gallery';
  }
  // /login remains available for existing bank-account maintenance and support;
  // it does not reopen the paused gallery intake or profile workspace.
  if (isPath(path, '/aura')) {
    // Route handlers render the static ending notice for former publications.
    if (['/aura/p', '/aura/u', '/aura/studio/p', '/aura/preview'].some((p) => isPath(path, p))) {
      return null;
    }
    return 'aura';
  }
  if (isPath(path, '/card')) {
    if (['/card/p', '/card/preview'].some((p) => isPath(path, p))) return null;
    return 'card';
  }
  return null;
}

export function isLegacyEmailAllowedDuringSuspension(kind: string): boolean {
  return ['contact', 'send-contact', 'purchaseBuyer', 'purchaseArtist', 'payoutComplete'].includes(kind);
}

export function getSuspendedLegacyApi(
  pathname: string,
  method: string,
): LegacyService | null {
  if (!LEGACY_SERVICES_PAUSED) return null;
  const path = normalizePathname(pathname);
  const readOnlyMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

  for (const service of ['aura', 'card'] as const) {
    const prefix = `/api/${service}`;
    if (!isPath(path, prefix)) continue;
    // All AURA/CARD publications and owner-test purchases have ended.
    return service;
  }

  if (['/api/entry/upload', '/api/purchase/stripe', '/api/ai-guide',
    '/api/internal/send-submit-email'].some((p) => isPath(path, p))) return 'gallery';

  // Payout closing/reminders remain active pending review of existing balances.
  if (['exhibit-ending-soon', 'exhibit-end', 'exhibit-delete', 'float-daily-slots']
    .some((name) => isPath(path, `/api/cron/${name}`))) return 'gallery';

  if (isPath(path, '/api/send-email')) {
    const kind = path.slice('/api/send-email/'.length);
    return isLegacyEmailAllowedDuringSuspension(kind) ? null : 'gallery';
  }

  // Public engagement readers ended with the old publications; support readers
  // under /admin/api/entries retain their existing authentication.
  if (/^\/api\/entries\/[^/]+\/(?:comments|like)$/.test(path)) return 'gallery';

  if (!readOnlyMethod && (isPath(path, '/api/entries') || isPath(path, '/admin/api/entries'))) {
    return 'gallery';
  }
  // No catch-all write rule: Natori, Stripe fulfillment, contact, account
  // deletion, and existing settlement/support APIs intentionally remain live.
  return null;
}
