// src/app/admin/entries/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Entry = {
  id: number;
  artist_name: string;
  title: string;
  image_url: string;
  confirmed: boolean;
  file_name: string;
  processed?: boolean;
  email: string;
  external_user_id: string;
  edition_total?: number | null;
  edition_sold?: number | null;
  sale_type?: string;
  gallery_type?: string;
  created_at?: string | null;
  confirmed_at?: string | null;
  display_start_at?: string | null;
  display_end_at?: string | null;
  display_plan?: string;
  display_ready?: boolean;
  is_sold?: boolean;
  meish_fee_yen?: number;
  artist_reward_yen?: number;
};

type SortKey = 'created_at' | 'confirmed_at' | 'display_start_at';
type SortOrder = 'asc' | 'desc';

export default function AdminEntriesPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    setErrMsg(null);

    try {
      // 1) エントリ取得
      let query = supabase
        .from('entries')
        .select('*')
        .order(sortKey, { ascending: sortOrder === 'asc' });

      if (selectedGallery !== 'all') query = query.eq('gallery_type', selectedGallery);
      if (onlyUnconfirmed) query = query.eq('confirmed', false);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as Entry[];

      // 2) final フォルダの一覧を一度だけ取得して Set 化
      //    （大量になりうる場合は prefix + pagination を導入）
      const { data: finalList, error: finalErr } = await supabase
        .storage
        .from('artworks')
        .list('final');

      if (finalErr) throw finalErr;
      const finalNames = new Set((finalList ?? []).map((f) => f.name));

      const withStatus = rows.map((e) => ({
        ...e,
        processed: finalNames.has(e.file_name),
      }));

      setEntries(withStatus);
    } catch (e: any) {
      console.error('[entries] fetch error:', e);
      setErrMsg(e?.message ?? '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 認可は /admin/layout.tsx でサーバー側ガード済み。ここでは純粋にデータ取得のみ。
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGallery, sortKey, sortOrder, onlyUnconfirmed]);

  // ---- utils
  const fmt = (d?: string | null) =>
    d ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '-';

  // ---- 更新（楽観的更新）
  const updateValue = async <K extends keyof Entry>(id: number, field: K, value: Entry[K]) => {
    // 楽観的更新
    const prev = entries;
    const optimistic = prev.map((e) => (e.id === id ? { ...e, [field]: value } : e));
    setEntries(optimistic);

    const { error } = await supabase.from('entries').update({ [field]: value }).eq('id', id);
    if (error) {
      console.error('[entries] update error:', error);
      setEntries(prev); // ロールバック
      setToast('更新に失敗しました');
    } else {
      setToast('保存しました');
    }
  };

  // ---- 承認 → ストレージに積んでメタ書き込み → DB 更新 → メール
  const approveEntry = async (entry: Entry) => {
    const fileName = entry.file_name.trim();
    try {
      // 1) 画像を加工待ち領域へコピー
      const copyRes = await supabase.storage.from('artworks').copy(fileName, `pending-processing/${fileName}`);
      if (copyRes.error && !copyRes.error.message.includes('already exists')) {
        throw copyRes.error;
      }

      // 2) メタ JSON
      const meta = JSON.stringify({ artistName: entry.artist_name, filename: fileName });
      const upRes = await supabase.storage
        .from('processing-meta')
        .upload(`pending/${entry.id}.json`, new Blob([meta], { type: 'application/json' }), { upsert: true });
      if (upRes.error) throw upRes.error;

      // 3) DB 承認
      const now = new Date().toISOString();
      await updateValue(entry.id, 'confirmed', true);
      await updateValue(entry.id, 'confirmed_at', now as any);

      // 4) メール（失敗しても致命ではない）
      if (entry.email && entry.external_user_id) {
        try {
          await fetch('/api/send-email/pass', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: entry.email,
              name: entry.artist_name,
              externalUserId: entry.external_user_id,
            }),
          });
        } catch (e) {
          console.warn('メール送信失敗:', e);
        }
      }

      setToast('承認し、加工キューへ投入しました');
      // 最新状態を取得し直したい場合
      // await fetchEntries();
    } catch (e: any) {
      console.error('[entries] approve error:', e);
      setToast('承認処理に失敗しました');
    }
  };

  const pendingCount = useMemo(() => entries.filter((e) => !e.confirmed).length, [entries]);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[999] rounded-lg bg-[#111]/90 text-white px-4 py-2 shadow"
             onAnimationEnd={() => setTimeout(() => setToast(null), 1400)}>
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold">応募作品の管理</h1>
        <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
          未承認 {pendingCount}
        </span>
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
          <label className="mr-2 font-medium" htmlFor="gallery-filter">ギャラリー：</label>
          <select
            id="gallery-filter"
            className="p-2 border rounded"
            value={selectedGallery}
            onChange={(e) => setSelectedGallery(e.target.value)}
          >
            <option value="all">すべて</option>
            <option value="white">White ギャラリー</option>
            <option value="float">Float ギャラリー</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="mr-2 font-medium" htmlFor="sort-key">並び順：</label>
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

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-sky-500"
            checked={onlyUnconfirmed}
            onChange={() => setOnlyUnconfirmed((v) => !v)}
          />
          <span className="font-medium">未承認のみ</span>
        </label>
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
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`border rounded-lg p-4 ${entry.confirmed ? 'bg-green-50' : 'bg-white'}`}
            >
              <div className="flex flex-col md:flex-row gap-4">
                {/* 画像 */}
                <img
                  src={entry.image_url || '/images/placeholder.png'}
                  alt={entry.title}
                  className="w-48 h-48 object-cover rounded shadow"
                />

                {/* フィールド群 */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm w-full">
                  <div><strong>タイトル：</strong>{entry.title}</div>
                  <div><strong>作家名：</strong>{entry.artist_name}</div>
                  <div><strong>ギャラリー：</strong>{entry.gallery_type ?? '-'}</div>

                  <label className="flex items-center gap-2">
                    <strong className="whitespace-nowrap">プラン：</strong>
                    <input
                      className="border p-1 w-full"
                      value={entry.display_plan || ''}
                      onChange={(e) => updateValue(entry.id, 'display_plan', e.target.value)}
                    />
                  </label>

                  <div><strong>応募日時：</strong>{fmt(entry.created_at)}</div>
                  <div><strong>承認日時：</strong>{fmt(entry.confirmed_at)}</div>

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
                      checked={entry.display_ready || false}
                      onChange={(e) => updateValue(entry.id, 'display_ready', e.target.checked as any)}
                    />
                  </label>

                  <label className="flex items-center gap-2">
                    <strong className="whitespace-nowrap">完売：</strong>
                    <input
                      type="checkbox"
                      checked={entry.is_sold || false}
                      onChange={(e) => updateValue(entry.id, 'is_sold', e.target.checked as any)}
                    />
                  </label>

                  <div className="flex items-center gap-2">
                    <strong>エディション：</strong>
                    <input
                      className="border p-1 w-16 text-right"
                      type="number"
                      value={entry.edition_total ?? 0}
                      onChange={(e) => updateValue(entry.id, 'edition_total', Number(e.target.value) as any)}
                    />
                    <span>/</span>
                    <input
                      className="border p-1 w-16 text-right"
                      type="number"
                      value={entry.edition_sold ?? 0}
                      onChange={(e) => updateValue(entry.id, 'edition_sold', Number(e.target.value) as any)}
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <strong>手数料：</strong>
                    <input
                      className="border p-1 w-24 text-right"
                      type="number"
                      value={entry.meish_fee_yen ?? 0}
                      onChange={(e) => updateValue(entry.id, 'meish_fee_yen', Number(e.target.value) as any)}
                    />
                  </label>

                  <label className="flex items-center gap-2">
                    <strong>報酬：</strong>
                    <input
                      className="border p-1 w-24 text-right"
                      type="number"
                      value={entry.artist_reward_yen ?? 0}
                      onChange={(e) => updateValue(entry.id, 'artist_reward_yen', Number(e.target.value) as any)}
                    />
                  </label>

                  <div><strong>承認：</strong>{entry.confirmed ? '✅ 承認済' : '❌ 未承認'}</div>
                  <div><strong>処理：</strong>{entry.processed ? '✅ 処理済' : '🌀 未処理'}</div>

                  <div className="col-span-2">
                    <button
                      onClick={() => approveEntry(entry)}
                      className="mt-2 px-4 py-1 bg-sky-500 text-white rounded hover:bg-sky-600"
                    >
                      {entry.confirmed ? '再承認' : '承認して加工に進む'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}


