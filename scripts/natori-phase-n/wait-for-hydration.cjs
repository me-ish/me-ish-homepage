'use strict';
// Test-only preload for the sealed browser harnesses (node --require /browser-test/wait-for-hydration.cjs).
// Next 16 dev (Turbopack) serves larger client chunks that load slowly on the 2-CPU CI browser container,
// so a test could fill or click server-rendered HTML before React hydrated it (a native form post, a lost
// click). After every full navigation (page.goto / page.reload) this waits until React has hydrated the
// Next.js page: React attaches its fiber to <body> while hydrating the root layout. Pages without Next
// client scripts (JSON, downloads) return at once. It only waits; assertions stay in the tests, and a page
// that never hydrates still fails on the test's own checks after at most 30 seconds here.
// Same Playwright copy the harnesses load through createRequire('/app/package.json') (cwd for a local check).
const appDir = require('node:fs').existsSync('/app/package.json') ? '/app' : process.cwd();
const { Page } = require(`${appDir}/node_modules/playwright-core/lib/client/page.js`);
const hydrated = () => !document.querySelector('script[src*="/_next/static/"]')
  || Object.keys(document.body ?? {}).some(key => key.startsWith('__reactFiber$'));
for (const name of ['goto', 'reload']) {
  const original = Page.prototype[name];
  Page.prototype[name] = async function waitForHydrationAfterNavigation(...args) {
    const response = await original.apply(this, args);
    try { await this.waitForFunction(hydrated, null, { timeout: 30000 }); } catch { /* the test's assertions decide */ }
    return response;
  };
}
