// src/app/admin/users/[artist_name]/AdminUserDetailClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Entry = {
  id: number;
  title: string | null;
  price: number | null;
  confirmed: boolean | null; // ← null を許容
  created_at: string; // ISO
};

type SortKey = 'created_at' | 'price' | 'confirmed';

type Props = { adminEmail: string; artistName: string };

export default function AdminUserDetailClient({ adminEmail, artistName }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1400);
  };

  const fetchEntries = useCallback(async () => {
    if (!artistName) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/admin/api/users/${encodeURIComponent(artistName)}/entries`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('fetch_failed');
      const json = (await res.json()) as { items: Entry[] };
      if (mountedRef.current) setEntries(json.items ?? []);
    } catch (e: unknown) {
      console.error('[admin/user-detail] fetch error:', e);
      const message = e instanceof Error ? e.message : String(e);
      if (mountedRef.current) setErr(message || '取得に失敗しました');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [artistName]);

  useEffect(() => {
    mountedRef.current = true;
    fetchEntries();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchEntries]);

  // 並び替え（クライアント）
  const sorted = useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'price':
          av = a.price == null ? Number.NEGATIVE_INFINITY : a.price;
          bv = b.price == null ? Number.NEGATIVE_INFINITY : b.price;
          break;
        case 'confirmed':
          av = a.confirmed ? 1 : 0; // null は 0 とみなす
          bv = b.confirmed ? 1 : 0;
          break;
        default:
          av = +new Date(a.created_at);
          bv = +new Date(b.created_at);
      }
      const diff = av - bv;
      return sortDir === 'asc' ? diff : -diff;
    });
    return list;
  }, [entries, sortKey, sortDir]);

  // 統計
  const stats = useMemo(() => {
    const total = entries.length;
    const confirmed = entries.filter((e) => e.confirmed === true).length;
    const sum = entries.reduce((s, e) => s + (e.price ?? 0), 0);
    return { total, confirmed, sum };
  }, [entries]);

  // CSV
  const exportCSV = () => {
    const rows = [
      ['id', 'title', 'price_yen', 'confirmed', 'created_at'],
      ...sorted.map((e) => [
        e.id,
        (e.title ?? '').replace(/"/g, '""'),
        e.price ?? '',
        e.confirmed ? 'true' : 'false',
        e.created_at,
      ]),
    ]
      .map((r) => r.map((c) => `"${String(c)}"`).join(',')) // エスケープ
      .join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `me-ish_${artistName}_entries.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSVをエクスポートしました');
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP');

  return (
    <main className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-[999] rounded bg-black/80 px-3 py-2 text-white text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-end gap-3 mb-2">
        <h1 className="text-2xl font-bold">{artistName} の応募作品</h1>
        <p className="text-sm text-gray-600">ログイン中: {adminEmail}</p>
        <span className="text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
          {stats.total} 件（承認 {stats.confirmed}）
        </span>
        <span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
          合計価格 ¥{stats.sum.toLocaleString()}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={fetchEntries} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
            再読込
          </button>
          <button onClick={exportCSV} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
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
              <th className="p-3 border w-28">価格</th>
              <th className="p-3 border w-24">承認</th>
              <th className="p-3 border w-36">応募日</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="p-3 border">{e.title ?? '（無題）'}</td>
                <td className="p-3 border">
                  {e.price != null ? `¥${e.price.toLocaleString()}` : '—'}
                </td>
                <td className="p-3 border text-center">
                  {e.confirmed ? '✅ 承認済' : '未承認'}
                </td>
                <td className="p-3 border">{fmtDate(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
