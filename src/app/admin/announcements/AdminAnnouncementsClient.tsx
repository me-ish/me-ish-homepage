'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Announcement } from '@/lib/schemas/announcement';

type Props = { adminEmail: string };

type Filter = 'all' | 'public' | 'private';

type Draft = Omit<Announcement, 'id' | 'created_at' | 'updated_at'>;

const emptyDraft = (): Draft => ({
  title: '',
  body_md: '',
  category: 'info',
  pinned: false,
  link_url: null,
  published_at: null, // 未公開デフォルト
  expires_at: null,   // ★ 追加（必須プロパティ／null可）
});

function normalizeHttpUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function AdminAnnouncementsClient({ adminEmail }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<string | null>(null);

  // 新規作成用
  const [draft, setDraft] = useState(emptyDraft());

  // 行内編集用バッファ（id -> 部分更新）
  const [editBuf, setEditBuf] = useState<Record<string, Partial<Announcement>>>({});

  const mountedRef = useRef(true);
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };

  const api = useMemo(() => {
    const base = '/admin/api/announcements';
    return {
      list: async () => {
        const res = await fetch(base, { cache: 'no-store' });
        if (!res.ok) throw new Error('list_failed');
        return (await res.json()) as Announcement[];
      },
      create: async (payload: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>) => {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('create_failed');
        return (await res.json()) as Announcement;
      },
      patch: async (id: string, update: Partial<Announcement>) => {
        const res = await fetch(`${base}/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(update),
        });
        if (!res.ok) throw new Error('update_failed');
        return (await res.json()) as Announcement;
      },
      remove: async (id: string) => {
        const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete_failed');
        return true;
      },
    };
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.list();
      if (mountedRef.current) setItems(data);
    } catch (e) {
      console.error('[ann] list error', e);
      showToast('読み込みに失敗しました');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const onFocus = () => fetchAll();
    const onVis = () => document.visibilityState === 'visible' && fetchAll();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchAll]);

  const filtered = items.filter((a) => {
    const kw = q.trim().toLowerCase();
    if (kw) {
      const bag = [a.title, a.body_md ?? '', a.link_url ?? '', a.category].join(' ').toLowerCase();
      if (!bag.includes(kw)) return false;
    }
    if (filter === 'public') return !!a.published_at;
    if (filter === 'private') return !a.published_at;
    return true;
  });

  // 作成
  const createOne = async () => {
    if (!draft.title.trim()) {
      showToast('タイトルは必須です');
      return;
    }
    const payload = {
      ...draft,
      title: draft.title.trim(),
      body_md: draft.body_md ?? '',
      link_url: normalizeHttpUrl(draft.link_url),
      published_at: draft.published_at ?? null,
    };

    // 楽観追加（temp id）
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, created_at: null, updated_at: null, ...payload } as Announcement;
    setItems((prev) => [optimistic, ...prev]);

    try {
      const created = await api.create(payload);
      setItems((prev) => [created, ...prev.filter((i) => i.id !== tempId)]);
      setDraft(emptyDraft());
      showToast('作成しました');
    } catch (e) {
      console.error('[ann] create error', e);
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      showToast('作成に失敗しました');
    }
  };

  // 保存（行内編集バッファを反映）
  const saveOne = async (id: string) => {
    const before = items.find((i) => i.id === id);
    if (!before) return;
    const patch = {
      ...editBuf[id],
      link_url: normalizeHttpUrl(editBuf[id]?.link_url as string | null),
    };
    const after = { ...before, ...patch };

    setItems((prev) => prev.map((i) => (i.id === id ? (after as Announcement) : i)));

    try {
      const saved = await api.patch(id, patch);
      setItems((prev) => prev.map((i) => (i.id === id ? saved : i)));
      setEditBuf((m) => {
        const n = { ...m }; delete n[id]; return n;
      });
      showToast('保存しました');
    } catch (e) {
      console.error('[ann] update error', e);
      // ロールバック
      setItems((prev) => prev.map((i) => (i.id === id ? (before as Announcement) : i)));
      showToast('保存に失敗しました');
    }
  };

  // 公開/非公開
  const setPublish = (id: string, publish: boolean) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    setEditBuf((m) => ({ ...m, [id]: { ...(m[id] ?? {}), published_at: publish ? new Date().toISOString() : null } }));
    return saveOne(id);
  };

  // 固定トグル
  const togglePinned = (id: string) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    setEditBuf((m) => ({ ...m, [id]: { ...(m[id] ?? {}), pinned: !current.pinned } }));
    return saveOne(id);
  };

  // 削除
  const removeOne = async (id: string) => {
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.remove(id);
      showToast('削除しました');
    } catch (e) {
      console.error('[ann] delete error', e);
      setItems(before);
      showToast('削除に失敗しました');
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {toast && (
        <div className="fixed top-3 right-3 z-[999] rounded bg-black/80 px-3 py-2 text-white text-sm">
          {toast}
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">お知らせ管理</h1>
        <p className="text-sm text-gray-600">ログイン中: {adminEmail}</p>
        <span className="ml-auto text-sm text-gray-600">
          {loading ? '更新中…' : `件数: ${filtered.length}/${items.length}`}
        </span>
      </header>

      {/* 新規作成 */}
      <section className="mb-8 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">新規お知らせ</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            タイトル
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="タイトル"
            />
          </label>

          <label className="text-sm">
            カテゴリ
            <select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as Announcement['category'] }))}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="info">info</option>
              <option value="update">update</option>
              <option value="maintenance">maintenance</option>
            </select>
          </label>

          <label className="text-sm">
            リンクURL（任意）
            <input
              value={draft.link_url ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, link_url: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="https://example.com"
            />
          </label>

          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
            />
            固定表示（ピン留め）
          </label>
        </div>

        <label className="mt-3 block text-sm">
          本文（Markdown可）
          <textarea
            value={draft.body_md}
            onChange={(e) => setDraft((d) => ({ ...d, body_md: e.target.value }))}
            className="mt-1 h-36 w-full rounded border px-3 py-2"
            placeholder="本文（Markdown）"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={createOne}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            追加
          </button>
          <button
            onClick={() => setDraft(emptyDraft())}
            className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            クリア
          </button>
          <button
            onClick={fetchAll}
            className="ml-auto rounded-full border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            disabled={loading}
          >
            再読み込み
          </button>
        </div>
      </section>

      {/* ツールバー */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="タイトル・本文・URLで検索"
          className="w-72 max-w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">すべて</option>
          <option value="public">公開のみ</option>
          <option value="private">非公開のみ</option>
        </select>
      </section>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">{loading ? '読み込み中…' : 'お知らせがありません。'}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const buf = editBuf[a.id] ?? {};
            const v = { ...a, ...buf };

            return (
              <li key={a.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                {/* 行ヘッダ */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      v.category === 'update'
                        ? 'bg-emerald-100 text-emerald-700'
                        : v.category === 'maintenance'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {v.category}
                  </span>
                  {v.pinned && (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700">固定</span>
                  )}
                  <span className="ml-auto text-xs text-gray-500">
                    {v.published_at ? (
                      <>公開: {new Date(v.published_at).toLocaleString('ja-JP')}</>
                    ) : (
                      <span className="text-gray-400">非公開</span>
                    )}
                  </span>
                </div>

                {/* 編集UI */}
                <div className="mt-2 grid gap-3">
                  <input
                    value={v.title}
                    onChange={(e) =>
                      setEditBuf((m) => ({ ...m, [a.id]: { ...(m[a.id] ?? {}), title: e.target.value } }))
                    }
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                  <select
                    value={v.category}
                    onChange={(e) =>
                      setEditBuf((m) => ({ ...m, [a.id]: { ...(m[a.id] ?? {}), category: e.target.value as Announcement['category'] } }))
                    }
                    className="w-40 rounded border px-3 py-2 text-sm"
                  >
                    <option value="info">info</option>
                    <option value="update">update</option>
                    <option value="maintenance">maintenance</option>
                  </select>
                  <textarea
                    value={v.body_md ?? ''}
                    onChange={(e) =>
                      setEditBuf((m) => ({ ...m, [a.id]: { ...(m[a.id] ?? {}), body_md: e.target.value } }))
                    }
                    className="h-28 w-full rounded border px-3 py-2 text-sm"
                  />
                  <input
                    value={v.link_url ?? ''}
                    onChange={(e) =>
                      setEditBuf((m) => ({ ...m, [a.id]: { ...(m[a.id] ?? {}), link_url: e.target.value } }))
                    }
                    placeholder="https://..."
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>

                {/* アクション */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => togglePinned(a.id)}
                    className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                  >
                    {v.pinned ? '固定を外す' : '固定する'}
                  </button>

                  {v.published_at ? (
                    <button
                      onClick={() => setPublish(a.id, false)}
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                    >
                      非公開にする
                    </button>
                  ) : (
                    <button
                      onClick={() => setPublish(a.id, true)}
                      className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      今すぐ公開
                    </button>
                  )}

                  <button
                    onClick={() => saveOne(a.id)}
                    className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    変更を保存
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('削除しますか？')) removeOne(a.id);
                    }}
                    className="ml-auto rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    削除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
