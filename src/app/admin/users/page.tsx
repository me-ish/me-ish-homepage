'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Entry {
  artist_name: string;
  sns_links: string[] | string | null;
  sale_type: string;
}

interface UserGroup {
  artist_name: string;
  sns_links: string[];
  entry_count: number;
  sale_types: string[];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('artist_name, sns_links, sale_type');

      if (error) {
        console.error('Fetch error:', error);
        setLoading(false);
        return;
      }

      const grouped = new Map<string, UserGroup>();

      data.forEach((entry: Entry) => {
        const key = entry.artist_name || '未設定';

        const normalizedLinks = Array.isArray(entry.sns_links)
          ? entry.sns_links
          : entry.sns_links
          ? [entry.sns_links]
          : [];

        const existing = grouped.get(key);
        if (existing) {
          existing.entry_count += 1;
          if (!existing.sale_types.includes(entry.sale_type)) {
            existing.sale_types.push(entry.sale_type);
          }
        } else {
          grouped.set(key, {
            artist_name: key,
            sns_links: normalizedLinks,
            entry_count: 1,
            sale_types: [entry.sale_type],
          });
        }
      });

      setUsers(Array.from(grouped.values()));
      setLoading(false);
    };

    fetchUsers();
  }, []);

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">出展者一覧</h1>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500">出展者がまだいません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border">名前</th>
                <th className="p-3 border">SNSリンク</th>
                <th className="p-3 border">出展数</th>
                <th className="p-3 border">販売形式</th>
                <th className="p-3 border">詳細</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={index}>
                  <td className="p-3 border">{user.artist_name}</td>
                  <td className="p-3 border">
                    {user.sns_links.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {user.sns_links.map((link, idx) => (
                          <li key={idx}>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-400">なし</span>
                    )}
                  </td>
                  <td className="p-3 border text-center">{user.entry_count}</td>
                  <td className="p-3 border">{user.sale_types.join(', ')}</td>
                  <td className="p-3 border text-center">
                    <a
                      href={`/admin/users/${encodeURIComponent(user.artist_name)}`}
                      className="text-[#00a1e9] underline font-bold hover:opacity-80"
                    >
                      詳細を見る
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
