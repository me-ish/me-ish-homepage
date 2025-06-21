// src/app/login/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();

const handleGoogleLogin = async () => {
  const origin = window.location.origin;
  const redirect = '/mypage'; // ← 必要に応じて変更可
  const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
  console.log('✅ redirectTo:', redirectTo);

  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });
};

  return (
    <main className="p-6 max-w-md mx-auto text-center">
      <h1 className="text-xl font-bold mb-6">ログイン</h1>
      <button
        onClick={handleGoogleLogin}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
      >
        Googleでログイン
      </button>
    </main>
  );
}