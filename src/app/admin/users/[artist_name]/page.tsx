// src/app/admin/users/[artist_name]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Entry = {
  id: number;
  title: string | null;
  sale_type: string | null;
  price: number | null;
  confirmed: boolean;
  created_at: string; // ISO
};

type SortKey = 'created_at' | 'price' | 'confirmed';

export default function AdminUserDetailPage() {
  const params = useParams<{ artist_name: string }>();
  const router = useRouter();

  // URL -> DBに保存されている元の文字列へ
  const artistName = useMemo(() => {
    const raw = Array.isArray(params?.artist_name)
      ? params.artist_name.join('/')
      : (params?.artist_name ?? '');
    return decodeURIComponent(raw);
  }, [params]);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const supabase = useMemo(() => supabaseBrowser(), []);
  const mountedRef = useRef(true);

  // 管理者ガード（/admin-login で isAdmin=true を保存している想定）
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('isAdmin') !== 'true') {
      router.replace('/admin-login?err=unauthorized');
    }
  }, [router]);

  const refresh = async () => {
    if (!artistName) return;
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('id,title,sale_type,price,confirmed,created_at')
        .eq('artist_name', artistName)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (mountedRef.current) setEntries((data || []) as Entry[]);
    } catch (e: any) {
      console.error('[admin/user-detail] fetch error:', e);
      if (mountedRef.current) setErr(e?.message ?? '取得に失敗しました');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistName, supabase]);

  // 並び替え
  const sorted = useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => {
      let av: number | string | boolean | null = null;
      let bv: number | string | boolean | null = null;
      switch (sortKey) {
        case 'price':
          av = a.price ?? -Infinity;
          bv = b.price ?? -Infinity;
          break;
        case 'confirmed':
          av = a.confirmed ? 1 : 0;
          bv = b.confirmed ? 1 : 0;
          break;
        default:
          av = +new Date(a.created_at);
          bv = +new Date(b.created_at);
      }
      const diff = (av as number) - (bv as number);
      return sortDir === 'asc' ? diff : -diff;
    });
    return list;
  }, [entries, sortKey, sortDir]);

  // 統計
  const stats = useMemo(() => {
    const total = entries.length;
    const confirmed = entries.filter((e) => e.confirmed).length;
    const sum = entries.reduce((s, e) => s + (e.price ?? 0), 0);
    return { total, confirmed, sum };
  }, [entries]);

  // CSV
  const exportCSV = () => {
    const rows = [
      ['id', 'title', 'sale_type', 'price_yen', 'confirmed', 'created_at'],
      ...sorted.map((e) => [
        e.id,
        (e.title ?? '').replace(/"/g, '""'),
        e.sale_type ?? '',
        e.price ?? '',
        e.confirmed ? 'true' : 'false',
        e.created_at,
      ]),
    ]
      .map((r) => r.map((c) => `"${String(c)}"`).join(','))
      .join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `me-ish_${artistName}_entries.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-end gap-3 mb-2">
        <h1 className="text-2xl font-bold">{artistName} の応募作品</h1>
        <span className="text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
          {stats.total} 件（承認 {stats.confirmed}）
        </span>
        <span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
          合計価格 ¥{stats.sum.toLocaleString()}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={refresh}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            再読込
          </button>
          <button
            onClick={exportCSV}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            CSV出力
          </button>
        </div>
      </div>

      {/* 並び替え */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <label>並び替え:</label>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded border px-2 py-1"
        >
          <option value="created_at">応募日</option>
          <option value="price">価格</option>
          <option value="confirmed">承認</option>
        </select>
        <select
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
          className="rounded border px-2 py-1"
        >
          <option value="desc">降順</option>
          <option value="asc">昇順</option>
        </select>
      </div>

      {/* 本文 */}
      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : err ? (
        <div className="rounded border bg-red-50 text-red-700 p-3">{err}</div>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">この作家の応募作品はまだありません。</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border text-left">タイトル</th>
              <th className="p-3 border w-32">販売形式</th>
              <th className="p-3 border w-28">価格</th>
              <th className="p-3 border w-24">承認</th>
              <th className="p-3 border w-36">応募日</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="p-3 border">{entry.title ?? '（無題）'}</td>
                <td className="p-3 border">{entry.sale_type ?? '—'}</td>
                <td className="p-3 border">
                  {entry.price != null ? `¥${entry.price.toLocaleString()}` : '—'}
                </td>
                <td className="p-3 border text-center">
                  {entry.confirmed ? '✅ 承認済' : '未承認'}
                </td>
                <td className="p-3 border">
                  {new Date(entry.created_at).toLocaleDateString('ja-JP')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
