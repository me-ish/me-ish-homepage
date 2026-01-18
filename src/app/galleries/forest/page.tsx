'use client';

import dynamic from 'next/dynamic';

/**
 * 森テーマギャラリーページ
 *
 * /galleries/forest でアクセス可能
 */

// SSR無効でCanvas系コンポーネントを読み込み
const ForestGalleryScene = dynamic(
  () => import('@/components/themeGalleries/forest/ForestGalleryScene'),
  { ssr: false }
);

export default function ForestGalleryPage(): React.JSX.Element {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <ForestGalleryScene className="w-full h-full" />
    </main>
  );
}
