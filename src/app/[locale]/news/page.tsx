import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import NewsList from '@/app/[locale]/news/_components/NewsList';

export default async function NewsPage({
  searchParams,
}: { searchParams?: { q?: string } }) {
  const t = await getTranslations('pages.news');
  const q = searchParams?.q ?? '';
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <Suspense fallback={<div>{t('loading')}</div>}>
        {/* サーバーコンポーネントに q を渡す */}
        <NewsList q={q} />
      </Suspense>
    </main>
  );
}

