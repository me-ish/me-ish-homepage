// ★ server component（"use client" は付けない）
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ナトリ — Official Links',
  description:
    'ナトリのリンク一覧。X / TikTok / BOOTH / Wick / Skeb へのご案内。',
  openGraph: {
    title: 'ナトリ — Official Links',
    description: 'X / TikTok / BOOTH / Wick / Skeb への入口ページ。',
    url: 'https://www.me-ish.art/natori/links',
    siteName: 'Natori Links',
    images: [{ url: '/og/natori-links.jpg', width: 1200, height: 630 }],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@your_handle',
    creator: '@your_handle',
  },
};

export default function LinksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
