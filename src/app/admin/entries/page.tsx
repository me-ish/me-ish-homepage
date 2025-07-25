// src/app/admin/entries/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function AdminEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'created_at' | 'confirmed_at' | 'display_start_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    if (isAdmin !== 'true') {
      alert('管理者としてログインしてください');
      router.push('/admin-login');
    } else {
      fetchEntries();
    }
  }, [selectedGallery, sortKey, sortOrder, onlyUnconfirmed]);

  const checkIfFinalExists = async (fileName: string) => {
    const { data, error } = await supabase.storage.from('artworks').list('final');
    if (error) {
      console.error('final確認エラー:', error.message);
      return false;
    }
    return data.some(f => f.name === fileName);
  };

  const fetchEntries = async () => {
    let query = supabase
      .from('entries')
      .select('*')
      .order(sortKey, { ascending: sortOrder === 'asc' });

    if (selectedGallery !== 'all') {
      query = query.eq('gallery_type', selectedGallery);
    }

    if (onlyUnconfirmed) {
      query = query.eq('confirmed', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('取得エラー:', error.message);
      return;
    }

    const entriesWithStatus = await Promise.all(
      (data || []).map(async (entry: Entry) => {
        const processed = await checkIfFinalExists(entry.file_name);
        return { ...entry, processed };
      })
    );

    setEntries(entriesWithStatus);
  };

  const updateValue = async (id: number, field: keyof Entry, value: any) => {
    const { error } = await supabase.from('entries').update({ [field]: value }).eq('id', id);
    if (error) {
      console.error('更新エラー:', error.message);
      alert('更新に失敗しました');
    } else {
      fetchEntries();
    }
  };

  const approveEntry = async (entry: Entry) => {
    const fileName = entry.file_name.trim();

    try {
      await supabase.storage.from('artworks').copy(fileName, `pending-processing/${fileName}`);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.error('コピーエラー:', e.message);
    }

    const meta = JSON.stringify({ artistName: entry.artist_name, filename: fileName });
    try {
      await supabase.storage
        .from('processing-meta')
        .upload(`pending/${entry.id}.json`, new Blob([meta], { type: 'application/json' }));
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.error('メタ保存エラー:', e.message);
    }

    await supabase.from('entries').update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    }).eq('id', entry.id);

    const finalPath = `final/${fileName}`;
    const { data: urlData } = supabase.storage.from('artworks').getPublicUrl(finalPath);
    if (urlData?.publicUrl) {
      await supabase.from('entries').update({ image_url: urlData.publicUrl }).eq('id', entry.id);
    }

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
      } catch (err) {
        console.error('📨 メール送信エラー:', err);
      }
    }

    fetchEntries();
  };

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">応募作品の管理</h1>

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="mr-2 font-medium">ギャラリーで絞り込み：</label>
          <select
            className="p-2 border rounded"
            value={selectedGallery}
            onChange={(e) => setSelectedGallery(e.target.value)}
          >
            <option value="all">すべて</option>
            <option value="white">White ギャラリー</option>
            <option value="float">Float ギャラリー</option>
          </select>
        </div>

        <div>
          <label className="mr-2 font-medium">並び順：</label>
          <select
            className="p-2 border rounded"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          >
            <option value="created_at">応募日時</option>
            <option value="confirmed_at">承認日時</option>
            <option value="display_start_at">展示開始日時</option>
          </select>
          <select
            className="ml-2 p-2 border rounded"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
          >
            <option value="desc">降順</option>
            <option value="asc">昇順</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            id="unconfirmed-only"
            type="checkbox"
            className="mr-2"
            checked={onlyUnconfirmed}
            onChange={() => setOnlyUnconfirmed(!onlyUnconfirmed)}
          />
          <label htmlFor="unconfirmed-only" className="font-medium">未承認のみ表示</label>
        </div>
      </div>

{entries.length === 0 ? (
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
            src={entry.image_url}
            alt={entry.title}
            className="w-48 h-48 object-cover rounded shadow"
          />

          {/* メタデータ編集エリア */}
 {/* メタデータ編集エリア */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm w-full">
            <div><strong>タイトル：</strong>{entry.title}</div>
            <div><strong>作家名：</strong>{entry.artist_name}</div>
            <div><strong>ギャラリー：</strong>{entry.gallery_type}</div>
            <div><strong>プラン：</strong>
              <input className="border p-1 w-full" value={entry.display_plan || ''}
                onChange={(e) => updateValue(entry.id, 'display_plan', e.target.value)} />
            </div>
            <div><strong>応募日時：</strong>{entry.created_at ? new Date(entry.created_at).toLocaleString() : '-'}</div>
            <div><strong>承認日時：</strong>{entry.confirmed_at ? new Date(entry.confirmed_at).toLocaleString() : '-'}</div>
            <div className="flex items-center gap-2">
              <strong>展示開始：</strong>
              <input type="datetime-local" className="border p-1 w-full"
                value={entry.display_start_at?.slice(0, 16) || ''}
                onChange={(e) => updateValue(entry.id, 'display_start_at', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <strong>展示終了：</strong>
              <input type="datetime-local" className="border p-1 w-full"
                value={entry.display_end_at?.slice(0, 16) || ''}
                onChange={(e) => updateValue(entry.id, 'display_end_at', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <strong>表示：</strong>
              <input type="checkbox" checked={entry.display_ready || false}
                onChange={(e) => updateValue(entry.id, 'display_ready', e.target.checked)} />
            </div>
            <div className="flex items-center gap-2">
              <strong>販売完了：</strong>
              <input type="checkbox" checked={entry.is_sold || false}
                onChange={(e) => updateValue(entry.id, 'is_sold', e.target.checked)} />
            </div>
            <div className="flex items-center gap-2">
              <strong>エディション：</strong>
              <input className="border p-1 w-16" type="number" value={entry.edition_total || 0}
                onChange={(e) => updateValue(entry.id, 'edition_total', Number(e.target.value))} /> /
              <input className="border p-1 w-16" type="number" value={entry.edition_sold || 0}
                onChange={(e) => updateValue(entry.id, 'edition_sold', Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2">
              <strong>手数料：</strong>
              <input className="border p-1 w-20" type="number" value={entry.meish_fee_yen || 0}
                onChange={(e) => updateValue(entry.id, 'meish_fee_yen', Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2">
              <strong>報酬：</strong>
              <input className="border p-1 w-20" type="number" value={entry.artist_reward_yen || 0}
                onChange={(e) => updateValue(entry.id, 'artist_reward_yen', Number(e.target.value))} />
            </div>
            <div><strong>承認状態：</strong>{entry.confirmed ? '✅ 承認済' : '❌ 未承認'}</div>
            <div><strong>処理状態：</strong>{entry.processed ? '✅ 処理済' : '🌀 未処理'}</div>
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


