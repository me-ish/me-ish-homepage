'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'info@me-ish.art')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export default function AdminLogin() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ★ これで「同じレンダー中に複数回 replace する」のを防ぎます
  const navigating = useRef(false);
  const handled = useRef(false);

  const isAllowed = (email?: string | null) =>
    !!email && allowed.includes(email.toLowerCase());

  const safeGoAdmin = () => {
    if (navigating.current) return;
    navigating.current = true;
    router.replace('/admin');
  };

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
      // ← Google同意画面へ遷移
    } catch (e: any) {
      setMsg(e?.message ?? 'ログインに失敗しました');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMsg('ログアウトしました');
  };

  useEffect(() => {
    let active = true;

    // 初回：既セッションの判定
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const email = data.session?.user?.email ?? null;
      // ★ 一度だけ判定。未ログインなら何もしない（ここでログアウトさせない）
      if (email && isAllowed(email)) {
        safeGoAdmin();
      } else if (email && !isAllowed(email)) {
        // 許可外はサインアウトだけ。/admin-login に留める（ループしない）
        await supabase.auth.signOut();
        setMsg('このアカウントは管理者ではありません');
      }
      handled.current = true;
    })();

    // 以降の変化（Googleから戻ってきた時など）
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (!active) return;

      const email = session?.user?.email ?? null;
      // ★ すでにハンドリング済みで同じ条件なら何もしない（ループ防止）
      if (!email) return;
      if (isAllowed(email)) {
        safeGoAdmin();
      } else {
        await supabase.auth.signOut();
        setMsg('このアカウントは管理者ではありません');
      }
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>管理者ログイン</h2>

      {msg && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 8,
          background: '#fef3c7', border: '1px solid #f59e0b', color: '#7c2d12', fontSize: 14
        }}>
          {msg}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{ width: '100%', padding: '12px 16px', borderRadius: 10,
          backgroundColor: '#00a1e9', color: '#fff', fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
        {loading ? '処理中…' : 'Googleでログイン'}
      </button>

      <button
        onClick={handleLogout}
        disabled={loading}
        style={{ width: '100%', marginTop: 12, padding: '10px 16px', borderRadius: 10,
          border: '1px solid #ddd', background: '#fff' }}>
        ログアウト
      </button>

      <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>
        許可メール: {allowed.join(', ')}
      </p>
    </div>
  );
}
