// src/app/admin-login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'info@me-ish.art')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export default function AdminLogin() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // callback から戻ったときのエラー表示
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('err') === 'unauthorized') {
        setMsg('このアカウントは管理者ではありません');
        history.replaceState(null, '', '/admin-login');
      }
    }
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const login = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` }, // ← ここへ返す
    });
    // 同意画面へ遷移するので以降は戻ってきてから
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setEmail(null);
    setMsg('ログアウトしました');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>管理者ログイン</h2>
      {msg && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#fef3c7', border: '1px solid #f59e0b', color: '#7c2d12' }}>{msg}</div>}
      {email && <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>現在ログイン中: {email}</p>}
      <button onClick={login} disabled={loading}
        style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: '#00a1e9', color: '#fff', fontWeight: 700 }}>
        Googleでログイン
      </button>
      <button onClick={logout} style={{ width: '100%', marginTop: 12, padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}>
        ログアウト
      </button>
      <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>許可メール: {allowed.join(', ')}</p>
    </div>
  );
}
