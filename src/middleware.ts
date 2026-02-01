// src/middleware.ts
// TODO: next-intl middleware - 一時的に無効化
// import createMiddleware from 'next-intl/middleware';
// import { locales, defaultLocale } from './i18n/config';

// export default createMiddleware({
//   locales,
//   defaultLocale,
//   localePrefix: 'as-needed',
// });

// 空のmiddleware（何もしない）
export default function middleware() {
  // pass through
}

export const config = {
  matcher: [],
};
