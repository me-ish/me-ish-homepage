'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Ann = {
  id: string;
  title: string;
  body_md: string;
  category: 'info' | 'update' | 'maintenance';
  pinned: boolean;
  link_url: string | null;
  published_at: string | null; // nullなら非公開
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyDraft = (): Ann => ({
  id: '',
  title: '',
  body_md: '',
  category: 'info',
  pinned: false,
  link_url: '',
  published_at: new Date().toISOString(),
});

export default function AdminAnnouncementsClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [items, setItems] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
  const [draft, setDraft] = useState<Ann>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (mountedRef.current) setItems((data ?? []) as Ann[]);
    } catch (e) {
      console.error('[ann] fetch error', e);
      showToast('読み込みに失敗しました');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // 初回 & Realtime
  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const ch = supabase
      .channel('announcements-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAll)
      .subscribe();
    return () => {
      mountedRef.current = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

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

  // 追加
  const createOne = async () => {
    if (!draft.title.trim()) {
      showToast('タイトルは必須です');
      return;
    }
    const payload = {
      title: draft.title.trim(),
      body_md: draft.body_md ?? '',
      category: draft.category,
      pinned: !!draft.pinned,
      link_url: draft.link_url?.trim() || null,
      published_at: draft.published_at || null,
    };

    // 楽観更新
    const tempId = `temp-${Date.now()}`;
    const optimistic: Ann = { id: tempId, ...payload } as Ann;
    setItems((prev) => [optimistic, ...prev]);

    const { data, error } = await supabase
      .from('announcements')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ann] create error', error);
      setItems((prev) => prev.filter((it) => it.id !== tempId));
      showToast('作成に失敗しました');
      return;
    }
    setItems((prev) => [data as Ann, ...prev.filter((it) => it.id !== tempId)]);
    setDraft(emptyDraft());
    showToast('作成しました');
  };

  // 更新
  const saveOne = async (id: string, next: Partial<Ann>) => {
    const before = items.find((i) => i.id === id);
    if (!before) return;

    const after: Ann = { ...before, ...next };
    setItems((prev) => prev.map((i) => (i.id === id ? after : i)));

    const { error } = await supabase
      .from('announcements')
      .update({
        title: after.title,
        body_md: after.body_md,
        category: after.category,
        pinned: after.pinned,
        link_url: after.link_url?.trim() || null,
        published_at: after.published_at,
      })
      .eq('id', id);

    if (error) {
      console.error('[ann] update error', error);
      // ロールバック
      setItems((prev) => prev.map((i) => (i.id === id ? (before as Ann) : i)));
      showToast('保存に失敗しました');
      return;
    }
    showToast('保存しました');
  };

  // 公開/非公開
  const setPublish = (id: string, publish: boolean) => {
    return saveOne(id, { published_at: publish ? new Date().toISOString() : null });
  };

  // 固定トグル
  const togglePinned = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    return saveOne(id, { pinned: !target.pinned });
  };

  // 削除
  const removeOne = async (id: string) => {
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      console.error('[ann] delete error', error);
      setItems(before);
      showToast('削除に失敗しました');
      return;
    }
    showToast('削除しました');
  };

  // UI
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {toast && (
        <div className="fixed top-3 right-3 z-[999] rounded bg-black/80 px-3 py-2 text-white text-sm">
          {toast}
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">お知らせ管理</h1>
        <span className="ml-auto text-sm text-gray-600">
          {loading ? '更新中…' : `件数: ${filtered.length}/${items.length}`}
        </span>
      </header>

      {/* 新規作成カード */}
      <section className="mb-8 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">新規お知らせ</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            タイトル
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="タイトル"
            />
          </label>

          <label className="text-sm">
            カテゴリ
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as Ann['category'] })}
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
              onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="https://example.com"
            />
          </label>

          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
            />
            固定表示（ピン留め）
          </label>
        </div>

        <label className="mt-3 block text-sm">
          本文（Markdown可）
          <textarea
            value={draft.body_md}
            onChange={(e) => setDraft({ ...draft, body_md: e.target.value })}
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
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">すべて</option>
          <option value="public">公開のみ</option>
          <option value="private">非公開のみ</option>
        </select>
        <button
          onClick={fetchAll}
          className="rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          disabled={loading}
        >
          再読み込み
        </button>
      </section>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">{loading ? '読み込み中…' : 'お知らせがありません。'}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const isEditing = editingId === a.id;
            return (
              <li key={a.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                {/* 行ヘッダ */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      a.category === 'update'
                        ? 'bg-emerald-100 text-emerald-700'
                        : a.category === 'maintenance'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {a.category}
                  </span>
                  {a.pinned && (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700">固定</span>
                  )}
                  <span className="ml-auto text-xs text-gray-500">
                    {a.published_at ? (
                      <>公開: {new Date(a.published_at).toLocaleString('ja-JP')}</>
                    ) : (
                      <span className="text-gray-400">非公開</span>
                    )}
                  </span>
                </div>

                {/* タイトル/本文 */}
                {!isEditing ? (
                  <>
                    <h3 className="mt-1 text-base font-semibold">{a.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                      {a.body_md}
                    </p>
                    {a.link_url && (
                      <a
                        href={a.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-sm text-sky-600 underline"
                      >
                        {a.link_url}
                      </a>
                    )}
                  </>
                ) : (
                  <div className="mt-2 grid gap-3">
                    <input
                      value={a.title}
                      onChange={(e) => saveOne(a.id, { title: e.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                    <select
                      value={a.category}
                      onChange={(e) =>
                        saveOne(a.id, { category: e.target.value as Ann['category'] })
                      }
                      className="w-40 rounded border px-3 py-2 text-sm"
                    >
                      <option value="info">info</option>
                      <option value="update">update</option>
                      <option value="maintenance">maintenance</option>
                    </select>
                    <textarea
                      value={a.body_md}
                      onChange={(e) => saveOne(a.id, { body_md: e.target.value })}
                      className="h-28 w-full rounded border px-3 py-2 text-sm"
                    />
                    <input
                      value={a.link_url ?? ''}
                      onChange={(e) => saveOne(a.id, { link_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {/* アクション */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => togglePinned(a.id)}
                    className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                  >
                    {a.pinned ? '固定を外す' : '固定する'}
                  </button>
                  {a.published_at ? (
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
                    onClick={() => setEditingId(isEditing ? null : a.id)}
                    className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                  >
                    {isEditing ? '編集を終了' : '編集'}
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
