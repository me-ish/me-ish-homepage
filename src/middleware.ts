// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  // デフォルト言語のURLからプレフィックスを省略（/ja/works → /works）
  localePrefix: 'as-needed',
});

export const config = {
  // 国際化が必要なパスのみマッチ
  // 静的ファイル、API、_next等は除外
  matcher: [
    '/((?!api|_next|_vercel|admin|admin-login|auth|.*\\..*).*)',
  ],
};
