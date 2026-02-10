// app/white/page.tsx
import dynamic from 'next/dynamic';

const WhiteGalleryClient = dynamic(
  () => import('@/components/whiteGallery/WhiteGallery'), // 実パスに合わせて
  { ssr: false }                                          // ★ 重要
);

export default function WhitePage() {
  return <WhiteGalleryClient />;
}
