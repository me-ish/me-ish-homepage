import { Suspense } from 'react';
import MyPageClient from './MyPageClient';

// SSGさせず動的に描画（ビルド時にサーバで実行されないように）
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MyPage() {
  return (
    <Suspense fallback={<p className="text-center mt-20">マイページを読み込み中です...</p>}>
      <MyPageClient />
    </Suspense>
  );
}
