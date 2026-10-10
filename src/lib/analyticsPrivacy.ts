// src/lib/analyticsPrivacy.ts
// Natori client pages carry their access token in the URL path
// (/natori/consult/[token], /natori/quote/[token], /natori/delivery/[token]).
// Analytics must never record those URLs.

const PRIVATE_CLIENT_PATH = /(?:^|\/)natori\/(?:consult|quote|delivery)(?:\/|$)/u;

/** True for a path or absolute URL whose path is a token-bearing client page. */
export function isAnalyticsExcludedPath(pathOrUrl: string | null | undefined): boolean {
  if (!pathOrUrl) return false;
  try {
    const url = new URL(pathOrUrl, "https://analytics.invalid");
    if (!['http:', 'https:'].includes(url.protocol)) return true;
    let path = url.pathname;
    // next-intl and the browser may expose an encoded route during navigation.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    }
    return PRIVATE_CLIENT_PATH.test(path.replace(/\/{2,}/gu, '/'));
  } catch {
    // An unparseable event URL must not bypass the privacy boundary.
    return true;
  }
}
