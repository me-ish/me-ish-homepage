// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 同一オリジン or ルート始まりのみ許可（オープンリダイレクト対策）
// `/login` 側は `?redirect=` を渡してくるので両方受け付ける。
function safeNext(url: URL): string {
  const raw =
    url.searchParams.get('next') ||
    url.searchParams.get('redirect') ||
    '/';
  try {
    // Relative paths must pass the same normalized-origin check as absolute
    // URLs. Browsers normalize backslashes into authority separators.
    if (/[\\\u0000-\u0020\u007f]/.test(raw) || /%5c|%0[0-9a-f]|%1[0-9a-f]|%7f/i.test(raw)
      || (!raw.startsWith('/') && !raw.startsWith(url.origin))) return '/';
    const u = new URL(raw, url.origin);
    if (u.origin === url.origin) {
      return u.pathname + u.search + u.hash;
    }
  } catch {
    /* no-op */
  }
  return '/';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthErr = url.searchParams.get('error') || url.searchParams.get('error_description');
  const next = safeNext(url);

  // プロバイダ側のエラーはログイン画面へ
  if (oauthErr) {
    return NextResponse.redirect(
      new URL(`/admin-login?err=${encodeURIComponent(oauthErr)}`, url.origin)
    );
  }

  if (!code) {
    // code がない場合はそのまま next へ
    return NextResponse.redirect(new URL(next, url.origin));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/admin-login?err=oauth', url.origin));
  } catch (e) {
    console.error('[auth/callback] exchangeCodeForSession failed:', e);
    return NextResponse.redirect(new URL('/admin-login?err=oauth', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
