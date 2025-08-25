'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

const allowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'info@me-ish.art')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default function AdminLogin() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isAllowed = (email?: string | null) =>
    !!email && allowedEmails.includes(email.toLowerCase());

  const gotoAdmin = () => router.replace('/admin');

  const handleLogin = async () => {
    try {
      setMsg(null);
      setLoading(true);

      const redirectTo = `${window.location.origin}/admin-login`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
      // 同意画面へ遷移 → 戻ってきたら onAuthStateChange で拾う
    } catch (e: any) {
      setMsg(e?.message ?? 'ログインに失敗しました');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    setMsg('ログアウトしました');
  };

  useEffect(() => {
    let mounted = true;

    // 初回ロード：既にログイン済みなら判定
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email ?? null;
      if (!mounted) return;

      if (email) {
        if (isAllowed(email)) {
          gotoAdmin();
        } else {
          await supabase.auth.signOut();
          setMsg('このアカウントは管理者ではありません');
        }
      }
    })();

    // 以後の変化を1つだけ購読
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = session?.user?.email ?? null;
      if (!mounted) return;

      if (email) {
        if (isAllowed(email)) {
          gotoAdmin();
        } else {
          await supabase.auth.signOut();
          setMsg('このアカウントは管理者ではありません');
        }
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]); // ← 依存は supabase のみ

  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>管理者ログイン</h2>

      {msg && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            color: '#7c2d12',
            fontSize: 14,
          }}
        >
          {msg}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 10,
          backgroundColor: '#00a1e9',
          color: '#fff',
          fontWeight: 700,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '処理中…' : 'Googleでログイン'}
      </button>

      <button
        onClick={handleLogout}
        disabled={loading}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '10px 16px',
          borderRadius: 10,
          border: '1px solid #ddd',
          background: '#fff',
        }}
      >
        ログアウト
      </button>

      <p style={{ fontSize: 12, color: '#666', marginTop: 12, lineHeight: 1.6 }}>
        許可された管理者メール: {allowedEmails.join(', ')}
      </p>
    </div>
  );
}
