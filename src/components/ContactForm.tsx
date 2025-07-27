'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ContactForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const message = formData.get('message') as string;

    const res = await fetch('/api/send-email/send-contact', {
      method: 'POST',
      body: JSON.stringify({ name, email, message }),
    });

    if (res.ok) {
      router.push('/contact/complete'); // ✅ 完了ページへ遷移
    } else {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto text-left">
      <div>
        <label className="block mb-1 font-semibold">お名前</label>
        <input name="name" type="text" required className="w-full border px-3 py-2 rounded" />
      </div>
      <div>
        <label className="block mb-1 font-semibold">メールアドレス</label>
        <input name="email" type="email" required className="w-full border px-3 py-2 rounded" />
      </div>
      <div>
        <label className="block mb-1 font-semibold">お問い合わせ内容</label>
        <textarea name="message" required rows={6} className="w-full border px-3 py-2 rounded" />
      </div>
      <button
        type="submit"
        className="bg-[#00a1e9] text-white px-4 py-2 rounded hover:bg-[#008fcc]"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? '送信中...' : '送信'}
      </button>

      {status === 'error' && (
        <p className="text-red-600 mt-2">送信に失敗しました。時間をおいて再度お試しください。</p>
      )}
    </form>
  );
}
