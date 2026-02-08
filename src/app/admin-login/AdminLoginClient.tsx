// app/admin-login/AdminLoginClient.tsx
'use client';

import { useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AdminLoginClient({ currentEmail }: { currentEmail: string | null }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [busy, setBusy] = useState<'login' | 'logout' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // /admin-login?next=/admin などを許可（サイト内パスのみ）
  const getSafeNextPath = () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const n = sp.get('next') || '/admin';
      return n.startsWith('/') ? n : '/admin';
    } catch {
      return '/admin';
    }
  };

  const handleLogin = async () => {
    setErr(null);
    setBusy('login');
    try {
      const origin = window.location.origin;
      const nextPath = getSafeNextPath();

      await supabase.auth.signInWithOAuth(
        {
          provider: 'google',
          options: {
            redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            queryParams: {
              prompt: 'select_account',
              // 必要なら Google Workspace 制限：
              // hd: 'your-domain.example',
            },
          },
          // 型にはないがランタイム有効。PKCE を強制。
          flowType: 'pkce',
        } as any
      );
      // 以降はリダイレクト制御に移る（通常ここまでにブラウザ遷移）
    } catch (e: unknown) {
      console.error('[admin-login] signIn error:', e);
      const message = e instanceof Error ? e.message : String(e);
      setErr(message || 'ログインに失敗しました');
      setBusy(null);
    }
  };

  const handleLogout = async () => {
    setErr(null);
    setBusy('logout');
    try {
      await supabase.auth.signOut();
      // 戻るボタンでセッションページに戻れないように replace
      window.location.replace('/admin-login');
    } catch (e: unknown) {
      console.error('[admin-login] signOut error:', e);
      const message = e instanceof Error ? e.message : String(e);
      setErr(message || 'ログアウトに失敗しました');
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-md text-center space-y-4" aria-busy={busy !== null}>
      {currentEmail && <p className="text-sm text-gray-600">現在のログイン: {currentEmail}</p>}
      {err && <p className="text-sm text-rose-600">{err}</p>}

      <button
        onClick={handleLogin}
        disabled={busy !== null}
        className="w-full rounded bg-[#00a1e9] text-white py-2 font-semibold disabled:opacity-60"
      >
        {busy === 'login' ? 'リダイレクト中…' : 'Googleでログイン'}
      </button>

      <button
        onClick={handleLogout}
        disabled={busy !== null}
        className="w-full rounded border py-2 disabled:opacity-60"
      >
        {busy === 'logout' ? 'ログアウト中…' : 'ログアウト'}
      </button>
    </div>
  );
}
