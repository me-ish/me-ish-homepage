// app/float/page.tsx（サンプル）
import dynamic from 'next/dynamic';

const FloatGalleryClient = dynamic(
  () => import('@/components/floatGallery/FloatGallery'), // ← 実際のパス
  { ssr: false }                                          // ★ SSRを切る
);

export default function FloatPage() {
  return <FloatGalleryClient />;
}
