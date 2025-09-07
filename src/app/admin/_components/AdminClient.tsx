// src/app/admin/AdminClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Props = {
  adminEmail: string;
  initialNewEntryCount: number;
  initialNewInquiryCount: number;
};

export default function AdminClient({
  adminEmail,
  initialNewEntryCount,
  initialNewInquiryCount,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [newEntryCount, setNewEntryCount] = useState(initialNewEntryCount);
  const [newInquiryCount, setNewInquiryCount] = useState(initialNewInquiryCount);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  // --- client guard（保険）
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('isAdmin') !== 'true') {
      // サーバー側で弾いているが、直接URL叩かれた場合の保険
      router.replace('/admin-login?err=unauthorized');
    }
  }, [router]);

  // --- counts fetcher
  const refreshCounts = async () => {
    setLoading(true);
    try {
      const [{ count: c1, error: e1 }, { count: c2, error: e2 }] = await Promise.all([
        supabase.from('entries').select('*', { count: 'exact', head: true }).eq('confirmed', false),
        supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false),
      ]);
      if (!mountedRef.current) return;
      if (!e1 && typeof c1 === 'number') setNewEntryCount(c1);
      if (!e2 && typeof c2 === 'number') setNewInquiryCount(c2);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // 初回 + タブ復帰/表示時にリフレッシュ
  useEffect(() => {
    mountedRef.current = true;
    refreshCounts();
    const onFocus = () => refreshCounts();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshCounts();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Realtime（新規/更新/削除でバッジ更新）
  useEffect(() => {
    const ch1 = supabase
      .channel('admin-entries-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, refreshCounts)
      .subscribe();

    const ch2 = supabase
      .channel('admin-inquiries-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, refreshCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [supabase]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') localStorage.removeItem('isAdmin');
    } finally {
      router.replace('/admin-login');
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">me-ish 管理ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600">ログイン中: {adminEmail}</p>
      </header>

      <section
        className="mb-6 flex flex-wrap items-center gap-3"
        aria-live="polite"
        aria-busy={loading}
      >
        <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-sm text-sky-700">
          未承認作品 <span className="ml-1 font-semibold">{newEntryCount}</span>
        </span>
        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700">
          未読お問い合わせ <span className="ml-1 font-semibold">{newInquiryCount}</span>
        </span>
      </section>

      <nav className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/entries"
          className="group rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">応募作品の管理</h2>
            {newEntryCount > 0 && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                新着 {newEntryCount}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            未承認の確認、展示スケジュール、販売情報の更新など
          </p>
        </Link>

        <Link
          href="/admin/inquiries"
          className="group rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">お問い合わせ一覧</h2>
            {newInquiryCount > 0 && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                新着 {newInquiryCount}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">未読の対応、スレッド管理、検索</p>
        </Link>

        <Link
          href="/admin/users"
          className="group rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <h2 className="font-semibold">出展者一覧</h2>
          <p className="mt-1 text-sm text-gray-600">出展数/SNS/販売形式の集計と詳細</p>
        </Link>

        <Link
          href="/admin/settings"
          className="group rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <h2 className="font-semibold">ギャラリー設定</h2>
          <p className="mt-1 text-sm text-gray-600">展示枠・料金・販売設定（今後実装）</p>
        </Link>
      </nav>

      <div className="mt-8">
        <button
          onClick={refreshCounts}
          className="mr-3 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          disabled={loading}
        >
          {loading ? '更新中…' : '数を更新'}
        </button>
        <button
          onClick={handleLogout}
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-300"
        >
          ログアウト
        </button>
      </div>
    </main>
  );
}
