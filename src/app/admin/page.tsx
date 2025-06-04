'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    if (isAdmin !== 'true') {
      alert('管理者としてログインしてください');
      router.push('/admin-login');
    }
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
        <li><a href="/admin/entries">応募作品の管理</a></li>
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
