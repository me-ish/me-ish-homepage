import { Suspense } from 'react';
import Header from '@/components/shared/Header';

export default function WithHeaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100]"
      >
        メインへスキップ
      </a>
      <Suspense fallback={<div style={{ height: 'var(--header-h, 70px)' }} />}>
        <Header />
      </Suspense>
      <main id="main-content" className="pt-[var(--header-h,70px)]">
        {children}
      </main>
    </>
  );
}
