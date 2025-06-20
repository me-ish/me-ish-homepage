import { Suspense } from 'react';
import MyPageClient from './MyPageClient';

export default function MyPage() {
  return (
    <Suspense fallback={<p className="text-center mt-20">マイページを読み込み中です...</p>}>
      <MyPageClient />
    </Suspense>
  );
}
