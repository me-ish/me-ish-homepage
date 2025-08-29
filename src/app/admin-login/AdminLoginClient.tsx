'use client';

import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AdminLoginClient({ currentEmail }: { currentEmail: string | null }) {
  const supabase = supabaseBrowser();

  const handleLogin = async () => {
    const origin = window.location.origin;

    await supabase.auth.signInWithOAuth(
      {
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=/admin`,
          queryParams: { prompt: 'select_account' },
        },
        // 型定義には無いがランタイムでは有効 → PKCE を強制
        flowType: 'pkce',
      } as any // ← もしくはこの cast でもOK
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin-login';
  };

  return (
    <div className="mx-auto max-w-md text-center space-y-4">
      {currentEmail && <p className="text-sm text-gray-600">現在のログイン: {currentEmail}</p>}
      <button onClick={handleLogin} className="w-full rounded bg-[#00a1e9] text-white py-2 font-semibold">
        Googleでログイン
      </button>
      <button onClick={handleLogout} className="w-full rounded border py-2">
        ログアウト
      </button>
    </div>
  );
}
