// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { isAnalyticsExcludedPath } from '@/lib/analyticsPrivacy';
import {
  NATORI_KEY_COOKIE,
  NATORI_KEY_COOKIE_MAX_AGE_SECONDS,
  NATORI_KEY_PARAM,
} from '@/features/natori/constants/dashboardKey';
import {
  constantTimeEquals,
  deriveNatoriDashboardCookieToken,
  deriveNatoriDashboardKeyProof,
} from '@/features/natori/lib/dashboardKeyToken';
import {
  getLegacyPauseDestination,
  getSuspendedLegacyApi,
  getSuspendedLegacyPage,
  LEGACY_SERVICE_PAUSED_MESSAGE,
} from '@/lib/legacyServiceSuspension';

const intlMiddleware = createMiddleware(routing);

function protectPrivateResponse(response: NextResponse, pathname: string): NextResponse {
  if (isAnalyticsExcludedPath(pathname)) {
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/_next/image') {
    const source=request.nextUrl.searchParams.get('url');
    if (source) {
      try {
        const imagePath=decodeURIComponent(new URL(source,request.url).pathname).replace(/\/{2,}/g, "/").replace(/\/$/, "");
        if (/^\/api\/natori\/(?:admin\/(?:portfolio-assets|project-thumbs)|portfolio\/assets)(?:\/|$)/.test(imagePath)
          || imagePath==='/og/natori-portfolio.png') {
          return NextResponse.json({error:'image_optimization_disabled'},{status:400,headers:{'Cache-Control':'no-store'}});
        }
      } catch { return NextResponse.json({error:'invalid_image_url'},{status:400,headers:{'Cache-Control':'no-store'}}); }
    }
    return NextResponse.next();
  }
  const apiService = getSuspendedLegacyApi(pathname, request.method);
  if (apiService) {
    return NextResponse.json(
      { error: 'legacy_service_paused', message: LEGACY_SERVICE_PAUSED_MESSAGE, service: apiService },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const pageService = getSuspendedLegacyPage(pathname);
  if (pageService) {
    const destination = new URL(getLegacyPauseDestination(pathname, pageService), request.url);
    const response = NextResponse.redirect(destination, 307);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  // Explicit API/auth matchers below must never send these routes through intl
  // or the dashboard-key redirect flow.
  if (/^\/(?:api|admin|auth)(?:\/|$)/.test(pathname)) {
    return protectPrivateResponse(NextResponse.next(), pathname);
  }

  // natori 管理画面の合言葉キー: `?natori-key=<NATORI_DASHBOARD_KEY>` 付きで
  // 開くと 8 時間有効の Cookie をセットし（発行時刻を署名に含め、サーバー側でも 8 時間を検証する）、キーを消した URL にリダイレクトする。
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
    const [expectedProof, providedProof] = await Promise.all([
      deriveNatoriDashboardKeyProof(expectedKey),
      deriveNatoriDashboardKeyProof(providedKey),
    ]);
    if (!constantTimeEquals(expectedProof, providedProof)) {
      return protectPrivateResponse(intlMiddleware(request), pathname);
    }
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete(NATORI_KEY_PARAM);
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set({
      name: NATORI_KEY_COOKIE,
      value: await deriveNatoriDashboardCookieToken(expectedKey),
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: NATORI_KEY_COOKIE_MAX_AGE_SECONDS,
    });
    return protectPrivateResponse(response, pathname);
  }

  return protectPrivateResponse(intlMiddleware(request), pathname);
}

export const config = {
  matcher: [
    '/_next/image',
    '/((?!api|admin|admin-login|auth|counts|_next|_vercel|.*\\..*).*)',
    '/api/:path*',
    '/admin/api/:path*',
    '/auth/link/:path*',
    '/cert/:path*',
    '/:locale(ja|en)/cert/:path*',
    // The default locale matcher excludes dots. Explicit entries also cover
    // old URLs whose ids/slugs contain dots, including localized URLs.
    '/:service(entry|renew|login|mypage|aura|card)/:path*',
    '/:locale(ja|en)/:service(entry|renew|login|mypage|aura|card)/:path*',
  ],
};
