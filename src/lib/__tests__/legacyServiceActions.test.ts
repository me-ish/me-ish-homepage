import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_SERVICE_PAUSED_MESSAGE } from '@/lib/legacyServiceSuspension';

const { admin } = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: admin }));
vi.mock('@/lib/constants', () => ({ getSiteUrl: () => 'https://example.invalid' }));
import { saveBankAccount } from '@/app/_actions/saveBankAccount';
import { sendEmail } from '@/app/_actions/sendEmail';
import { approveEntryAction, rejectEntryAction, resetEntryAction } from '@/app/admin/entries/actions';

describe('server action suspension independent of request pathname', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not access Supabase for the gallery entry bank action', async () => {
    expect(await saveBankAccount({ external_user_id: 'synthetic', bank_code: '0000',
      branch_code: '000', account_type: 'futsu', account_number: '0000000', account_name_kana: 'テスト' }))
      .toEqual({ error: LEGACY_SERVICE_PAUSED_MESSAGE });
    expect(admin).not.toHaveBeenCalled();
  });

  it('rejects old entry and mail actions without network effects', async () => {
    for (const action of [() => approveEntryAction(1), () => rejectEntryAction(1, null),
      () => resetEntryAction(1), () => sendEmail('submit', {})]) {
      await expect(action()).rejects.toThrow(LEGACY_SERVICE_PAUSED_MESSAGE);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['contact', 'purchaseBuyer', 'purchaseArtist'] as const)
  ('preserves %s mail through its existing internal API', async (kind) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'sent' }), { status: 200 }));
    await expect(sendEmail(kind, { synthetic: true })).resolves.toEqual({ status: 'sent' });
    expect(fetch).toHaveBeenCalledWith(`https://example.invalid/api/send-email/${kind}`, expect.objectContaining({ method: 'POST' }));
  });
});
