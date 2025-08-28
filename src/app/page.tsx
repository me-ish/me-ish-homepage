// src/app/page.tsx
// ※ サーバーコンポーネント（"use client" を置かない）
import MobileHome from '@/components/MobileHome';
import DesktopHome from '@/components/DesktopHome';

// 必要なら ISR/SSG 方針に沿って下記を使う（任意）
// export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <>
      {/* 1024px 未満で表示 */}
      <div className="lg:hidden">
        <MobileHome />
      </div>
      {/* 1024px 以上で表示 */}
      <div className="hidden lg:block">
        <DesktopHome />
      </div>
    </>
  );
}
