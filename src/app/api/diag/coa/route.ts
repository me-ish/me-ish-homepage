import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const sb = supabaseAdmin();
    // 軽い読み取りで権限/テーブル存在を確認
    const { data, error } = await sb
      .from('cert_links')
      .select('id, entry_id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      hasRow: !!data?.length,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        CERT_REQUIRE_TOKEN: process.env.CERT_REQUIRE_TOKEN ?? '(unset)',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
