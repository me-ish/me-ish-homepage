'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Props = {
  adminEmail: string;
  initialNewEntryCount: number;
  initialNewInquiryCount: number;
};

export default function AdminClient({
  adminEmail,
  initialNewEntryCount,
  initialNewInquiryCount,
}: Props) {
  const router = useRouter();
  // supabase の参照を安定化
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [newEntryCount, setNewEntryCount] = useState(initialNewEntryCount);
  const [newInquiryCount, setNewInquiryCount] = useState(initialNewInquiryCount);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [entriesRes, inquiriesRes] = await Promise.all([
        supabase.from('entries').select('*', { count: 'exact', head: true }).eq('confirmed', false),
        supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false),
      ]);

      if (!cancelled) {
        if (!entriesRes.error && typeof entriesRes.count === 'number') {
          setNewEntryCount(entriesRes.count);
        }
        if (!inquiriesRes.error && typeof inquiriesRes.count === 'number') {
          setNewInquiryCount(inquiriesRes.count);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace('/admin-login');
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <h1>me-ish 管理ダッシュボード</h1>
      <p style={{ color: '#666' }}>ログイン中: {adminEmail}</p>

      <ul style={{ marginTop: '2rem', lineHeight: 2 }}>
        <li>
          <Link href="/admin/entries" style={{ textDecoration: 'none' }}>
            {/* Link に直接中身を書けばOK */}
            応募作品の管理
            {newEntryCount > 0 && (
              <span
                style={{
                  marginLeft: '0.5em',
                  background: '#e63946',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: '0.8rem',
                }}
              >
                新着{newEntryCount}
              </span>
            )}
          </Link>
        </li>

        <li>
          <Link href="/admin/inquiries" style={{ textDecoration: 'none' }}>
            お問い合わせ一覧
            {newInquiryCount > 0 && (
              <span
                style={{
                  marginLeft: '0.5em',
                  background: '#e63946',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: '0.8rem',
                }}
              >
                新着{newInquiryCount}
              </span>
            )}
          </Link>
        </li>

        <li>
          <Link href="/admin/users" style={{ textDecoration: 'none' }}>
            ユーザー管理（今後実装予定）
          </Link>
        </li>
        <li>
          <Link href="/admin/settings" style={{ textDecoration: 'none' }}>
            ギャラリー設定（今後実装予定）
          </Link>
        </li>
      </ul>

      <button
        onClick={handleLogout}
        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', background: '#ccc', border: 'none' }}
      >
        ログアウト
      </button>
    </main>
  );
}
