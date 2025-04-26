import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom'; // リンク用に追加

export default function AdminDashboard() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('*'); // 全件取得

    if (error) {
      console.error('取得エラー:', error);
    } else {
      console.log('取得結果:', data);
      setEntries(data);
    }
  };

  const toggleApproval = async (id, isApproved) => {
    const { error } = await supabase
      .from('entries')
      .update({ is_approved: !isApproved })
      .eq('id', id);

    if (error) {
      console.error('更新エラー:', error.message);
    } else {
      fetchEntries(); // 更新後に再取得
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>管理ページ - ダッシュボード</h1>

      {/* 管理メニュー */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>管理メニュー</h2>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <Link to="/admin/users" style={{ color: '#00a1e9', textDecoration: 'underline' }}>
              ユーザー管理
            </Link>
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <Link to="/admin/entries" style={{ color: '#00a1e9', textDecoration: 'underline' }}>
              応募管理
            </Link>
          </li>
          {/* 必要ならここにさらに追加できる */}
        </ul>
      </div>

      {/* 応募作品一覧 */}
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
                backgroundColor: entry.is_approved ? '#e6ffe6' : '#fff'
              }}
            >
              <img
                src={entry.image_url}
                alt={entry.title}
                style={{ maxWidth: '150px', display: 'block', marginBottom: '0.5rem' }}
              />
              <p><strong>タイトル：</strong>{entry.title}</p>
              <p><strong>作家名：</strong>{entry.artist_name}</p>
              <p><strong>承認状態：</strong>{entry.is_approved ? '✅ 承認済' : '❌ 未承認'}</p>
              <button onClick={() => toggleApproval(entry.id, entry.is_approved)}>
                {entry.is_approved ? '非承認にする' : '承認する'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
