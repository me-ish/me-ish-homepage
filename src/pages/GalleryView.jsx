import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './GalleryView.css'; // CSSは別ファイルに分けてもOK

export default function GalleryView() {
  const [approvedEntries, setApprovedEntries] = useState([]);

  useEffect(() => {
    fetchApproved();
  }, []);

  const fetchApproved = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('confirmed', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('取得エラー:', error.message);
    } else {
      setApprovedEntries(data);
    }
  };

  return (
    <div className="gallery-container">
      <h2>me-ish 承認済みギャラリー</h2>
      {approvedEntries.length === 0 ? (
        <p>承認済み作品はまだありません。</p>
      ) : (
        <div className="gallery-grid">
          {approvedEntries.map((entry) => (
            <div className="gallery-card" key={entry.id}>
              <img src={entry.image_url} alt={entry.title} className="gallery-image" />
              <div className="gallery-meta">
                <h3>{entry.title}</h3>
                <p>{entry.artist_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
