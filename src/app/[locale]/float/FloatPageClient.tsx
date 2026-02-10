'use client';

import dynamic from 'next/dynamic';

const FloatGallery = dynamic(() => import('@/components/floatGallery/FloatGallery'), {
  ssr: false,
  loading: () => <div className="text-center py-20">読み込み中...</div>,
});

export default function FloatPageClient() {
  return <FloatGallery />;
}
