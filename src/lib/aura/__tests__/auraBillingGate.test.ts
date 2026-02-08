import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin before importing the module under test
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

import {
  claimFirst20Free,
  claimMeishFree,
  checkFreeEligibility,
} from '../auraBillingGate';

// Helper to build a chainable query mock
function chainable(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(result);
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(terminal);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// claimFirst20Free
// ============================================================

describe('claimFirst20Free', () => {
  it('returns success when RPC succeeds', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await claimFirst20Free('Test@Example.com', 'req-1');
    expect(result).toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('aura_claim_first20_free', {
      p_email: 'test@example.com',
      p_request_id: 'req-1',
    });
  });

  it('returns email_missing for empty email', async () => {
    const result = await claimFirst20Free('');
    expect(result).toEqual({ success: false, reason: 'email_missing' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns rpc_error on failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const result = await claimFirst20Free('user@test.com');
    expect(result).toEqual({ success: false, reason: 'rpc_error:timeout' });
  });

  it('returns reason from RPC data when ok is false', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, reason: 'limit_reached' },
      error: null,
    });
    const result = await claimFirst20Free('user@test.com');
    expect(result).toEqual({ success: false, reason: 'limit_reached' });
  });

  it('normalizes email and passes null requestId', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await claimFirst20Free('  USER@Test.COM  ');
    expect(mockRpc).toHaveBeenCalledWith('aura_claim_first20_free', {
      p_email: 'user@test.com',
      p_request_id: null,
    });
  });
});

// ============================================================
// claimMeishFree
// ============================================================

describe('claimMeishFree', () => {
  it('returns success when RPC succeeds', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await claimMeishFree('artist@me-ish.art', 'req-2');
    expect(result).toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('aura_claim_meish_free', {
      p_email: 'artist@me-ish.art',
      p_request_id: 'req-2',
    });
  });

  it('returns email_missing for empty email', async () => {
    const result = await claimMeishFree('');
    expect(result).toEqual({ success: false, reason: 'email_missing' });
  });

  it('returns rpc_error on failure', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });
    const result = await claimMeishFree('user@test.com');
    expect(result).toEqual({
      success: false,
      reason: 'rpc_error:connection refused',
    });
  });

  it('returns reason from RPC data when ok is false', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, reason: 'already_used' },
      error: null,
    });
    const result = await claimMeishFree('user@test.com');
    expect(result).toEqual({ success: false, reason: 'already_used' });
  });
});

// ============================================================
// checkFreeEligibility
// ============================================================

describe('checkFreeEligibility', () => {
  it('returns email_missing for empty email', async () => {
    const result = await checkFreeEligibility('');
    expect(result).toEqual({ eligible: false, reason: 'email_missing' });
  });

  it('returns meish_free when user is confirmed and has not used meish free', async () => {
    // 1st call: entries query → confirmed entry found
    const entriesChain = chainable({ data: { id: '123' }, error: null });
    // 2nd call: meish claims → not used
    const meishChain = chainable({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(entriesChain)
      .mockReturnValueOnce(meishChain);

    const result = await checkFreeEligibility('artist@test.com');
    expect(result).toEqual({
      eligible: true,
      reason: 'meish_free_available',
      freeType: 'meish',
    });
  });

  it('returns first20_free when non-adopted user has remaining slots', async () => {
    // entries → no match
    const entriesChain = chainable({ data: null, error: null });
    // meish claims → not used
    const meishChain = chainable({ data: null, error: null });
    // first20 redemptions → not used
    const first20Chain = chainable({ data: null, error: null });
    // stats → remaining > 0
    const statsChain = chainable({ data: { remaining: 5 }, error: null });

    mockFrom
      .mockReturnValueOnce(entriesChain)
      .mockReturnValueOnce(meishChain)
      .mockReturnValueOnce(first20Chain)
      .mockReturnValueOnce(statsChain);

    const result = await checkFreeEligibility('visitor@test.com');
    expect(result).toEqual({
      eligible: true,
      reason: 'first20_free_available',
      freeType: 'first20',
    });
  });

  it('returns first20_limit_reached when no remaining slots', async () => {
    const entriesChain = chainable({ data: null, error: null });
    const meishChain = chainable({ data: null, error: null });
    const first20Chain = chainable({ data: null, error: null });
    const statsChain = chainable({ data: { remaining: 0 }, error: null });

    mockFrom
      .mockReturnValueOnce(entriesChain)
      .mockReturnValueOnce(meishChain)
      .mockReturnValueOnce(first20Chain)
      .mockReturnValueOnce(statsChain);

    const result = await checkFreeEligibility('visitor@test.com');
    expect(result).toEqual({
      eligible: false,
      reason: 'first20_limit_reached',
    });
  });

  it('returns first20_already_used when already redeemed', async () => {
    const entriesChain = chainable({ data: null, error: null });
    const meishChain = chainable({ data: null, error: null });
    // first20 row exists and not converted
    const first20Chain = chainable({
      data: { email: 'visitor@test.com', converted_to_meish_at: null },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(entriesChain)
      .mockReturnValueOnce(meishChain)
      .mockReturnValueOnce(first20Chain);

    const result = await checkFreeEligibility('visitor@test.com');
    expect(result).toEqual({
      eligible: false,
      reason: 'first20_already_used',
    });
  });

  it('returns meish_already_used when adopted user has already used meish free', async () => {
    // entries → confirmed
    const entriesChain = chainable({ data: { id: '123' }, error: null });
    // meish claims → already used
    const meishChain = chainable({
      data: { email: 'artist@test.com' },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(entriesChain)
      .mockReturnValueOnce(meishChain);

    const result = await checkFreeEligibility('artist@test.com');
    expect(result).toEqual({
      eligible: false,
      reason: 'meish_already_used',
    });
  });
});
