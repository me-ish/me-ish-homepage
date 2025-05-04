import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetchEntries();
  }, []);

  // 🔍 finalフォルダに画像があるか確認
  const checkIfFinalExists = async (fileName) => {
    const { data, error } = await supabase.storage
      .from('artworks')
      .list('final');

    if (error) {
      console.error(`finalフォルダ確認エラー（${fileName}）:`, error.message);
      return false;
    }

    return data.some(f => f.name === fileName);
  };

  // 📥 作品データの取得と processed 状態の付与
  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('id, artist_name, title, image_url, confirmed, file_name');

    if (error) {
      console.error('取得エラー:', error);
      return;
    }

    const entriesWithProcessed = await Promise.all(
      data.map(async (entry) => {
        const processed = await checkIfFinalExists(entry.file_name);
        return { ...entry, processed };
      })
    );

    setEntries(entriesWithProcessed);
  };

  // ✅ 承認処理
  const approveEntry = async (entry) => {
    console.log('========== 承認処理スタート ==========');
    const fileName = entry.file_name?.trim();
    if (!fileName) {
      console.error('file_name が entries に存在しません');
      return;
    }
  
    // ✅ artworks直下にファイルがあるか確認
    const { data: fileList, error: listError } = await supabase.storage
      .from('artworks')
      .list('', { limit: 100 });
  
    if (listError) {
      console.error('ストレージ一覧取得エラー:', listError.message);
    }
  
    const found = fileList?.some(f => f.name === fileName);
    if (!found) {
      console.warn('⚠️ artworks直下にファイルが存在しません');
    }
  
    // ✅ コピー処理（既に存在していたらスキップ）
    const { error: copyError } = await supabase.storage
      .from('artworks')
      .copy(fileName, `pending-processing/${fileName}`);
  
    if (copyError) {
      if (copyError.message === 'The resource already exists') {
        console.warn('⚠️ コピー先に既に存在するためスキップ');
      } else {
        console.error('❌ ストレージコピーエラー:', copyError.message);
        return;
      }
    }
  
    // ✅ メタ情報保存（既に存在していたらスキップ）
    const meta = JSON.stringify({ artistName: entry.artist_name, filename: fileName });
    const { error: metaError } = await supabase.storage
      .from('processing-meta')
      .upload(`pending/${entry.id}.json`, new Blob([meta], { type: 'application/json' }));
  
    if (metaError) {
      if (metaError.message === 'The resource already exists') {
        console.warn('⚠️ メタ情報は既に存在するためスキップ');
      } else {
        console.error('メタ情報保存エラー:', metaError.message);
        return;
      }
    }
  
    // ✅ confirmed を true に更新
    const { error: updateError } = await supabase
      .from('entries')
      .update({ confirmed: true })
      .eq('id', entry.id);
  
    if (updateError) {
      console.error('DB更新エラー:', updateError.message);
      return;
    }
  
    // ✅ final画像が存在すれば image_url を上書き
    const finalPath = `final/${fileName}`;
    const { data: publicUrlData, error: publicUrlError } = supabase.storage
      .from('artworks')
      .getPublicUrl(finalPath);
  
    if (publicUrlError) {
      console.error('final画像のURL取得エラー:', publicUrlError.message);
    } else if (publicUrlData?.publicUrl) {
      const { error: imageUrlUpdateError } = await supabase
        .from('entries')
        .update({ image_url: publicUrlData.publicUrl })
        .eq('id', entry.id);
  
      if (imageUrlUpdateError) {
        console.error('image_url の更新エラー:', imageUrlUpdateError.message);
      } else {
        console.log('✅ image_url を final画像に更新しました');
      }
    }
  
    // ✅ 一覧を再取得
    fetchEntries();
  };
  

  return (
    <div style={{ padding: '2rem' }}>
      <h1>管理ページ - ダッシュボード</h1>

      <div style={{ marginBottom: '2rem' }}>
        <h2>管理メニュー</h2>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          <li><Link to="/admin/users" style={{ color: '#00a1e9' }}>ユーザー管理</Link></li>
          <li><Link to="/admin/entries" style={{ color: '#00a1e9' }}>応募管理</Link></li>
        </ul>
      </div>

      <div>
        <h2>応募作品一覧</h2>
        {entries.length === 0 ? (
          <p>作品がありません</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: entry.confirmed ? '#e6ffe6' : '#fff',
              }}
            >
              <img
                src={entry.image_url}
                alt={entry.title}
                style={{ maxWidth: '150px', display: 'block', marginBottom: '0.5rem' }}
              />
              <p><strong>タイトル：</strong>{entry.title}</p>
              <p><strong>作家名：</strong>{entry.artist_name}</p>
              <p><strong>承認状態：</strong>{entry.confirmed ? '✅ 承認済' : '❌ 未承認'}</p>
              <p><strong>処理状態：</strong>{entry.processed ? '✅ 処理済' : '🌀 未処理'}</p>
              <button onClick={() => approveEntry(entry)}>
                {entry.confirmed ? '再承認する' : '承認して加工に進む'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
