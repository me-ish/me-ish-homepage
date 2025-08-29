'use client';

import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AdminLoginClient({ currentEmail }: { currentEmail: string | null }) {
  const supabase = supabaseBrowser();

  const loginWithGoogle = async () => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // ここで必ず本番のコールバックに戻し、最終的に /admin-login へ戻す
        redirectTo: `${origin}/auth/callback?redirect=/admin-login`,
        queryParams: { prompt: 'consent' }, // 必要なら
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    // サーバー判定を再度通すため /admin-login をリロード
    if (typeof window !== 'undefined') window.location.href = '/admin-login';
  };

  return (
    <main className="mx-auto max-w-md p-6 text-center">
      {currentEmail && (
        <p className="mb-3 text-sm text-gray-600">現在ログイン中: {currentEmail}</p>
      )}
      <button
        onClick={loginWithGoogle}
        className="w-full rounded-lg bg-[#00a1e9] px-4 py-3 font-semibold text-white"
      >
        Googleでログイン
      </button>
      <button
        onClick={logout}
        className="mt-3 w-full rounded-lg border px-4 py-3"
      >
        ログアウト
      </button>
      {/* 確認用に許可リストを出したいときはサーバー側で描画してください（クライアントでは環境変数は出さない） */}
    </main>
  );
}

