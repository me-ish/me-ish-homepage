import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/isAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  const supabase = createClient();

  // Google から返ってきた code を Supabase セッションに交換
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 交換できていれば user が取れる
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email && isAdminEmail(user.email)) {
    // 管理者ならダッシュボードへ
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  // 非管理者 or 失敗時はログイン画面へ
  return NextResponse.redirect(new URL('/admin-login?err=unauthorized', req.url));
}


