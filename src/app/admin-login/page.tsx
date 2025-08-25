'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 環境変数にカンマ区切りで許可メールを入れておく: NEXT_PUBLIC_ADMIN_EMAILS="info@me-ish.art,owner@example.com"
const allowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'info@me-ish.art')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const siteOrigin = useMemo(() => {
    // SSR対策：クライアントでのみ window がある
    if (typeof window === 'undefined') return undefined;
    return window.location.origin;
  }, []);

  const isAllowed = (email?: string | null) =>
    !!email && allowedEmails.includes(email.toLowerCase());

  const gotoAdmin = () => router.replace('/admin');

  const handleLogin = async () => {
    try {
      setMsg(null);
      setLoading(true);

      // Vercel本番/Preview/ローカル どれでも戻れるように動的originを使う
      const redirectTo = `${window.location.origin}/admin-login`; // 戻り先をこのページにして、ここで判定→/adminへ
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // 必要なら追加
          // queryParams: { prompt: 'consent', access_type: 'offline' },
        },
      });

      if (error) throw error;

      // Google同意画面に遷移するのでここから先は戻って来てから onAuthStateChange が拾う
    } catch (e: any) {
      console.error(e);
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

    // ① 初回ロード時に既にセッションがあれば判定
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email ?? null;

      if (email) {
        if (isAllowed(email)) {
          gotoAdmin();
        } else {
          // 許可外アカウントなら即ログアウトさせる
          await supabase.auth.signOut();
          if (mounted) setMsg('このアカウントは管理者ではありません');
        }
      }
    })();

    // ② OAuthコールバック後の変化を確実に拾う
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = session?.user?.email ?? null;
      if (email) {
        if (isAllowed(email)) {
          gotoAdmin();
        } else {
          await supabase.auth.signOut();
          if (mounted) setMsg('このアカウントは管理者ではありません');
        }
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        disabled={loading || !siteOrigin}
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
