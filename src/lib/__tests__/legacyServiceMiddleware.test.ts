import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

const { intl } = vi.hoisted(() => ({ intl: vi.fn() }));
vi.mock('next-intl/middleware', () => ({ default: () => intl }));
import middleware, { config } from '@/middleware';
import { NATORI_KEY_COOKIE } from '@/features/natori/constants/dashboardKey';

describe('legacy suspension middleware', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.unstubAllEnvs();
    intl.mockReset();
    intl.mockImplementation(() => NextResponse.next());
  });

  it.each([
    '/api/aura/checkout', '/api/card/save/dotted.id', '/admin/api/entries/1/approve',
    '/auth/link', '/entry/file.png', '/ja/entry/file.png', '/en/aura/form/dotted.id',
  ])('actually matches %s, including ids containing dots', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it('blocks a GET mutator before locale or Natori-key redirects', async () => {
    vi.stubEnv('NATORI_DASHBOARD_KEY', 'synthetic-key');
    const response = await middleware(new NextRequest('https://example.com/api/aura/checkout?natori-key=wrong'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'legacy_service_paused', service: 'aura' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(intl).not.toHaveBeenCalled();
  });

  it('redirects localized creation screens and drops the original query', async () => {
    const response = await middleware(new NextRequest('https://example.com/en/card/form?requestId=private'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/en/service-paused?service=card');
    expect(intl).not.toHaveBeenCalled();
  });

  it.each(['/api/webhook/stripe', '/api/natori/portfolio/contact', '/admin/api/inquiries/1'])
  ('passes preserved API %s without locale redirects', async (path) => {
    const response = await middleware(new NextRequest(`https://example.com${path}`, { method: 'POST' }));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(intl).not.toHaveBeenCalled();
  });

  it.each(['/ja/natori/portfolio', '/ja/etorie/demo/app/portfolio', '/en/aura/p/existing'])
  ('keeps locale handling for %s', async (path) => {
    await middleware(new NextRequest(`https://example.com${path}`));
    expect(intl).toHaveBeenCalledOnce();
  });

  it('retains Natori consultation privacy headers', async () => {
    const response = await middleware(new NextRequest('https://example.com/natori/consult/synthetic-token'));
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('retains the existing Natori dashboard-key cookie flow', async () => {
    vi.stubEnv('NATORI_DASHBOARD_KEY', 'synthetic-key');
    const response = await middleware(new NextRequest('https://example.com/natori/dashboard?natori-key=synthetic-key'));
    expect(response.headers.get('location')).toBe('https://example.com/natori/dashboard');
    expect(response.cookies.get(NATORI_KEY_COOKIE)?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(intl).not.toHaveBeenCalled();
  });
});
