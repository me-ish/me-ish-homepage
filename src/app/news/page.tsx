// app/news/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Search, RefreshCcw, ArrowRight } from 'lucide-react';

type Category = 'all' | 'info' | 'update' | 'maintenance';

type Announcement = {
  id: string | number;
  title: string;
  body_md: string;
  category: 'info' | 'update' | 'maintenance';
  pinned: boolean;
  published_at: string;
  link_url?: string | null;
};

const PAGE_SIZE = 10;

export default function NewsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyMore, setBusyMore] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);

  // クエリ（検索 & カテゴリ）をURLから同期
  const q = (params.get('q') || '').trim();
  const category = (params.get('cat') as Category) || 'all';

  // 入力コントロール用のローカル状態（入力確定でURL更新）
  const [qInput, setQInput] = useState(q);
  const [catInput, setCatInput] = useState<Category>(category);

  // URLの変化に追随
  useEffect(() => {
    setQInput(q);
    setCatInput(category);
  }, [q, category]);

  // 取得処理
  const fetchPage = async (pageIndex: number, append = false) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('announcements_public') // viewでもtableでもOK
      .select('*', { count: 'exact' })
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .range(from, to);

    if (category !== 'all') {
      query = query.eq('category', category);
    }
    if (q) {
      // タイトル or 本文をゆるく検索
      query = query.or(`title.ilike.%${q}%,body_md.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      return { data: [] as Announcement[], count: 0 };
    }
    if (pageIndex === 0) {
      setTotal(count ?? null);
      setItems((data ?? []) as Announcement[]);
    } else if (append) {
      setItems((prev) => [...prev, ...(data ?? []) as Announcement[]]);
    }
    return { data: (data ?? []) as Announcement[], count: count ?? 0 };
  };

  // 初期 & クエリ変更時
  useEffect(() => {
    setLoading(true);
    setPage(0);
    (async () => {
      await fetchPage(0, false);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category]);

  const canLoadMore = useMemo(() => {
    if (total == null) return true;
    return items.length < total;
  }, [items.length, total]);

  const onSubmitFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (qInput) qs.set('q', qInput);
    if (catInput !== 'all') qs.set('cat', catInput);
    router.replace(`/news${qs.toString() ? `?${qs.toString()}` : ''}`);
  };

  return (
    <main className="px-6 py-14 max-w-4xl mx-auto text-[#222]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-[#00a1e9]">お知らせ</h1>
        <p className="text-sm text-[#667] mt-1">ピン留めを優先して新着順に表示しています。</p>
      </header>

      {/* フィルターバー */}
      <form onSubmit={onSubmitFilters} className="mb-6 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
        <label className="relative block">
          <span className="sr-only">検索</span>
          <Search className="w-4 h-4 text-[#889] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="キーワードで検索（タイトル・本文）"
            className="w-full rounded-xl border px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/20"
            aria-label="お知らせを検索"
          />
        </label>

        <label className="sm:ml-2">
          <span className="sr-only">カテゴリ</span>
          <select
            value={catInput}
            onChange={(e) => setCatInput(e.target.value as Category)}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/20"
            aria-label="カテゴリを選択"
          >
            <option value="all">すべて</option>
            <option value="info">Info</option>
            <option value="update">Update</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>

        <div className="flex gap-2 sm:ml-2">
          <button
            type="submit"
            className="flex-1 sm:flex-initial rounded-xl bg-[#00a1e9] text-white px-4 py-2 text-sm font-semibold hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/40"
          >
            絞り込む
          </button>
          {(q || category !== 'all') && (
            <Link
              href="/news"
              className="inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm text-[#223] hover:bg-[#f7fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20"
              aria-label="フィルターをクリア"
            >
              <RefreshCcw className="w-4 h-4" />
              クリア
            </Link>
          )}
        </div>
      </form>

      {/* リスト */}
      {loading ? (
        <ul className="space-y-3" aria-busy="true" aria-live="polite">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-3.5 w-20 bg-gray-200/70 rounded animate-pulse mb-2" />
              <div className="h-4 w-2/3 bg-gray-200/80 rounded animate-pulse mb-2" />
              <div className="h-4 w-full bg-gray-200/60 rounded animate-pulse" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <p className="text-sm text-[#667]">該当するお知らせはありません。</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className="group rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center gap-2">
                <Badge type={n.category} />
                {n.pinned && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">固定</span>
                )}
                <time className="ml-auto text-xs text-gray-500">
                  {new Date(n.published_at).toLocaleDateString()}
                </time>
              </div>

              <h2 className="mt-1 text-[1.02rem] font-semibold leading-snug line-clamp-2">{n.title}</h2>
              <p className="mt-1 text-sm text-[#556] leading-relaxed line-clamp-3">
                {n.body_md?.replace(/\n/g, ' ')}
              </p>

              <div className="mt-2">
                {n.link_url ? (
                  // 外部詳細
                  <a
                    href={n.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#00a1e9] underline underline-offset-4 hover:opacity-80"
                  >
                    くわしく <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  // 内部詳細（将来的に /news/[id] を作るならここを切り替え）
                  <Link
                    href="/news"
                    className="inline-flex items-center gap-1 text-sm text-[#00a1e9] underline underline-offset-4 hover:opacity-80"
                  >
                    詳細・一覧へ <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ページング */}
      {!loading && canLoadMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={async () => {
              setBusyMore(true);
              const next = page + 1;
              await fetchPage(next, true);
              setPage(next);
              setBusyMore(false);
            }}
            disabled={busyMore}
            className="rounded-full border px-5 py-2.5 text-sm font-semibold hover:bg-[#f7fbff] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/30"
          >
            {busyMore ? '読み込み中…' : 'もっと見る'}
          </button>
        </div>
      )}
    </main>
  );
}

/* ---- 小物 ---- */

function Badge({ type }: { type: 'info' | 'update' | 'maintenance' }) {
  const styles: Record<string, string> = {
    info: 'bg-[#e8f4ff] text-[#005a9e]',
    update: 'bg-[#eafbea] text-[#1b6e2b]',
    maintenance: 'bg-[#fff1f0] text-[#a23a3a]',
  };
  const label: Record<string, string> = {
    info: 'Info',
    update: 'Update',
    maintenance: 'Maintenance',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded ${styles[type]}`}>{label[type]}</span>;
}
