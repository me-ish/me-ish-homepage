// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 同一オリジン or ルート始まりのみ許可（オープンリダイレクト対策）
function safeNext(url: URL): string {
  const raw = url.searchParams.get('next') || '/';
  try {
    // ルート相対 /path は許可。ただし //evil のようなプロトコル相対は拒否
    if (raw.startsWith('/')) return raw.startsWith('//') ? '/' : raw;

    // 絶対URLが来たら同一オリジンのみ許可
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
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  } catch (e) {
    console.error('[auth/callback] exchangeCodeForSession failed:', e);
    return NextResponse.redirect(new URL('/admin-login?err=oauth', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
