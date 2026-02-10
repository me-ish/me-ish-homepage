// ★ server component（"use client" は付けない）
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ナトリ先生 — Official Links',
  description:
    'ナトリ先生の公式リンク入口ページ。X / Instagram / TikTok / BOOTH / Skeb / VGen へのご案内。',
  openGraph: {
    title: 'ナトリ先生 — Official Links',
    description: 'X / Instagram / TikTok / BOOTH / Skeb / VGen への入口ページ。',
    url: 'https://your-domain.com/natori/links',
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
