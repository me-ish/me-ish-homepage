// src/app/(marketing)/layout.tsx
import { Suspense } from 'react';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      {/* ヘッダーが fixed 70px なので余白を付与 */}
      <main className="pt-[70px]">{children}</main>
      <Footer />
    </>
  );
}
