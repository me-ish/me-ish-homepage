'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Entry = {
  artist_name: string | null;
  sns_links: unknown;        // ← 型ゆれ対策（JSON文字列/配列/オブジェクト/文字列の可能性）
  sale_type: string | null;
};

type UserGroup = {
  artist_name: string;
  sns_links: string[];
  entry_count: number;
  sale_types: string[];
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Supabase クライアント参照を安定化（レンダー毎に生成されない）
  const supabase = useMemo(() => supabaseBrowser(), []);

  useEffect(() => {
    const parseLinks = (raw: unknown): string[] => {
      try {
        // 1) 文字列なら JSON か URL かを判定
        if (typeof raw === 'string') {
          const s = raw.trim();
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            const parsed = JSON.parse(s);
            return parseLinks(parsed);
          }
          return s ? [s] : [];
        }
        // 2) 配列なら、文字列だけ抽出
        if (Array.isArray(raw)) {
          return raw.filter((v) => typeof v === 'string' && v.trim().length > 0) as string[];
        }
        // 3) オブジェクトなら、string値だけ拾う（{ twitter:'', instagram:'' } 想定）
        if (raw && typeof raw === 'object') {
          return Object.values(raw as Record<string, unknown>)
            .filter((v) => typeof v === 'string' && v.trim().length > 0) as string[];
        }
      } catch {
        // 失敗時は空
      }
      return [];
    };

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

      (data as Entry[]).forEach((entry) => {
        const key = (entry.artist_name ?? '未設定').trim() || '未設定';
        const links = parseLinks(entry.sns_links);
        const sale = (entry.sale_type ?? 'unknown').trim() || 'unknown';

        const existing = grouped.get(key);
        if (existing) {
          existing.entry_count += 1;
          // SNSリンク追加（重複除去）
          for (const l of links) if (!existing.sns_links.includes(l)) existing.sns_links.push(l);
          // 販売形式追加（重複除去）
          if (!existing.sale_types.includes(sale)) existing.sale_types.push(sale);
        } else {
          grouped.set(key, {
            artist_name: key,
            sns_links: [...links],
            entry_count: 1,
            sale_types: [sale],
          });
        }
      });

      // 表示しやすく並べ替え：出展数降順 → 名前昇順
      const list = Array.from(grouped.values()).sort((a, b) => {
        if (b.entry_count !== a.entry_count) return b.entry_count - a.entry_count;
        return a.artist_name.localeCompare(b.artist_name, 'ja');
      });

      setUsers(list);
      setLoading(false);
    };

    fetchUsers();
  }, [supabase]);

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
                <tr key={`${user.artist_name}-${index}`}>
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
                    <Link
                      href={`/admin/users/${encodeURIComponent(user.artist_name)}`}
                      className="text-[#00a1e9] underline font-bold hover:opacity-80"
                    >
                      詳細を見る
                    </Link>
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
