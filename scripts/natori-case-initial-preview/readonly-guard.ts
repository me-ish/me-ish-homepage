// Copied ONLY into the dedicated read-only package by package.mjs. The normal
// application middleware is unchanged. No credentials, IO or provider imports.
import { googleReadAccessAllowed } from './google-deadline.mjs';
type Context = {
  environment?: string;
  targetEnvironment?: string;
  project?: string;
  databaseUrl?: string;
  publicDatabaseUrl?: string;
  origin: string;
  pathname: string;
  method: string;
  imageSource: string | null;
  googleAccessExpiresAt?: string;
  now?: number;
};
type Target = { project: string; url: string; origin: string };
export const INITIAL_READONLY_APIS = [
  '/api/natori/admin/case-workspace',
  '/api/natori/admin/case-workspace/entries',
  '/api/natori/admin/case-detail',
  '/api/natori/admin/case-history',
  '/api/natori/admin/case-context',
  '/api/natori/admin/case-planning',
  '/api/natori/admin/case-system',
] as const;

/** null permits the normal middleware/auth/owner/RLS checks; never grants access. */
export function initialReadonlyDecision(c: Context, target: Target, googleCallback = false): 404 | 405 | 503 | null {
  if (c.environment !== 'preview' || c.targetEnvironment !== 'preview'
    || c.project !== target.project || c.databaseUrl !== target.url
    || c.publicDatabaseUrl !== target.url || c.origin !== target.origin) return 503;
  if (googleCallback && !googleReadAccessAllowed(c.googleAccessExpiresAt, c.now)) return 503;
  // Includes server-action POSTs to pages, webhooks, OAuth callback POSTs,
  // legacy writers, maintenance and all Cron HTTP methods.
  if (c.method !== 'GET' && c.method !== 'HEAD') return 405;
  // Exact opt-in for the Google package. PKCE exchange is an Auth operation;
  // every business POST remains blocked. The password package stays unchanged.
  if (c.pathname === '/auth/callback' && googleCallback) return c.method === 'GET' ? null : 405;
  if (c.pathname.startsWith('/api/')) {
    return (INITIAL_READONLY_APIS as readonly string[]).includes(c.pathname) ? null : 404;
  }
  if (c.pathname === '/_next/image') {
    try {
      const image = new URL(c.imageSource ?? '', c.origin);
      if (image.origin !== c.origin || image.username || image.password || image.search || image.hash
        || !/\.(?:png|jpe?g|gif|svg|webp|ico)$/.test(image.pathname)
        || image.pathname.startsWith('/api/')) return 404;
      return null;
    } catch { return 404; }
  }
  if (c.pathname.startsWith('/_next/static/')) return null;
  if (/^\/(?:images|fonts|natori)\/[A-Za-z0-9/_\-.]+\.(?:png|jpe?g|gif|svg|webp|woff2?|ttf)$/.test(c.pathname)
    || /^\/(?:favicon\.ico|icon\.png|apple-icon\.png|logo[^/]*\.(?:png|svg))$/.test(c.pathname)) return null;
  return /^\/(?:admin-login|(?:(?:ja|en)\/)?natori\/dashboard\/cases)$/.test(c.pathname) ? null : 404;
}
