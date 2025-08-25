// src/app/news/page.tsx
import { Suspense } from 'react';
import NewsList from '@/app/news/_components/NewsList'; // ← .tsx を明示

export default function NewsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">お知らせ</h1>
      <Suspense fallback={<div>読み込み中…</div>}>
        <NewsList />
      </Suspense>
    </main>
  );
}
