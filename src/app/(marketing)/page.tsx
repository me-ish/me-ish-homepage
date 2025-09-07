// src/app/page.tsx
// サーバーコンポーネントに戻す（"use client" を置かない）
import MobileHome from '@/components/MobileHome';
import DesktopHome from '@/components/DesktopHome';

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
