// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import {
  NATORI_KEY_COOKIE,
  NATORI_KEY_PARAM,
} from '@/features/natori/constants/dashboardKey';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // natori 管理画面の合言葉キー: `?natori-key=<NATORI_DASHBOARD_KEY>` 付きで
  // 開くと 1 年有効の Cookie をセットし、キーを消した URL にリダイレクトする。
  // 判定本体は features/natori/server/requireNatoriAdmin.ts の
  // canUseNatoriManagement を参照。
  const expectedKey = process.env.NATORI_DASHBOARD_KEY?.trim();
  const providedKey = request.nextUrl.searchParams.get(NATORI_KEY_PARAM);
  if (expectedKey && providedKey === expectedKey) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete(NATORI_KEY_PARAM);
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set({
      name: NATORI_KEY_COOKIE,
      value: expectedKey,
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
