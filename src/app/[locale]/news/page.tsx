import { Suspense } from 'react';
import NewsList from '@/app/[locale]/news/_components/NewsList';

export default function NewsPage({
  searchParams,
}: { searchParams?: { q?: string } }) {
  const q = searchParams?.q ?? '';
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">お知らせ</h1>
      <Suspense fallback={<div>読み込み中…</div>}>
        {/* サーバーコンポーネントに q を渡す */}
        <NewsList q={q} />
      </Suspense>
    </main>
  );
}

