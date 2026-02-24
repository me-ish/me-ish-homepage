// src/app/mypage/page.tsx
import { Suspense } from 'react';
import MyPageClient from './MyPageClient';
import { Loader2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

// 動的レンダリング（認証チェックのため）
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'マイページ | me-ish',
  description: 'いいねした作品や出展作品を管理できます',
};

function LoadingFallback({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
        <p className="mt-4 text-gray-500">{text}</p>
      </div>
    </div>
  );
}

export default async function MyPage() {
  const t = await getTranslations('pages.mypagePage');
  return (
    <Suspense fallback={<LoadingFallback text={t('loadingText')} />}>
      <MyPageClient />
    </Suspense>
  );
}
