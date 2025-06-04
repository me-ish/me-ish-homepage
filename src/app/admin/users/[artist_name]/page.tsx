'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

interface Entry {
  id: string;
  title: string;
  sale_type: string;
  price: number | null;
  confirmed: boolean;
  created_at: string;
}

export default function AdminUserDetailPage() {
  const { artist_name } = useParams();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('artist_name', artist_name);

      if (error) {
        console.error('Fetch error:', error);
        setLoading(false);
        return;
      }

      setEntries(data);
      setLoading(false);
    };

    fetchEntries();
  }, [artist_name]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{decodeURIComponent(String(artist_name))} の応募作品</h1>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">この作家の応募作品はまだありません。</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border">タイトル</th>
              <th className="p-3 border">販売形式</th>
              <th className="p-3 border">価格</th>
              <th className="p-3 border">承認</th>
              <th className="p-3 border">応募日</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="p-3 border">{entry.title}</td>
                <td className="p-3 border">{entry.sale_type}</td>
                <td className="p-3 border">{entry.price ? `¥${entry.price.toLocaleString()}` : '—'}</td>
                <td className="p-3 border text-center">
                  {entry.confirmed ? '✅' : '未承認'}
                </td>
                <td className="p-3 border">{new Date(entry.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
