// src/app/(marketing)/layout.tsx
import { Suspense } from 'react';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* a11y: スキップリンク */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100]"
      >
        メインへスキップ
      </a>

      {/* サスペンド不要ならそのまま <Header /> に */}
      <Suspense fallback={<div style={{ height: 'var(--header-h, 70px)' }} />}>
        <Header />
      </Suspense>

      {/* 固定値ではなく CSS 変数でオフセット */}
      <main id="main-content" className="pt-[var(--header-h,70px)]">
        {children}
      </main>

      <Footer />
    </>
  );
}
