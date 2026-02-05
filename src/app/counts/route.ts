// app/admin/api/counts/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/isAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const revalidate = 0;

export async function GET() {
  // 1) ルートハンドラ向けの Supabase（ユーザー特定用）
  const supabase = createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2) 集計はサービスロールで（RLSの影響を受けない）
  const admin = supabaseAdmin();

  const [{ count: c1, error: e1 }, { count: c2, error: e2 }] = await Promise.all([
    admin.from('entries').select('*', { count: 'exact', head: true }).eq('confirmed', false),
    admin.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false),
  ]);

  if (e1 || e2) {
    return NextResponse.json({ error: 'count_failed' }, { status: 500 });
  }

  return NextResponse.json(
    { newEntryCount: c1 ?? 0, newInquiryCount: c2 ?? 0 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
