import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getSuspendedLegacyApi, LEGACY_SERVICE_PAUSED_MESSAGE, type LegacyService } from '@/lib/legacyServiceSuspension';

const { forbiddenDependency, forbiddenFetch } = vi.hoisted(() => ({
  forbiddenDependency: vi.fn((name: string): never => {
    throw new Error(`Paused API loaded a side-effect dependency: ${name}`);
  }),
  forbiddenFetch: vi.fn((): never => {
    throw new Error('Paused API attempted a network request');
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('openai', () => forbiddenDependency('OpenAI'));
vi.mock('stripe', () => forbiddenDependency('Stripe'));
vi.mock('resend', () => forbiddenDependency('mail'));
vi.mock('@supabase/supabase-js', () => forbiddenDependency('Supabase SDK'));
vi.mock('@/lib/supabaseAdmin', () => forbiddenDependency('Supabase admin'));
vi.mock('@/lib/supabase/server', () => forbiddenDependency('Supabase server'));
vi.mock('@/app/_actions/sendEmail', () => forbiddenDependency('mail action'));

type Handler = (request: NextRequest) => Promise<Response>;
type HandlerCase = {
  path: string;
  method: 'GET' | 'POST';
  service: LegacyService;
  load: () => Promise<Handler>;
};

// Import and call the real route exports, without middleware. These methods
// must remain stopped even if routing changes or a caller bypasses middleware.
const handlers: HandlerCase[] = [
  { path: '/api/aura/draft', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/draft/route').then((route) => route.POST) },
  { path: '/api/aura/studio/draft', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/studio/draft/route').then((route) => route.POST) },
  { path: '/api/aura/studio/save/synthetic-id', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/studio/save/[id]/route').then((route) => route.POST) },
  { path: '/api/aura/studio/publish/synthetic-id', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/studio/publish/[id]/route').then((route) => route.POST) },
  { path: '/api/aura/upload/avatar/synthetic-id', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/upload/avatar/[id]/route').then((route) => route.POST) },
  { path: '/api/aura/upload/works/synthetic-id', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/upload/works/[id]/route').then((route) => route.POST) },
  { path: '/api/aura/studio/upload/avatar/synthetic-id', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/studio/upload/avatar/[id]/route').then((route) => route.POST) },
  { path: '/api/aura/studio/upload/works/synthetic-id', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/studio/upload/works/[id]/route').then((route) => route.POST) },
  { path: '/api/aura/request/synthetic-id/email', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/request/[id]/email/route').then((route) => route.POST) },
  { path: '/api/card/draft', method: 'POST', service: 'card',
    load: () => import('@/app/api/card/draft/route').then((route) => route.POST) },
  { path: '/api/card/public-slug', method: 'POST', service: 'card',
    load: () => import('@/app/api/card/public-slug/route').then((route) => route.POST) },
  { path: '/api/card/upload/avatar/synthetic-id', method: 'POST', service: 'card',
    load: () => import('@/app/api/card/upload/avatar/[id]/route').then((route) => route.POST) },
  { path: '/api/card/upload/works/synthetic-id', method: 'POST', service: 'card',
    load: () => import('@/app/api/card/upload/works/[id]/route').then((route) => route.POST) },
  { path: '/api/purchase/stripe', method: 'POST', service: 'gallery',
    load: () => import('@/app/api/purchase/stripe/route').then((route) => route.POST) },
  { path: '/api/ai-guide', method: 'POST', service: 'gallery',
    load: () => import('@/app/api/ai-guide/route').then((route) => route.POST) },
  { path: '/api/aura/form/submit', method: 'GET', service: 'aura',
    load: () => import('@/app/api/aura/form/submit/route').then((route) => route.GET) },
  { path: '/api/aura/form/submit', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/form/submit/route').then((route) => route.POST) },
  { path: '/api/aura/form/ai-suggest', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/form/ai-suggest/route').then((route) => route.POST) },
  { path: '/api/aura/studio/ai/polish', method: 'POST', service: 'aura',
    load: () => import('@/app/api/aura/studio/ai/polish/route').then((route) => route.POST) },
  { path: '/api/card/form/submit', method: 'POST', service: 'card',
    load: () => import('@/app/api/card/form/submit/route').then((route) => route.POST) },
  { path: '/api/aura/checkout', method: 'GET', service: 'aura',
    load: () => import('@/app/api/aura/checkout/route').then((route) => route.GET) },
  { path: '/api/card/checkout', method: 'GET', service: 'card',
    load: () => import('@/app/api/card/checkout/route').then((route) => route.GET) },
  { path: '/api/cron/exhibit-ending-soon', method: 'GET', service: 'gallery',
    load: () => import('@/app/api/cron/exhibit-ending-soon/route').then((route) => route.GET) },
  { path: '/api/cron/exhibit-ending-soon', method: 'POST', service: 'gallery',
    load: () => import('@/app/api/cron/exhibit-ending-soon/route').then((route) => route.POST) },
  { path: '/api/cron/exhibit-end', method: 'GET', service: 'gallery',
    load: () => import('@/app/api/cron/exhibit-end/route').then((route) => route.GET) },
  { path: '/api/cron/exhibit-end', method: 'POST', service: 'gallery',
    load: () => import('@/app/api/cron/exhibit-end/route').then((route) => route.POST) },
  { path: '/api/cron/exhibit-delete', method: 'GET', service: 'gallery',
    load: () => import('@/app/api/cron/exhibit-delete/route').then((route) => route.GET) },
  { path: '/api/cron/exhibit-delete', method: 'POST', service: 'gallery',
    load: () => import('@/app/api/cron/exhibit-delete/route').then((route) => route.POST) },
  { path: '/api/cron/float-daily-slots', method: 'GET', service: 'gallery',
    load: () => import('@/app/api/cron/float-daily-slots/route').then((route) => route.GET) },
  { path: '/api/cron/float-daily-slots', method: 'POST', service: 'gallery',
    load: () => import('@/app/api/cron/float-daily-slots/route').then((route) => route.POST) },
  { path: '/api/internal/send-submit-email', method: 'POST', service: 'gallery',
    load: () => import('@/app/api/internal/send-submit-email/route').then((route) => route.POST) },
];

describe('paused API handlers independently of middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', forbiddenFetch);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe.each(handlers)('$method $path', ({ path, method, service, load }) => {
    it.each(['valid JSON', 'malformed JSON'] as const)(
      'returns the stable pause response without effects for %s input',
      async (input) => {
        expect(getSuspendedLegacyApi(path, method)).toBe(service);
        const payload = input === 'valid JSON'
          ? JSON.stringify({ requestId: 'synthetic-request', entryId: 1, message: 'synthetic' })
          : '{invalid-json';
        const request = new NextRequest(
          `https://example.invalid${path}?requestId=synthetic-request&payload=${encodeURIComponent(payload)}`,
          {
            method,
            headers: { 'content-type': 'application/json' },
            ...(method === 'POST' ? { body: payload } : {}),
          },
        );
        const forbiddenBodyRead = vi.fn((): never => {
          throw new Error('Paused API attempted to read request content');
        });
        for (const reader of ['json', 'text', 'formData', 'arrayBuffer', 'blob', 'clone'] as const) {
          vi.spyOn(request, reader).mockImplementation(forbiddenBodyRead);
        }
        vi.spyOn(request, 'body', 'get').mockImplementation(forbiddenBodyRead);

        const handler = await load();
        const response = await handler(request);

        expect(response.status).toBe(503);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('content-type')).toContain('application/json');
        expect(response.headers.get('set-cookie')).toBeNull();
        expect(await response.json()).toEqual({
          error: 'legacy_service_paused',
          message: LEGACY_SERVICE_PAUSED_MESSAGE,
          service,
        });
        expect(forbiddenBodyRead).not.toHaveBeenCalled();
        expect(forbiddenFetch).not.toHaveBeenCalled();
        expect(forbiddenDependency).not.toHaveBeenCalled();
      },
    );
  });
});
