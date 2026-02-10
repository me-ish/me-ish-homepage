import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing the module under test
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/isAdmin', () => ({
  isAdminEmail: vi.fn(),
}));

import { requireAdminAuth } from '../requireAdminAuth';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/isAdmin';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockIsAdminEmail = isAdminEmail as ReturnType<typeof vi.fn>;

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://example.com/api/test', { headers });
}

function mockSupabaseUser(email: string | null) {
  mockCreateClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: email ? { email } : null },
      }),
    },
  });
}

describe('requireAdminAuth', () => {
  const VALID_TOKEN = 'test-admin-token-12345';

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ADMIN_API_TOKEN = VALID_TOKEN;
  });

  // --- Token auth ---

  it('succeeds with valid x-meish-admin-token header', async () => {
    const req = makeRequest({ 'x-meish-admin-token': VALID_TOKEN });
    const result = await requireAdminAuth(req);
    expect(result).toEqual({ ok: true, adminEmail: 'api-token' });
  });

  it('succeeds with valid Authorization: Bearer header', async () => {
    const req = makeRequest({ authorization: `Bearer ${VALID_TOKEN}` });
    const result = await requireAdminAuth(req);
    expect(result).toEqual({ ok: true, adminEmail: 'api-token' });
  });

  it('fails with invalid token and no cookie', async () => {
    mockSupabaseUser(null);
    const req = makeRequest({ 'x-meish-admin-token': 'wrong-token' });
    const result = await requireAdminAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  // --- Cookie auth ---

  it('succeeds with valid cookie session for admin email', async () => {
    const adminEmail = 'admin@example.com';
    mockSupabaseUser(adminEmail);
    mockIsAdminEmail.mockReturnValue(true);

    const req = makeRequest();
    const result = await requireAdminAuth(req);
    expect(result).toEqual({ ok: true, adminEmail });
  });

  it('fails when cookie user is not admin', async () => {
    mockSupabaseUser('user@example.com');
    mockIsAdminEmail.mockReturnValue(false);

    const req = makeRequest();
    const result = await requireAdminAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('fails when no user session exists', async () => {
    mockSupabaseUser(null);

    const req = makeRequest();
    const result = await requireAdminAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  // --- Fallback behavior ---

  it('falls back to cookie when ADMIN_API_TOKEN is not set', async () => {
    delete process.env.ADMIN_API_TOKEN;
    const adminEmail = 'admin@example.com';
    mockSupabaseUser(adminEmail);
    mockIsAdminEmail.mockReturnValue(true);

    const req = makeRequest({ 'x-meish-admin-token': 'any-token' });
    const result = await requireAdminAuth(req);
    expect(result).toEqual({ ok: true, adminEmail });
  });

  it('falls back to cookie when token header is absent', async () => {
    const adminEmail = 'admin@example.com';
    mockSupabaseUser(adminEmail);
    mockIsAdminEmail.mockReturnValue(true);

    const req = makeRequest();
    const result = await requireAdminAuth(req);
    expect(result).toEqual({ ok: true, adminEmail });
  });

  // --- Edge cases ---

  it('prefers token over cookie when both are valid', async () => {
    mockSupabaseUser('admin@example.com');
    mockIsAdminEmail.mockReturnValue(true);

    const req = makeRequest({ 'x-meish-admin-token': VALID_TOKEN });
    const result = await requireAdminAuth(req);
    // Token wins → adminEmail is 'api-token', not the email
    expect(result).toEqual({ ok: true, adminEmail: 'api-token' });
    // createClient should not even be called
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('handles cookie auth exception gracefully', async () => {
    mockCreateClient.mockImplementation(() => {
      throw new Error('cookie error');
    });

    const req = makeRequest();
    const result = await requireAdminAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns 401 JSON body with error field', async () => {
    mockSupabaseUser(null);

    const req = makeRequest();
    const result = await requireAdminAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error).toBe('Unauthorized');
    }
  });
});
