// src/app/admin/entries/AdminEntriesClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Entry = {
  id: number;
  artist_name: string;
  title: string;
  image_url: string;
  confirmed: boolean | null; // 三値
  file_name: string;
  processed?: boolean;
  email: string;
  external_user_id: string;

  edition_total?: number | null;
  edition_sold?: number | null;
  sale_type?: string | null;
  gallery_type?: string | null;

  // タイムスタンプ
  created_at?: string | null;
  confirmed_at?: string | null;
  display_start_at?: string | null;
  display_end_at?: string | null;

  // 表示プラン・フラグ類
  display_plan?: string | null;
  display_ready?: boolean | null;
  is_sold?: boolean | null;

  // 金額
  meish_fee_yen?: number | null;
  artist_reward_yen?: number | null;

  // 却下監査
  rejected_at?: string | null;
  reject_reason?: string | null;
  reject_email_sent_at?: string | null;
};

type SortKey = 'created_at' | 'confirmed_at' | 'display_start_at';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'unreviewed' | 'approved' | 'rejected';

type Props = { adminEmail: string };

export default function AdminEntriesClient({ adminEmail }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // フィルタ／並び
  const [selectedGallery, setSelectedGallery] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [keyword, setKeyword] = useState<string>('');

  const mountedRef = useRef(true);
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1600);
  };

  // =========================
  // API クライアント
  // =========================
  const api = useMemo(() => {
    return {
      list: async () => {
        const sp = new URLSearchParams({
          gallery: selectedGallery,
          status: statusFilter,
          sortKey,
          sortOrder,
          keyword,
        });
        const res = await fetch(`/admin/api/entries?${sp.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('list_failed');
        return (await res.json()) as Entry[];
      },
      patch: async (id: number, patch: Partial<Entry>) => {
        const res = await fetch(`/admin/api/entries/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error('update_failed');
        return (await res.json()) as Entry;
      },
      approve: async (e: Entry) => {
        const res = await fetch(`/admin/api/entries/${e.id}/approve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error('approve_failed');
        return (await res.json()) as Entry;
      },
      reject: async (e: Entry, reason: string | null) => {
        const res = await fetch(`/admin/api/entries/${e.id}/reject`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error('reject_failed');
        return (await res.json()) as Entry;
      },
      reset: async (e: Entry) => {
        const res = await fetch(`/admin/api/entries/${e.id}/reset`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error('reset_failed');
        return (await res.json()) as Entry;
      },
    };
  }, [selectedGallery, statusFilter, sortKey, sortOrder, keyword]);

  // =========================
  // 取得
  // =========================
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const data = await api.list();
      if (mountedRef.current) setEntries(data);
    } catch (e: any) {
      console.error('[entries] fetch error:', e);
      setErrMsg(e?.message ?? '取得に失敗しました');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    mountedRef.current = true;
    fetchEntries();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchEntries]);

  // =========================
  // util
  // =========================
  const fmt = (d?: string | null) =>
    d ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '-';

  const badge = (status: 'unreviewed' | 'approved' | 'rejected') => {
    const map = {
      unreviewed: 'bg-gray-100 text-gray-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    } as const;
    return `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`;
  };

  // =========================
  // 更新（1フィールド／複数フィールド）
  // =========================
  const updateValue = async <K extends keyof Entry>(id: number, field: K, value: Entry[K]) => {
    const before = entries.find((e) => e.id === id);
    if (!before) return;

    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    try {
      const saved = await api.patch(id, { [field]: value } as any);
      setEntries((prev) => prev.map((e) => (e.id === id ? saved : e)));
      showToast('保存しました');
    } catch (error) {
      console.error('[entries] update error:', error);
      setEntries((prev) => prev.map((e) => (e.id === id ? (before as Entry) : e)));
      showToast('更新に失敗しました');
    }
  };

  const updateFields = async (id: number, patch: Partial<Entry>) => {
    const before = entries.find((e) => e.id === id);
    if (!before) return;

    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    try {
      const saved = await api.patch(id, patch);
      setEntries((prev) => prev.map((e) => (e.id === id ? saved : e)));
      showToast('保存しました');
    } catch (error) {
      console.error('[entries] updateFields error:', error);
      setEntries((prev) => prev.map((e) => (e.id === id ? (before as Entry) : e)));
      showToast('更新に失敗しました');
      throw error;
    }
  };

  // =========================
  // アクション：承認/却下/未審査へ
  // =========================
  const approveEntry = async (entry: Entry) => {
    try {
      const saved = await api.approve(entry);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? saved : e)));
      showToast('承認し、加工キューへ投入しました');
    } catch (e) {
      console.error('[entries] approve error:', e);
      showToast('承認処理に失敗しました');
    }
  };

  const rejectEntry = async (entry: Entry) => {
    try {
      const reason = window.prompt('不採用理由（任意）を入力してください（空欄可）') || null;
      const saved = await api.reject(entry, reason);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? saved : e)));
      showToast('却下しました');
    } catch (e) {
      console.error('[entries] reject error:', e);
      showToast('却下処理に失敗しました');
    }
  };

  const resetReview = async (entry: Entry) => {
    try {
      const saved = await api.reset(entry);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? saved : e)));
      showToast('未審査に戻しました');
    } catch (e) {
      console.error('[entries] reset error:', e);
      // handled
    }
  };

  // =========================
  // 集計
  // =========================
  const count = useMemo(
    () => ({
      unreviewed: entries.filter((e) => e.confirmed === null).length,
      approved: entries.filter((e) => e.confirmed === true).length,
      rejected: entries.filter((e) => e.confirmed === false).length,
    }),
    [entries]
  );

  // =========================
  // UI
  // =========================
  return (
    <main className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[999] rounded-lg bg-[#111]/90 text-white px-4 py-2 shadow">
          {toast}
        </div>
      )}

      {/* ヘッダ */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h1 className="text-2xl font-bold">応募作品の管理</h1>
        <p className="text-sm text-gray-600">ログイン中: {adminEmail}</p>
        <span className={badge('unreviewed')}>未審査 {count.unreviewed}</span>
        <span className={badge('approved')}>承認 {count.approved}</span>
        <span className={badge('rejected')}>却下 {count.rejected}</span>
        <button
          onClick={fetchEntries}
          className="ml-auto inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          aria-label="再読込"
        >
          再読込
        </button>
      </div>

      {/* フィルターバー */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="mr-2 font-medium" htmlFor="gallery-filter">
            ギャラリー：
          </label>
          <select
            id="gallery-filter"
            className="p-2 border rounded"
            value={selectedGallery}
            onChange={(e) => setSelectedGallery(e.target.value)}
          >
            <option value="all">すべて</option>
            <option value="white">White ギャラリー</option>
            <option value="float">Float ギャラリー</option>
            <option value="special">Special</option>
          </select>
        </div>

        <div>
          <label className="mr-2 font-medium" htmlFor="status-filter">
            審査状態：
          </label>
          <select
            id="status-filter"
            className="p-2 border rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">すべて</option>
            <option value="unreviewed">未審査</option>
            <option value="approved">承認</option>
            <option value="rejected">却下</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="mr-2 font-medium" htmlFor="sort-key">
            並び順：
          </label>
          <select
            id="sort-key"
            className="p-2 border rounded"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="created_at">応募日時</option>
            <option value="confirmed_at">承認日時</option>
            <option value="display_start_at">展示開始日時</option>
          </select>
          <select
            className="ml-2 p-2 border rounded"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          >
            <option value="desc">降順</option>
            <option value="asc">昇順</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-medium" htmlFor="kw">
            検索：
          </label>
          <input
            id="kw"
            className="p-2 border rounded w-64"
            placeholder="タイトル / 作家名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* 本文 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : errMsg ? (
        <div className="rounded-lg border bg-red-50 text-red-700 p-4">{errMsg}</div>
      ) : entries.length === 0 ? (
        <p>作品がありません。</p>
      ) : (
        <div className="space-y-6">
          {entries.map((entry) => {
            const status =
              entry.confirmed === true ? 'approved' : entry.confirmed === false ? 'rejected' : 'unreviewed';
            return (
              <div
                key={entry.id}
                className={`border rounded-lg p-4 ${
                  status === 'approved' ? 'bg-green-50' : status === 'rejected' ? 'bg-red-50/40' : 'bg-white'
                }`}
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* 画像 */}
                  <a href={entry.image_url || '#'} target="_blank" rel="noreferrer" className="shrink-0">
                    <img
                      src={entry.image_url || '/images/placeholder.png'}
                      alt={entry.title}
                      className="w-48 h-48 object-cover rounded shadow hover:opacity-90"
                    />
                  </a>

                  {/* フィールド群 */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm w-full">
                    <div>
                      <strong>ID：</strong>
                      {entry.id}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">状態：</span>
                      <span className={badge(status as any)}>
                        {status === 'approved' ? '承認' : status === 'rejected' ? '却下' : '未審査'}
                      </span>
                    </div>

                    <div>
                      <strong>タイトル：</strong>
                      {entry.title}
                    </div>
                    <div>
                      <strong>作家名：</strong>
                      {entry.artist_name}
                    </div>

                    <div>
                      <strong>ギャラリー：</strong>
                      {entry.gallery_type ?? '-'}
                    </div>
                    <div>
                      <strong>応募日時：</strong>
                      {fmt(entry.created_at)}
                    </div>
                    <div>
                      <strong>承認日時：</strong>
                      {fmt(entry.confirmed_at)}
                    </div>

                    <label className="flex items-center gap-2">
                      <strong className="whitespace-nowrap">プラン：</strong>
                      <input
                        className="border p-1 w-full"
                        value={entry.display_plan || ''}
                        onChange={(e) => updateValue(entry.id, 'display_plan', e.target.value)}
                      />
                    </label>

                    <label className="flex items-center gap-2">
                      <strong className="whitespace-nowrap">展示開始：</strong>
                      <input
                        type="datetime-local"
                        className="border p-1 w-full"
                        value={entry.display_start_at?.slice(0, 16) || ''}
                        onChange={(e) => updateValue(entry.id, 'display_start_at', e.target.value as any)}
                      />
                    </label>

                    <label className="flex items-center gap-2">
                      <strong className="whitespace-nowrap">展示終了：</strong>
                      <input
                        type="datetime-local"
                        className="border p-1 w-full"
                        value={entry.display_end_at?.slice(0, 16) || ''}
                        onChange={(e) => updateValue(entry.id, 'display_end_at', e.target.value as any)}
                      />
                    </label>

                    <label className="flex items-center gap-2">
                      <strong className="whitespace-nowrap">ギャラリー表示：</strong>
                      <input
                        type="checkbox"
                        checked={!!entry.display_ready}
                        onChange={(e) => updateValue(entry.id, 'display_ready', e.target.checked as any)}
                      />
                    </label>

                    <label className="flex items-center gap-2">
                      <strong className="whitespace-nowrap">完売：</strong>
                      <input
                        type="checkbox"
                        checked={!!entry.is_sold}
                        onChange={(e) => updateValue(entry.id, 'is_sold', e.target.checked as any)}
                      />
                    </label>

                    <div className="flex items-center gap-2">
                      <strong>エディション：</strong>
                      <input
                        className="border p-1 w-16 text-right"
                        type="number"
                        value={entry.edition_total ?? 0}
                        onChange={(e) =>
                          updateValue(entry.id, 'edition_total', Number(e.target.value) as any)
                        }
                      />
                      <span>/</span>
                      <input
                        className="border p-1 w-16 text-right"
                        type="number"
                        value={entry.edition_sold ?? 0}
                        onChange={(e) =>
                          updateValue(entry.id, 'edition_sold', Number(e.target.value) as any)
                        }
                      />
                    </div>

                    <label className="flex items-center gap-2">
                      <strong>手数料：</strong>
                      <input
                        className="border p-1 w-24 text-right"
                        type="number"
                        value={entry.meish_fee_yen ?? 0}
                        onChange={(e) =>
                          updateValue(entry.id, 'meish_fee_yen', Number(e.target.value) as any)
                        }
                      />
                    </label>

                    <label className="flex items-center gap-2">
                      <strong>報酬：</strong>
                      <input
                        className="border p-1 w-24 text-right"
                        type="number"
                        value={entry.artist_reward_yen ?? 0}
                        onChange={(e) =>
                          updateValue(entry.id, 'artist_reward_yen', Number(e.target.value) as any)
                        }
                      />
                    </label>

                    <div>
                      <strong>処理：</strong>
                      {entry.processed ? '✅ 処理済' : '🌀 未処理'}
                    </div>

                    {/* アクション */}
                    <div className="col-span-2 flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => approveEntry(entry)}
                        className="px-4 py-1 bg-sky-600 text-white rounded hover:bg-sky-700"
                      >
                        {entry.confirmed ? '再承認' : '承認して加工に進む'}
                      </button>
                      <button
                        onClick={() => rejectEntry(entry)}
                        className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        却下
                      </button>
                      {entry.confirmed !== null && (
                        <button
                          onClick={() => resetReview(entry)}
                          className="px-3 py-1 border rounded hover:bg-gray-50"
                          title="審査状態を未審査に戻す"
                        >
                          取り消し（未審査へ）
                        </button>
                      )}
                      {entry.email && (
                        <a className="px-3 py-1 border rounded hover:bg-gray-50" href={`mailto:${entry.email}`}>
                          作家にメール
                        </a>
                      )}
                      <button
                        onClick={fetchEntries}
                        className="ml-auto inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        最新の状態を取得
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
