'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Entry = {
  id: number;
  title: string | null;
  artist_name: string | null;
  email: string | null;
  image_url: string | null;
  created_at: string | null;
  price: number | null;
  is_sold: boolean | null;
  edition_sold: number | null;
  edition_total: number | null;
  artist_reward_yen: number | null;
};

// Existing purchases may still need support. Keep the authenticated reader;
// retired exhibition/review controls must not offer operations that cannot run.
export default function AdminEntriesClient({ adminEmail }: { adminEmail: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const response = await fetch('/admin/api/entries?sortKey=created_at&sortOrder=desc', {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('作品記録を取得できませんでした。再読み込みしてください。');
        const rows: Entry[] = await response.json();
        if (!Array.isArray(rows)) throw new Error('作品記録の応答を確認できませんでした。');
        if (!controller.signal.aborted) setEntries(rows);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : '作品記録を取得できませんでした。');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  const search = keyword.trim().toLocaleLowerCase();
  const visible = entries.filter((entry) =>
    `${entry.id} ${entry.title ?? ''} ${entry.artist_name ?? ''}`.toLocaleLowerCase().includes(search));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-neutral-900">
      <Link href="/admin" className="text-sm text-sky-700">管理トップへ</Link>
      <h1 className="mt-4 text-2xl font-semibold">旧ギャラリーの作品記録</h1>
      <p className="mt-2 text-sm text-neutral-600">公開・応募・審査・展示は終了しました。過去の購入に関する確認用です。</p>
      <p className="mt-2 text-xs text-neutral-500">{adminEmail}</p>
      <div className="mt-6 mb-6 flex flex-wrap items-end gap-4">
        <label className="text-sm">作品名・作家名・作品ID
          <input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)}
            className="mt-1 block rounded border border-neutral-300 px-3 py-2" />
        </label>
        <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}
          className="rounded border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50">再読み込み</button>
        <Link href="/admin/payouts" className="text-sm text-sky-700">売上・振込を確認</Link>
      </div>
      {loading ? <p role="status">読み込み中…</p> : error ? <p role="alert">{error}</p> : (
        <>
          <p className="mb-4 text-sm text-neutral-600">{visible.length}件</p>
          <ul className="space-y-4">
            {visible.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex gap-4">
                  {entry.image_url && <Image src={entry.image_url} alt={entry.title ?? '作品'} width={96} height={96} unoptimized className="object-contain" />}
                  <div className="min-w-0">
                    <h2 className="font-semibold">#{entry.id} {entry.title || '無題'}</h2>
                    {entry.artist_name ? <Link className="text-sm text-sky-700" href={`/admin/users/${encodeURIComponent(entry.artist_name)}`}>{entry.artist_name}</Link> : <p>作家名未登録</p>}
                    <p className="text-sm">{entry.email}</p>
                    <p className="text-sm">登録日: {entry.created_at ? new Date(entry.created_at).toLocaleDateString('ja-JP') : '未記録'}</p>
                    <p className="text-sm">価格: {entry.price == null ? '未登録' : `${entry.price.toLocaleString('ja-JP')}円`}</p>
                    <p className="text-sm">販売済み: {entry.edition_sold ?? (entry.is_sold ? 1 : 0)} / {entry.edition_total ?? '—'}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {visible.length === 0 && <p>該当する作品記録はありません。</p>}
        </>
      )}
    </main>
  );
}
