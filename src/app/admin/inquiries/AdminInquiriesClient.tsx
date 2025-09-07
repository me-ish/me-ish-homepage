// src/app/admin/inquiries/AdminInquiriesClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Inquiry = {
  id: string;
  name: string | null;
  email: string | null;
  message: string | null;
  created_at: string;
  is_read: boolean;
};

type Props = { adminEmail: string };

export default function AdminInquiriesClient({ adminEmail }: Props) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // フィルタ
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [q, setQ] = useState('');

  // ページング（必要に応じて）
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const mountedRef = useRef(true);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  const api = useMemo(() => {
    return {
      list: async (params: { q: string; onlyUnread: boolean; page: number; pageSize: number }) => {
        const sp = new URLSearchParams({
          q: params.q,
          onlyUnread: String(params.onlyUnread),
          page: String(params.page),
          pageSize: String(params.pageSize),
        });
        const res = await fetch(`/admin/api/inquiries?${sp.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('list_failed');
        return (await res.json()) as { items: Inquiry[]; total: number };
      },
      patchRead: async (id: string, is_read: boolean) => {
        const res = await fetch(`/admin/api/inquiries/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ is_read }),
        });
        if (!res.ok) throw new Error('update_failed');
        return (await res.json()) as Inquiry;
      },
      markAllRead: async () => {
        const res = await fetch(`/admin/api/inquiries/mark-all-read`, { method: 'POST' });
        if (!res.ok) throw new Error('bulk_failed');
        return true;
      },
    };
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total } = await api.list({ q, onlyUnread, page, pageSize });
      if (!mountedRef.current) return;
      setItems(items);
      setTotal(total);
    } catch (e) {
      console.error('[inq] list error:', e);
      showToast('読み込みに失敗しました');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api, q, onlyUnread, page, pageSize]);

  useEffect(() => {
    mountedRef.current = true;
    fetchList();
    const onFocus = () => fetchList();
    const onVis = () => document.visibilityState === 'visible' && fetchList();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchList]);

  // フィルタ/検索変更で1ページ目に戻す
  useEffect(() => { setPage(1); }, [q, onlyUnread]);

  const markRead = async (id: string, next = true) => {
    // 楽観更新
    setItems(prev => prev.map(i => (i.id === id ? { ...i, is_read: next } : i)));
    try {
      const saved = await api.patchRead(id, next);
      setItems(prev => prev.map(i => (i.id === id ? saved : i)));
    } catch (e) {
      console.error('[inq] update error:', e);
      setItems(prev => prev.map(i => (i.id === id ? { ...i, is_read: !next } : i)));
      showToast('更新に失敗しました');
    }
  };

  const markAllRead = async () => {
    const hasUnread = items.some(i => !i.is_read);
    if (!hasUnread && onlyUnread === false) {
      showToast('未読はありません');
      return;
    }
    // 楽観更新（現在ページ分）
    setItems(prev => prev.map(i => (i.is_read ? i : { ...i, is_read: true })));
    try {
      await api.markAllRead();
      showToast('すべて既読にしました');
      fetchList();
    } catch (e) {
      showToast('一括既読に失敗しました');
      fetchList();
    }
  };

  const filteredCount = items.length; // このページ分
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {toast && (
        <div className="fixed top-3 right-3 z-[999] rounded bg-black/80 px-3 py-2 text-white text-sm">
          {toast}
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">お問い合わせ一覧</h1>
        <p className="text-sm text-gray-600">ログイン中: {adminEmail}</p>
        <span className="ml-auto text-sm text-gray-600">
          {loading ? '更新中…' : `件数: ${filteredCount} / ${total}`}
        </span>
      </header>

      {/* ツールバー */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名前・メール・本文で検索"
            className="w-72 max-w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
          />
          未読のみ表示
        </label>

        <button
          onClick={fetchList}
          className="rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          disabled={loading}
        >
          再読み込み
        </button>

        <button
          onClick={markAllRead}
          className="rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
        >
          すべて既読にする
        </button>

        {/* 簡易ページング */}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border px-2 py-1 hover:bg-gray-50"
            disabled={page === 1}
          >
            前へ
          </button>
          <span>ページ {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-2 py-1 hover:bg-gray-50"
            disabled={items.length < pageSize}
          >
            次へ
          </button>
        </div>
      </section>

      {/* リスト */}
      {items.length === 0 ? (
        <p className="text-gray-500">{loading ? '読み込み中…' : '問い合わせはありません。'}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((inq) => (
            <li
              key={inq.id}
              className={`rounded-xl border p-4 shadow-sm ${
                inq.is_read ? 'bg-gray-50' : 'bg-amber-50/50'
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-gray-900">
                      {inq.name?.trim() || '（匿名）'}
                    </strong>
                    {inq.email?.trim() && (
                      <a
                        href={`mailto:${inq.email}`}
                        className="text-sky-600 underline underline-offset-2 truncate"
                      >
                        {inq.email}
                      </a>
                    )}
                    <span className="ml-auto text-xs text-gray-500">
                      {new Date(inq.created_at).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                    {inq.message?.trim() || '（内容なし）'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {inq.is_read ? (
                    <>
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                        ✅ 確認済み
                      </span>
                      <button
                        onClick={() => markRead(inq.id, false)}
                        className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-gray-50"
                      >
                        未読に戻す
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => markRead(inq.id, true)}
                      className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-600"
                    >
                      確認
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
