// src/app/admin-login/AdminLoginClient.tsx
'use client';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AdminLoginClient({ currentEmail }: { currentEmail: string | null }) {
  const supabase = supabaseBrowser();

  const handleLogin = async () => {
    const origin = window.location.origin;

    // ★ 型の余剰プロパティチェックを回避（実行時は flowType を渡す）
    const params /*: any*/ = {
      provider: 'google' as const,
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
      flowType: 'pkce' as const, // ← 2.56+ で有効
    } as any;

    await supabase.auth.signInWithOAuth(params);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin-login';
  };

  return (
    <div className="mx-auto max-w-md text-center space-y-4">
      {currentEmail && <p className="text-sm text-gray-600">現在のログイン: {currentEmail}</p>}
      <button
        onClick={handleLogin}
        className="w-full rounded-lg bg-[#00a1e9] px-4 py-3 font-semibold text-white hover:brightness-105"
      >
        Googleでログイン
      </button>
      <button
        onClick={handleLogout}
        className="w-full rounded-lg border px-4 py-3 font-semibold hover:bg-gray-50"
      >
        ログアウト
      </button>
    </div>
  );
}
