// src/app/mypage/portfolio/page.tsx
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import PortfolioSettingsClient from './PortfolioSettingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'ポートフォリオ設定 | me-ish',
  description: '公開用ポートフォリオの表示設定を管理します',
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      <span className="ml-2 text-gray-500">読み込み中...</span>
    </div>
  );
}

export default function PortfolioSettingsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PortfolioSettingsClient />
    </Suspense>
  );
}
