import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const chain = {
    select: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn(), eq: vi.fn(),
    is: vi.fn(), insert: vi.fn(), update: vi.fn(),
    maybeSingle: vi.fn(), single: vi.fn(),
  };
  return { chain, from: vi.fn(), admin: vi.fn() };
});
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: db.admin }));

const certificate = {
  id: 12, title: 'Synthetic art', artist_name: 'Synthetic artist', edition_total: 1,
  created_at: '2026-10-01T00:00:00Z', confirmed_at: null,
};
const privateRow = {
  ...certificate, email: 'private-marker@example.invalid', user_id: 'private-owner',
  external_user_id: 'private-payment', image_url: 'private-source',
};
const activeLink = { id: 9, entry_id: 12, used_at: null, created_at: certificate.created_at };

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('ADMIN_API_TOKEN', 'synthetic-admin-test-only');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example.invalid');
  vi.stubEnv('CERT_ONE_TIME', '0');
  vi.stubEnv('CERT_REQUIRE_TOKEN', '1');
  vi.stubEnv('CERT_LINK_TTL_DAYS', '7');
  db.admin.mockReturnValue({ from: db.from });
  db.from.mockReturnValue(db.chain);
  for (const key of ['select', 'in', 'order', 'limit', 'eq', 'is', 'insert', 'update'] as const) {
    db.chain[key].mockReturnValue(db.chain);
  }
  db.chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  db.chain.single.mockResolvedValue({ data: null, error: null });
});

describe('certificate privileged read boundary', () => {
  it('selects exactly the six certificate columns and projects away private fields', async () => {
    db.chain.maybeSingle.mockResolvedValue({ data: privateRow, error: null });
    const { getEntryForCoA } = await import('@/lib/coa/server');
    expect(await getEntryForCoA(12)).toEqual(certificate);
    expect(db.chain.select).toHaveBeenCalledWith('id,title,artist_name,edition_total,created_at,confirmed_at');
    expect(db.chain.eq).toHaveBeenCalledWith('id', 12);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])('rejects unsafe entry id %s before DB access', async (id) => {
    const { getEntryForCoA } = await import('@/lib/coa/server');
    await expect(getEntryForCoA(id)).rejects.toThrow();
    expect(db.admin).not.toHaveBeenCalled();
  });

  it('does not grant access when the obsolete token-disable flag is set', async () => {
    vi.stubEnv('CERT_REQUIRE_TOKEN', '0');
    const { verifyCertToken } = await import('@/lib/coa/server');
    expect(await verifyCertToken('', 12)).toEqual({ ok: false, reason: 'missing' });
    expect(db.admin).not.toHaveBeenCalled();
  });

  it('rejects a token for a different URL entry without consuming it', async () => {
    vi.stubEnv('CERT_ONE_TIME', '1');
    db.chain.maybeSingle.mockResolvedValue({ data: activeLink, error: null });
    const { verifyCertToken } = await import('@/lib/coa/server');
    expect(await verifyCertToken('synthetic-token', 13)).toEqual({ ok: false, reason: 'notfound' });
    expect(db.chain.update).not.toHaveBeenCalled();
  });

  it('keeps valid legacy hex/base64 hashes and the exact entry match', async () => {
    db.chain.maybeSingle.mockResolvedValue({ data: activeLink, error: null });
    const { verifyCertToken } = await import('@/lib/coa/server');
    expect(await verifyCertToken('synthetic-token', 12)).toEqual({ ok: true, entryId: 12 });
    expect(db.chain.in).toHaveBeenCalledWith('token_hash', [
      createHash('sha256').update('synthetic-token').digest('hex'),
      createHash('sha256').update('synthetic-token').digest('base64'),
    ]);
    expect(db.chain.update).not.toHaveBeenCalled();
  });

  it('fails closed on absent/revoked/expired links filtered by the active view', async () => {
    const { verifyCertToken } = await import('@/lib/coa/server');
    expect(await verifyCertToken('synthetic-token', 12)).toEqual({ ok: false, reason: 'notfound' });
    expect(db.chain.update).not.toHaveBeenCalled();
  });

  it('does not fall back to issuing a link when verification infrastructure fails', async () => {
    db.chain.maybeSingle.mockResolvedValue({ data: null, error: new Error('synthetic missing active view') });
    const { verifyCertToken } = await import('@/lib/coa/server');
    await expect(verifyCertToken('synthetic-token', 12)).rejects.toThrow();
    expect(db.chain.insert).not.toHaveBeenCalled();
  });

  it('claims a one-time link conditionally and rejects a concurrent/used claim', async () => {
    vi.stubEnv('CERT_ONE_TIME', '1');
    db.chain.maybeSingle.mockResolvedValueOnce({ data: activeLink, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const { verifyCertToken } = await import('@/lib/coa/server');
    expect(await verifyCertToken('synthetic-token', 12)).toEqual({ ok: false, reason: 'notfound' });
    expect(db.chain.is).toHaveBeenCalledWith('used_at', null);
  });

  it('accepts a successful one-time claim and refuses an already used token', async () => {
    vi.stubEnv('CERT_ONE_TIME', '1');
    db.chain.maybeSingle.mockResolvedValueOnce({ data: activeLink, error: null })
      .mockResolvedValueOnce({ data: { id: 9 }, error: null })
      .mockResolvedValueOnce({ data: { ...activeLink, used_at: certificate.created_at }, error: null });
    const { verifyCertToken } = await import('@/lib/coa/server');
    expect(await verifyCertToken('synthetic-token', 12)).toEqual({ ok: true, entryId: 12 });
    expect(await verifyCertToken('synthetic-token', 12)).toEqual({ ok: false, reason: 'notfound' });
    expect(db.chain.update).toHaveBeenCalledTimes(1);
  });
});

describe('certificate reissue is a privileged operation', () => {
  it.each([undefined, new Request('https://site.example.invalid'), new Request('https://site.example.invalid', {
    headers: { 'x-meish-admin-token': 'wrong-test-value' },
  })])('refuses an absent/unauthorized request at the helper itself', async (request) => {
    const { issueReissueLink } = await import('@/lib/coa/server');
    await expect(Reflect.apply(issueReissueLink, undefined, [12, request])).rejects.toThrow();
    expect(db.admin).not.toHaveBeenCalled();
  });

  it('fails closed if the admin secret is not configured', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', '');
    const { issueReissueLink } = await import('@/lib/coa/server');
    await expect(issueReissueLink(12, new Request('https://site.example.invalid'))).rejects.toThrow();
    expect(db.admin).not.toHaveBeenCalled();
  });

  it('allows explicitly authenticated admin reissue and stores only the token hash', async () => {
    const { issueReissueLink } = await import('@/lib/coa/server');
    const result = new URL(await issueReissueLink(12, new Request('https://site.example.invalid', {
      headers: { authorization: 'Bearer synthetic-admin-test-only' },
    })));
    const token = result.searchParams.get('t')!;
    expect(result.pathname).toBe('/cert/12');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(db.chain.insert).toHaveBeenCalledWith({
      entry_id: 12, token_hash: createHash('sha256').update(token).digest('hex'),
      expires_at: expect.any(String),
    });
    expect(JSON.stringify(db.chain.insert.mock.calls)).not.toContain(token);
  });
});
