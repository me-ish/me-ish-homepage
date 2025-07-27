'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const router = useRouter();
  const [newEntryCount, setNewEntryCount] = useState(0);
  const [newInquiryCount, setNewInquiryCount] = useState(0);

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    if (isAdmin !== 'true') {
      alert('管理者としてログインしてください');
      router.push('/admin-login');
    }

    const fetchCounts = async () => {
      const [entriesRes, inquiriesRes] = await Promise.all([
        supabase.from('entries').select('*', { count: 'exact', head: true }).eq('confirmed', false),
        supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false),
      ]);

      if (!entriesRes.error && typeof entriesRes.count === 'number') {
        setNewEntryCount(entriesRes.count);
      }
      if (!inquiriesRes.error && typeof inquiriesRes.count === 'number') {
        setNewInquiryCount(inquiriesRes.count);
      }
    };

    fetchCounts();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    router.push('/');
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1>me-ish 管理ダッシュボード</h1>
      <p>ようこそ、管理者ページへ。</p>

      <ul style={{ marginTop: '2rem', lineHeight: '2' }}>
        <li>
          <a href="/admin/entries">
            応募作品の管理
            {newEntryCount > 0 && (
              <span style={{
                marginLeft: '0.5em',
                backgroundColor: '#e63946',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '0.8rem'
              }}>
                新着{newEntryCount}
              </span>
            )}
          </a>
        </li>
        <li>
          <a href="/admin/inquiries">
            お問い合わせ一覧
            {newInquiryCount > 0 && (
              <span style={{
                marginLeft: '0.5em',
                backgroundColor: '#e63946',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '0.8rem'
              }}>
                新着{newInquiryCount}
              </span>
            )}
          </a>
        </li>
        <li><a href="/admin/users">ユーザー管理（今後実装予定）</a></li>
        <li><a href="/admin/settings">ギャラリー設定（今後実装予定）</a></li>
      </ul>

      <button
        onClick={handleLogout}
        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', backgroundColor: '#ccc', border: 'none' }}
      >
        ログアウト
      </button>
    </main>
  );
}
