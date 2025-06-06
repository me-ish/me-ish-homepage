'use client';

import { supabase } from '@/lib/supabaseClient';

export default function EntryCard({ entry, refresh }: { entry: any; refresh: () => void }) {
  const approveEntry = async () => {
    const fileName = entry.file_name?.trim();
    if (!fileName) return;

    await supabase.storage.from('artworks').copy(fileName, `pending-processing/${fileName}`).catch((e) => {
      if (!e.message.includes('already exists')) console.error('コピーエラー:', e.message);
    });

    const meta = JSON.stringify({ artistName: entry.artist_name, filename: fileName });
    await supabase.storage
      .from('processing-meta')
      .upload(`pending/${entry.id}.json`, new Blob([meta], { type: 'application/json' }))
      .catch((e) => {
        if (!e.message.includes('already exists')) console.error('メタ保存エラー:', e.message);
      });

    await supabase
      .from('entries')
      .update({ confirmed: true })
      .eq('id', entry.id)
      .then(() => console.log('✅ confirmed 更新'));

    const finalPath = `final/${fileName}`;
    const { data: urlData } = supabase.storage.from('artworks').getPublicUrl(finalPath);
    if (urlData?.publicUrl) {
      await supabase.from('entries').update({ image_url: urlData.publicUrl }).eq('id', entry.id);
    }

    refresh();
  };

  return (
    <div className={`border rounded-lg p-4 ${entry.confirmed ? 'bg-green-50' : 'bg-white'}`}>
      <img src={entry.image_url} alt={entry.title} className="w-48 mb-2 rounded shadow" />
      <p><strong>タイトル：</strong>{entry.title}</p>
      <p><strong>作家名：</strong>{entry.artist_name}</p>
      <p><strong>承認状態：</strong>{entry.confirmed ? '✅ 承認済' : '❌ 未承認'}</p>
      <p><strong>処理状態：</strong>{entry.processed ? '✅ 処理済' : '🌀 未処理'}</p>
      <button
        onClick={approveEntry}
        className="mt-2 px-4 py-1 bg-sky-500 text-white rounded hover:bg-sky-600"
      >
        {entry.confirmed ? '再承認' : '承認して加工に進む'}
      </button>
    </div>
  );
}
