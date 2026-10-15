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

  it.each(['/cert/12', '/ja/cert/12', '/en/cert/invalid.id', '/ja/%63ert/12'])
  ('protects certificate route %s without issuing anything', async (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
    const response = await middleware(new NextRequest(`https://example.com${path}?t=synthetic-token`));
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('retains the existing Natori dashboard-key cookie flow', async () => {
    vi.stubEnv('NATORI_DASHBOARD_KEY', 'synthetic-key');
    const response = await middleware(new NextRequest('https://example.com/natori/dashboard?natori-key=synthetic-key'));
    expect(response.headers.get('location')).toBe('https://example.com/natori/dashboard');
    expect(response.cookies.get(NATORI_KEY_COOKIE)?.value).toMatch(/^\d{10}\.[a-f0-9]{64}$/);
    expect(intl).not.toHaveBeenCalled();
  });

  it.each(['wrong-key', 'synthetic-key'])
  ('protects certificate responses through the dashboard-key branch (%s)', async (key) => {
    vi.stubEnv('NATORI_DASHBOARD_KEY', 'synthetic-key');
    const response = await middleware(new NextRequest(`https://example.com/en/cert/12?t=synthetic-token&natori-key=${key}`));
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each(['', 'wrong-key', 'synthetic-key'])
  ('protects certificate redirects with dashboard key %s', async (key) => {
    vi.stubEnv('NATORI_DASHBOARD_KEY', 'synthetic-key');
    intl.mockImplementation(() => NextResponse.redirect('https://example.com/ja/cert/12?t=synthetic-token'));
    const response = await middleware(new NextRequest(`https://example.com/cert/12?t=synthetic-token${key ? `&natori-key=${key}` : ''}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each([
    '/api/natori/portfolio/assets/00000000-0000-4000-8000-000000000011.webp',
    '/api/natori/admin/portfolio-assets/00000000-0000-4000-8000-000000000011.webp?v=alias',
    '/%61pi/natori/admin/project-thumbs/fixture?v=alias',
    'https://example.com/api/natori/portfolio/assets/00000000-0000-4000-8000-000000000011.webp',
    '/og/natori-portfolio.png',
    '/api//natori//portfolio/assets/00000000-0000-4000-8000-000000000011.webp',
    '/og//natori-portfolio.png/',
  ])('blocks optimizer cache paths for protected media %s',async source=>{
    const request=new NextRequest('https://example.com/_next/image?url='+encodeURIComponent(source)+'&w=640&q=75');
    expect(unstable_doesMiddlewareMatch({config,url:request.url})).toBe(true);
    const response=await middleware(request);expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(intl).not.toHaveBeenCalled();
  });
  it('preserves the existing public gallery optimizer path',async()=>{
    const response=await middleware(new NextRequest('https://example.com/_next/image?url=%2Fordinary.webp&w=640&q=75'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(intl).not.toHaveBeenCalled();
  });

});
