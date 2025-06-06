'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (error) {
      setMessage('ログインリンクの送信に失敗しました。');
    } else {
      setMessage('ログインリンクを送信しました。メールをご確認ください。');
    }
  };

  return (
    <main className="p-6 max-w-md mx-auto text-center">
      <h1 className="text-xl font-bold mb-4">ログイン / 新規登録</h1>
      <input
        type="email"
        placeholder="メールアドレスを入力"
        className="w-full p-2 border rounded mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="bg-[#00a1e9] text-white px-6 py-2 rounded hover:bg-[#008ec4] transition"
      >
        ログインリンクを送信
      </button>
      {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
    </main>
  );
}