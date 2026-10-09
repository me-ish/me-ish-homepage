import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  auraAccess: vi.fn(), cardAccess: vi.fn(), auraPublish: vi.fn(), cardPublish: vi.fn(),
  meishClaim: vi.fn(), firstClaim: vi.fn(), admin: vi.fn(), adminEmail: vi.fn(), cookies: vi.fn(),
}));
vi.mock('@/lib/aura/requireAuraAccess', () => ({ requireAuraRequestAccess: mocks.auraAccess }));
vi.mock('@/lib/card/requireCardAccess', () => ({ requireCardRequestAccess: mocks.cardAccess }));
vi.mock('@/lib/aura/aura.db', () => ({ publishContent: mocks.auraPublish }));
vi.mock('@/lib/card/card.db', () => ({ publishCard: mocks.cardPublish }));
vi.mock('@/lib/aura/auraBillingGate', () => ({ claimMeishFree: mocks.meishClaim, claimFirst20Free: mocks.firstClaim }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.admin }));
vi.mock('@/lib/isAdmin', () => ({ isAdminEmailAsync: mocks.adminEmail }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

import { POST as auraSave } from '@/app/api/aura/save/[id]/route';
import { POST as cardSave } from '@/app/api/card/save/[id]/route';

const cases = [
  { service: 'aura', save: auraSave, access: mocks.auraAccess, publish: mocks.auraPublish,
    content: { sections: [] } },
  { service: 'card', save: cardSave, access: mocks.cardAccess, publish: mocks.cardPublish,
    content: { profile: { name: 'Synthetic', title: 'Artist', email: 'test@example.invalid' } } },
];

describe.each(cases)('$service existing publication during suspension', ({ service, save, access, publish, content }) => {
  function request(body: unknown = { content }, csrf = true) {
    return new Request(`https://example.invalid/api/${service}/save/owned-id`, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-requested-with': 'me-ish' } : {}) },
    });
  }
  const params = { params: Promise.resolve({ id: 'owned-id' }) };

  beforeEach(() => {
    vi.resetAllMocks();
    access.mockResolvedValue({ ok: true, rec: { payment_status: 'unpaid', published_at: null } });
    publish.mockResolvedValue({ record: { publicId: 'public-id', publicSlug: 'public-slug', status: 'published' },
      publicId: 'public-id', publicSlug: 'public-slug', slug: 'public-slug' });
  });

  it('keeps CSRF and ownership checks ahead of publication', async () => {
    expect((await save(request(undefined, false), params)).status).toBe(403);
    expect(access).not.toHaveBeenCalled();
    access.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) });
    expect((await save(request(), params)).status).toBe(403);
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects unpaid drafts even if the body claims payment/publication, without free claims or writes', async () => {
    const response = await save(request({ content, payment_status: 'paid', published_at: '2026-10-01' }), params);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: 'legacy_service_paused', service });
    for (const mock of [publish, mocks.meishClaim, mocks.firstClaim, mocks.admin, mocks.adminEmail, mocks.cookies]) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it.each(['paid', 'PAID'])('fulfills an owned %s checkout without new billing', async (payment_status) => {
    access.mockResolvedValue({ ok: true, rec: { payment_status, published_at: null } });
    expect((await save(request(), params)).status).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toBe('owned-id');
    expect(mocks.meishClaim).not.toHaveBeenCalled();
    expect(mocks.firstClaim).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it('preserves updates to an already-published free page', async () => {
    access.mockResolvedValue({ ok: true, rec: { payment_status: 'unpaid', published_at: '2026-10-01T00:00:00Z' } });
    expect((await save(request(), params)).status).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(mocks.meishClaim).not.toHaveBeenCalled();
    expect(mocks.firstClaim).not.toHaveBeenCalled();
  });

  it('still validates paid content before writing', async () => {
    access.mockResolvedValue({ ok: true, rec: { payment_status: 'paid' } });
    expect((await save(request({ content: { invalid: true } }), params)).status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });
});
