import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/isAdmin';
import { safeCompare } from '@/lib/auth/timingSafe';

export type AdminAuthResult =
  | { ok: true; adminEmail: string }
  | { ok: false; response: NextResponse };

/**
 * Admin API 共通認証ガード
 *
 * 認証方法（優先順位順）:
 * 1. ADMIN_API_TOKEN ヘッダー (x-meish-admin-token or Authorization: Bearer)
 * 2. Cookie-based Supabase session + admin email check
 */
export async function requireAdminAuth(
  req: NextRequest,
): Promise<AdminAuthResult> {
  // --- 方法1: ADMIN_API_TOKEN ヘッダー ---
  const expected = process.env.ADMIN_API_TOKEN;
  if (expected) {
    const header =
      req.headers.get('x-meish-admin-token') ??
      (req.headers.get('authorization')?.startsWith('Bearer ')
        ? req.headers.get('authorization')!.slice('Bearer '.length)
        : null);

    if (header && safeCompare(header, expected)) {
      return { ok: true, adminEmail: 'api-token' };
    }
  }

  // --- 方法2: Cookie-based session ---
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email ?? null;
    if (email && isAdminEmail(email)) {
      return { ok: true, adminEmail: email };
    }
  } catch {
    // Cookie 取得失敗は無視して 401 へ
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}
