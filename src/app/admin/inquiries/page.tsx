// src/app/admin/inquiries/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Inquiry = {
  id: string;
  name: string | null;
  email: string | null;
  message: string | null;
  created_at: string;
  is_read: boolean;
};

export default function InquiriesPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // かんたんクライアントガード（本番はサーバー側で認可済みの想定・保険）
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('isAdmin') !== 'true') {
      router.replace('/admin-login?err=unauthorized');
    }
  }, [router]);

  // 読み込み
  const fetchInquiries = async () => {
    setLoading(true);
    try {
      let query = supabase.from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (onlyUnread) query = query.eq('is_read', false);

      const { data, error } = await query;
      if (error) throw error;

      if (mountedRef.current) setInquiries((data ?? []) as Inquiry[]);
    } catch (e) {
      console.error('読み込みエラー:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // 初回 + タブ復帰時に更新
  useEffect(() => {
    mountedRef.current = true;
    fetchInquiries();
    const onFocus = () => fetchInquiries();
    const onVisibility = () => document.visibilityState === 'visible' && fetchInquiries();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // フィルタ切り替えで再取得
  useEffect(() => {
    fetchInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyUnread]);

  // Realtime: 追加/更新/削除でリストを更新
  useEffect(() => {
    const channel = supabase
      .channel('admin-inquiries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, fetchInquiries)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const markRead = async (id: string, next = true) => {
    // 楽観更新
    setInquiries(prev => prev.map(i => (i.id === id ? { ...i, is_read: next } : i)));
    const { error } = await supabase.from('inquiries').update({ is_read: next }).eq('id', id);
    if (error) {
      console.error('更新エラー:', error.message);
      // ロールバック
      setInquiries(prev => prev.map(i => (i.id === id ? { ...i, is_read: !next } : i)));
      setToast('更新に失敗しました');
    }
  };

  const markAllRead = async () => {
    const unreadIds = inquiries.filter(i => !i.is_read).map(i => i.id);
    if (unreadIds.length === 0) {
      setToast('未読はありません');
      return;
    }
    // 楽観更新
    setInquiries(prev => prev.map(i => (i.is_read ? i : { ...i, is_read: true })));
    const { error } = await supabase.from('inquiries').update({ is_read: true }).eq('is_read', false);
    if (error) {
      console.error('一括更新エラー:', error.message);
      // ロールバック
      setInquiries(prev => prev.map(i => (unreadIds.includes(i.id) ? { ...i, is_read: false } : i)));
      setToast('一括既読に失敗しました');
    } else {
      setToast('すべて既読にしました');
    }
  };

  const filtered = inquiries.filter(i => {
    const kw = q.trim().toLowerCase();
    if (!kw) return true;
    const bag = [
      i.name ?? '',
      i.email ?? '',
      i.message ?? '',
      new Date(i.created_at).toLocaleString('ja-JP'),
    ].join(' ').toLowerCase();
    return bag.includes(kw);
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* toast */}
      {toast && (
        <div className="fixed top-3 right-3 z-[999] rounded bg-black/80 px-3 py-2 text-white text-sm">
          {toast}
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">お問い合わせ一覧</h1>
        <span className="ml-auto text-sm text-gray-600">
          {loading ? '更新中…' : `件数: ${filtered.length}/${inquiries.length}`}
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
          onClick={fetchInquiries}
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
      </section>

      {/* リスト */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">{loading ? '読み込み中…' : '問い合わせはありません。'}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((inq) => (
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
                        className="text-sky-600 underline underline-offset-2"
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
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                      ✅ 確認済み
                    </span>
                  ) : (
                    <button
                      onClick={() => markRead(inq.id, true)}
                      className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-600"
                    >
                      確認
                    </button>
                  )}
                  {inq.is_read && (
                    <button
                      onClick={() => markRead(inq.id, false)}
                      className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-gray-50"
                    >
                      未読に戻す
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
