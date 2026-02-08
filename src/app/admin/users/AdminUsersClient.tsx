// src/app/admin/users/AdminUsersClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type UserGroup = {
  artist_name: string;
  sns_links: string[];
  entry_count: number;
};

type Props = { adminEmail: string };

export default function AdminUsersClient({ adminEmail }: Props) {
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState('');
  const [minEntries, setMinEntries] = useState<number>(0);

  const mountedRef = useRef(true);
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1200);
  };

  /** 再読込（サーバーAPIから取得） */
  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/admin/api/users', { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch_failed');
      const json = (await res.json()) as { items: UserGroup[]; total: number };
      if (mountedRef.current) setUsers(json.items ?? []);
    } catch (e: unknown) {
      console.error('[admin/users] fetch error:', e);
      const message = e instanceof Error ? e.message : String(e);
      if (mountedRef.current) setErr(message || '取得に失敗しました');
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
  }, []);

  /** 表示用：フィルタリング（クライアント側） */
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return users.filter((u) => {
      if (kw && !u.artist_name.toLowerCase().includes(kw)) return false;
      if (minEntries > 0 && u.entry_count < minEntries) return false;
      return true;
    });
  }, [users, q, minEntries]);

  /** CSV 出力 */
  const exportCSV = () => {
    const rows = [
      ['artist_name', 'entry_count', 'sns_links'],
      ...filtered.map((u) => [
        u.artist_name,
        String(u.entry_count),
        u.sns_links.join('|'),
      ]),
    ]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'me-ish_users.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSVをエクスポートしました');
  };

  const linkLabel = (url: string) => {
    try {
      const u = new URL(url);
      return u.host.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[999] rounded-lg bg-[#111]/90 text-white px-4 py-2 shadow">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">出展者一覧</h1>
        <p className="text-sm text-gray-600">ログイン中: {adminEmail}</p>
        <span className="text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
          {users.length} 作家
        </span>
        <button
          onClick={refresh}
          className="ml-auto inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          aria-label="再読込"
        >
          再読込
        </button>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          CSV出力
        </button>
      </div>

      {/* フィルター */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="作家名で検索"
          className="w-[260px] px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-sky-200"
          aria-label="作家名で検索"
        />
        <label className="ml-2 text-sm">
          最小出展数：
          <input
            type="number"
            min={0}
            value={minEntries}
            onChange={(e) => setMinEntries(Number(e.target.value))}
            className="ml-2 w-20 px-2 py-1 rounded border text-right"
          />
        </label>
      </div>

      {/* 本文 */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : err ? (
        <div className="rounded-lg border bg-red-50 text-red-700 p-4">{err}</div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">該当する出展者がいません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-3 border text-left">名前</th>
                <th className="p-3 border text-left">SNSリンク</th>
                <th className="p-3 border w-24">出展数</th>
                <th className="p-3 border w-32">詳細</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, idx) => (
                <tr key={`${user.artist_name}-${idx}`} className="hover:bg-gray-50">
                  <td className="p-3 border">{user.artist_name}</td>
                  <td className="p-3 border">
                    {user.sns_links.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {user.sns_links.map((link, i2) => (
                          <li key={i2}>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                              title={link}
                            >
                              {linkLabel(link)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-400">なし</span>
                    )}
                  </td>
                  <td className="p-3 border text-center font-semibold">{user.entry_count}</td>
                  <td className="p-3 border text-center">
                    <Link
                      href={`/admin/users/${encodeURIComponent(user.artist_name)}`}
                      className="text-[#00a1e9] underline font-bold hover:opacity-80"
                    >
                      詳細を見る
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
