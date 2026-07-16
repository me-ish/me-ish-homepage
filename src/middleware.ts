// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import {
  NATORI_KEY_COOKIE,
  NATORI_KEY_PARAM,
} from '@/features/natori/constants/dashboardKey';
import {
  constantTimeEquals,
  deriveNatoriDashboardCookieToken,
} from '@/features/natori/lib/dashboardKeyToken';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // natori 管理画面の合言葉キー: `?natori-key=<NATORI_DASHBOARD_KEY>` 付きで
  // 開くと 1 年有効の Cookie をセットし、キーを消した URL にリダイレクトする。
  // Cookie 値はキー平文ではなく HMAC トークン（漏洩してもキーは復元不可）。
  // 判定本体は features/natori/server/requireNatoriAdmin.ts の
  // canUseNatoriManagement を参照。
  //
  // 注意（運用リスク）: キーを URL クエリで渡すため、ブラウザ履歴・アクセスログ・
  // 中継プロキシのログに残り得る。共有時は信頼できる相手にのみ渡し、漏洩が
  // 疑われる場合は NATORI_DASHBOARD_KEY をローテーションすること（キーを変えると
  // 発行済み Cookie も全て無効になる）。リダイレクトでクエリからは即座に消すため
  // Referer 経由の漏洩は起きない。
  const expectedKey = process.env.NATORI_DASHBOARD_KEY?.trim();
  const providedKey = request.nextUrl.searchParams.get(NATORI_KEY_PARAM);
  if (expectedKey && providedKey) {
    // 双方を HMAC に通してから比較することで、文字列比較のタイミング差から
    // キーを推測される余地を無くす（edge runtime に timingSafeEqual が無いため）。
    const [expectedToken, providedToken] = await Promise.all([
      deriveNatoriDashboardCookieToken(expectedKey),
      deriveNatoriDashboardCookieToken(providedKey),
    ]);
    if (!constantTimeEquals(expectedToken, providedToken)) {
      return intlMiddleware(request);
    }
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete(NATORI_KEY_PARAM);
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set({
      name: NATORI_KEY_COOKIE,
      value: expectedToken,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|admin|admin-login|auth|counts|_next|_vercel|.*\\..*).*)'],
};
