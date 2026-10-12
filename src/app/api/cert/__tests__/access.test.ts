import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ issue: vi.fn(), admin: vi.fn(), from: vi.fn(), select: vi.fn(), limit: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/coa/server', () => ({ issueReissueLink: mocks.issue }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.admin }));
import { GET as reissue } from '../reissue/route';
import { GET as diagnostics } from '../../diag/coa/route';

const validHeaders = { 'x-meish-admin-token': 'synthetic-admin-test-only' };
const request = (path: string, headers?: Record<string, string>) => new NextRequest(`https://site.example.invalid${path}`, { headers });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ADMIN_API_TOKEN', 'synthetic-admin-test-only');
  mocks.issue.mockResolvedValue('/cert/12?t=synthetic-new-token');
  mocks.admin.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue({ data: [{ id: 'synthetic-link', entry_id: 12 }], error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe.each([
  ['reissue', reissue, '/api/cert/reissue?entryId=12'],
  ['diagnostics', diagnostics, '/api/diag/coa'],
] as const)('certificate %s API', (_name, handler, path) => {
  it('rejects anonymous calls before privileged access', async () => {
    expect((await handler(request(path))).status).toBe(401);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('rejects wrong credentials before privileged access', async () => {
    expect((await handler(request(path, { 'x-meish-admin-token': 'wrong-test-value' }))).status).toBe(403);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('fails closed when admin authentication is not configured', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', '');
    expect((await handler(request(path, validHeaders))).status).toBe(500);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});

describe('authorized certificate operations', () => {
  it('passes the authenticated request to the reissue helper and prevents caching/referrers', async () => {
    const req = request('/api/cert/reissue?entryId=12', validHeaders);
    const response = await reissue(req);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://site.example.invalid/cert/12?t=synthetic-new-token');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(mocks.issue).toHaveBeenCalledExactlyOnceWith(12, req);
  });
  it.each(['', '0', '-1', '1.5', '9007199254740992'])('rejects malformed entry id %s without issuing', async (id) => {
    expect((await reissue(request(`/api/cert/reissue?entryId=${id}`, validHeaders))).status).toBe(400);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it('returns only health information to an authenticated diagnostics caller', async () => {
    const response = await diagnostics(request('/api/diag/coa', validHeaders));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, hasRow: true });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not return or log raw privileged errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('private-database-error-marker');
    mocks.issue.mockRejectedValue(error);
    mocks.limit.mockResolvedValue({ data: null, error });
    const responses = await Promise.all([
      reissue(request('/api/cert/reissue?entryId=12', validHeaders)),
      diagnostics(request('/api/diag/coa', validHeaders)),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('private-database-error-marker');
    }
    expect(log.mock.calls.flat().map(String).join(' ')).not.toContain('private-database-error-marker');
  });
});
