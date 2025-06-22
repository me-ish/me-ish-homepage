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
};

export default function AdminEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    if (isAdmin !== 'true') {
      alert('管理者としてログインしてください');
      router.push('/admin-login');
    } else {
      fetchEntries();
    }
  }, []);

  const checkIfFinalExists = async (fileName: string) => {
    const { data, error } = await supabase.storage.from('artworks').list('final');
    if (error) {
      console.error('final確認エラー:', error.message);
      return false;
    }
    return data.some(f => f.name === fileName);
  };

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('id, artist_name, title, image_url, confirmed, file_name, email, external_user_id, edition_total, edition_sold, sale_type'); 

    if (error) {
      console.error('取得エラー:', error.message);
      return;
    }

    const entriesWithStatus = await Promise.all(
      (data || []).map(async (entry) => {
        const processed = await checkIfFinalExists(entry.file_name);
        return { ...entry, processed };
      })
    );

    setEntries(entriesWithStatus);
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

    await supabase.from('entries').update({ confirmed: true }).eq('id', entry.id);

    const finalPath = `final/${fileName}`;
    const { data: urlData } = supabase.storage.from('artworks').getPublicUrl(finalPath);
    if (urlData?.publicUrl) {
      await supabase.from('entries').update({ image_url: urlData.publicUrl }).eq('id', entry.id);
    }

    // メール送信
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
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">応募作品の管理</h1>

      {entries.length === 0 ? (
        <p>作品がありません。</p>
      ) : (
        <div className="space-y-6">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`border rounded-lg p-4 ${entry.confirmed ? 'bg-green-50' : 'bg-white'}`}
            >
              <img
                src={entry.image_url}
                alt={entry.title}
                className="w-48 mb-2 rounded shadow"
              />
              <p><strong>タイトル：</strong>{entry.title}</p>
              <p><strong>作家名：</strong>{entry.artist_name}</p>
              <p><strong>承認状態：</strong>{entry.confirmed ? '✅ 承認済' : '❌ 未承認'}</p>
              <p><strong>処理状態：</strong>{entry.processed ? '✅ 処理済' : '🌀 未処理'}</p>
              <button
                onClick={() => approveEntry(entry)}
                className="mt-2 px-4 py-1 bg-sky-500 text-white rounded hover:bg-sky-600"
              >
                {entry.confirmed ? '再承認' : '承認して加工に進む'}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
