// src/lib/analyticsPrivacy.ts
// Natori client pages carry their access token in the URL path
// (/natori/consult/[token], /natori/quote/[token], /natori/delivery/[token]).
// Analytics must never record those URLs.

const PRIVATE_CLIENT_PATH = /(?:^|\/)natori\/(?:consult|quote|delivery)(?:\/|$)/u;

/** True for a path or absolute URL whose path is a token-bearing client page. */
export function isAnalyticsExcludedPath(pathOrUrl: string | null | undefined): boolean {
  if (!pathOrUrl) return false;
  let path = pathOrUrl;
  if (/^https?:\/\//iu.test(pathOrUrl)) {
    try {
      path = new URL(pathOrUrl).pathname;
    } catch {
      return true;
    }
  }
  return PRIVATE_CLIENT_PATH.test(path.split(/[?#]/u)[0]);
}
