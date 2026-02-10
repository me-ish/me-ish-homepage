'use client';

import dynamic from 'next/dynamic';

const WhiteGallery = dynamic(() => import('@/components/whiteGallery/WhiteGallery'), {
  ssr: false,
  loading: () => <div className="text-center py-20">読み込み中...</div>,
});

export default function WhitePageClient() {
  return <WhiteGallery />;
}
