'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLogin() {
  const router = useRouter();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/admin`, // ログイン後にダッシュボードへ
      },
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user?.email === 'info@me-ish.art') {
        router.push('/admin');
      }
    });
  }, [router]);

  return (
    <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <h2>管理者ログイン</h2>
      <button
        onClick={handleLogin}
        style={{ width: '100%', padding: '0.5rem', backgroundColor: '#00a1e9', color: '#fff' }}
      >
        Googleでログイン
      </button>
    </div>
  );
}
