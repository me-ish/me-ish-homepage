import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireCheck, validatePlan } from './config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export async function buildAuthBootstrap(plan, anon) {
  // In memory only. No public bootstrap asset, deployed login route, HTML/HAR,
  // session export, or password is written to the checkout or evidence.
  const built = await build({
    stdin: { contents: "import {supabaseBrowser} from './src/lib/supabaseBrowser'; window.__caseHostedAuth=supabaseBrowser();", resolveDir: root, loader: 'ts' },
    bundle: true, platform: 'browser', format: 'iife', write: false, logLevel: 'silent',
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(plan.target.url),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(anon),
      'process.env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET': JSON.stringify(plan.target),
    },
  });
  return built.outputFiles[0].text;
}
export function networkDecision(plan, address, method, now = Date.now()) {
  try { validatePlan(plan, now); } catch { return 'deny'; }
  let u; try { u = new URL(address); } catch { return 'deny'; }
  if (u.username || u.password || u.hash) return 'deny';
  if (u.origin === 'https://fonts.googleapis.com' && method === 'GET') return 'font-placeholder';
  if (u.origin === plan.target.url) {
    if (u.pathname === '/auth/v1/token' && method === 'POST'
      && u.searchParams.size === 1 && ['password', 'refresh_token'].includes(u.searchParams.get('grant_type'))) return 'auth';
    if (u.pathname === '/auth/v1/user' && method === 'GET' && !u.search) return 'auth';
    if (u.pathname === '/auth/v1/logout' && method === 'POST' && u.search === '?scope=local') return 'auth';
    return 'deny';
  }
  if (u.origin !== plan.target.origin || method !== 'GET') return 'deny';
  if (u.pathname.startsWith('/api/')) {
    if (u.pathname === '/api/natori/admin/case-workspace' && !u.search) return 'read';
    if (!/^\/api\/natori\/admin\/(?:case-payment|case-reconciliation|case-work|delivery-files)$/.test(u.pathname)) return 'deny';
    if (u.searchParams.size !== 1 || u.searchParams.getAll('projectId').length !== 1) return 'deny';
    return [...plan.fixtures.projects, plan.fixtures.foreignProject].includes(u.searchParams.get('projectId')) ? 'read' : 'deny';
  }
  // No arbitrary app URL, optimizer proxy, provider checkout, OAuth authorize,
  // upload, worker, or external asset is part of this read-only smoke run.
  if (/^\/(?:ja\/|en\/)?natori\/dashboard\/cases$/.test(u.pathname)) {
    const keys = [...u.searchParams.keys()];
    if (new Set(keys).size !== keys.length || keys.some(k => !['entry', 'case', 'section', '_rsc'].includes(k))) return 'deny';
    if (u.searchParams.has('case') && !plan.fixtures.projects.includes(u.searchParams.get('case'))) return 'deny';
    if (u.searchParams.has('entry') && !['today', 'cases', 'schedule'].includes(u.searchParams.get('entry'))) return 'deny';
    if (u.searchParams.has('section') && u.searchParams.get('section') !== 'overview') return 'deny';
    return 'page';
  }
  if (u.pathname === '/admin-login' && [...u.searchParams.keys()].every(k => ['next', 'err'].includes(k))) {
    const next = u.searchParams.get('next');
    if (next && !/^\/(?:ja\/|en\/)?natori\/dashboard\/cases(?:\?|$)/.test(next)) return 'deny';
    return 'page';
  }
  if (u.pathname.startsWith('/_next/static/') || /^\/(?:favicon\.ico|icon\.png|apple-icon\.png)$/.test(u.pathname)) return 'asset';
  if (/^\/(?:images|fonts)\/[A-Za-z0-9/_.-]+\.(?:png|jpe?g|svg|webp|woff2?)$/.test(u.pathname) && !u.search) return 'asset';
  return 'deny';
}

export async function installNetworkPolicy(context, plan, now) {
    const denied = [], counts = {};
    await context.routeWebSocket('**/*', socket => { denied.push('websocket'); socket.close(); });
    await context.route('**/*', async route => {
      const request = route.request(), decision = networkDecision(plan, request.url(), request.method(), now());
      counts[decision] = (counts[decision] ?? 0) + 1;
      if (decision === 'deny') { denied.push('request'); return route.abort('blockedbyclient'); }
      if (decision === 'font-placeholder') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      // Browser route handlers do not intercept every hop of a redirect chain.
      // Fetch exactly this checked URL, never follow 3xx (including login or
      // platform protection redirects), and only then fulfill the browser.
      try {
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 15000 });
        if (response.status() >= 300 && response.status() < 400) {
          denied.push('redirect'); return route.abort('blockedbyclient');
        }
        return await route.fulfill({ response });
      } catch {
        denied.push('transport'); return route.abort('failed');
      }
    });
    return { denied, counts };
}

export async function openHostedBrowser({ plan, anon, now }) {
  const bootstrap = await buildAuthBootstrap(plan, anon);
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  let context;
  try {
    context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1050 } });
    const { denied, counts } = await installNetworkPolicy(context, plan, now), pageErrors = [];
    const page = await context.newPage(); page.on('pageerror', () => pageErrors.push('pageerror'));
    const app = plan.target.origin, path = '/natori/dashboard/cases';
    const inject = async () => {
      if (!await page.evaluate(() => Boolean(window.__caseHostedAuth))) await page.addScriptTag({ content: bootstrap });
    };
    const get = async suffix => {
      // APIRequestContext bypasses BrowserContext.route: always use browser fetch.
      return page.evaluate(async suffix => {
        const r = await fetch(suffix, { cache: 'no-store', redirect: 'error' });
        return { status: r.status, body: r.status === 200 ? await r.json() : null };
      }, suffix);
    };
    await page.goto(app + '/admin-login', { waitUntil: 'domcontentloaded' });
    return {
      async unauthenticated() { requireCheck((await get('/api/natori/admin/case-workspace')).status === 401, 'unauthenticated_not_denied'); },
      async signIn(_role, actor, password) {
        await inject();
        const result = await page.evaluate(async ({ email, password }) => {
          const { data, error } = await window.__caseHostedAuth.auth.signInWithPassword({ email, password });
          return { id: data.user?.id, email: data.user?.email, failed: Boolean(error) };
        }, { email: actor.email, password });
        requireCheck(!result.failed && result.id === actor.id && result.email === actor.email, 'auth_identity_mismatch');
      },
      async denied() { requireCheck((await get('/api/natori/admin/case-workspace')).status === 401, 'nonstaff_not_denied'); },
      async refresh() {
        await inject();
        const ok = await page.evaluate(async () => {
          const { data, error } = await window.__caseHostedAuth.auth.refreshSession(); return Boolean(data.session) && !error;
        });
        requireCheck(ok, 'refresh_failed');
      },
      async read() {
        const r = await get('/api/natori/admin/case-workspace');
        requireCheck(r.status === 200 && r.body?.contract === 'natori-case-workspace-v1' && Array.isArray(r.body.records), 'workspace_unconfirmed');
        const ids = r.body.records.map(x => x.id);
        requireCheck(ids.length === new Set(ids).size && ids.length === plan.fixtures.projects.length
          && ids.every(id => plan.fixtures.projects.includes(id)), 'workspace_scope_mismatch');
        for (const resource of ['case-payment', 'case-reconciliation', 'case-work']) {
          requireCheck((await get(`/api/natori/admin/${resource}?projectId=${plan.fixtures.projects[0]}`)).status === 200, 'case_read_failed');
          requireCheck((await get(`/api/natori/admin/${resource}?projectId=${plan.fixtures.foreignProject}`)).status === 404, 'foreign_case_not_denied');
        }
      },
      async views() {
        let facts;
        const guidance = page.getByRole('region', { name: '案件の共通案内' });
        for (const viewport of [{ width: 1440, height: 1050 }, { width: 390, height: 844 }]) {
          await page.setViewportSize(viewport);
          for (const entry of ['today', 'cases', 'schedule']) {
            await page.goto(`${app}${path}?entry=${entry}&case=${plan.fixtures.projects[0]}&section=overview`, { waitUntil: 'domcontentloaded' });
            await expect(guidance).toBeVisible({ timeout: 30000 });
            const text = await guidance.innerText();
            if (facts === undefined) facts = text;
            requireCheck(text === facts, 'entry_facts_mismatch');
            requireCheck(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'viewport_overflow');
          }
          await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(guidance).toBeVisible({ timeout: 30000 });
          await page.goForward({ waitUntil: 'domcontentloaded' }); await expect(guidance).toBeVisible({ timeout: 30000 });
          await page.reload({ waitUntil: 'domcontentloaded' }); await expect(guidance).toBeVisible({ timeout: 30000 });
          requireCheck(await guidance.innerText() === facts, 'history_facts_mismatch');
        }
        requireCheck(pageErrors.length === 0, 'browser_page_error');
      },
      async signOut() {
        await inject();
        const ok = await page.evaluate(async () => !(await window.__caseHostedAuth.auth.signOut({ scope: 'local' })).error);
        requireCheck(ok, 'logout_failed');
      },
      evidence: () => ({ denied: [...denied], counts: { ...counts }, pageErrors: pageErrors.length }),
      async close() { try { await context.close(); } finally { await browser.close(); } },
    };
  } catch (error) {
    try { if (context) await context.close(); } finally { await browser.close(); }
    throw error;
  }
}
