// src/app/admin-login/AdminLoginClient.tsx
'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Props = {
  email: string | null;
  allowed: string[];     // 画面の注記に使うだけ
  isAdmin: boolean;      // サーバーで確定済みの判定
};

export default function AdminLoginClient({ email, allowed, isAdmin }: Props) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/admin-login` },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <main className="max-w-xl mx-auto px-4 py-10 text-center">
      {email && !isAdmin && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 text-amber-700 px-4 py-3">
          このアカウントは管理者ではありません
        </div>
      )}

      {email && (
        <p className="mb-4 text-sm text-gray-600">現在ログイン中: {email}</p>
      )}

      <button
        onClick={loginWithGoogle}
        className="w-full rounded-lg bg-[#00a1e9] text-white py-3 font-semibold hover:brightness-105"
      >
        Googleでログイン
      </button>

      <button
        onClick={logout}
        className="w-full mt-3 rounded-lg border py-3 font-semibold hover:bg-gray-50"
      >
        ログアウト
      </button>

      <p className="mt-4 text-xs text-gray-500">
        許可メール: {allowed.join(', ')}
      </p>

      {isAdmin && (
        <div className="mt-6">
          <a
            href="/admin"
            className="inline-block rounded-full border px-4 py-2 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff]"
          >
            管理画面へ
          </a>
        </div>
      )}
    </main>
  );
}
