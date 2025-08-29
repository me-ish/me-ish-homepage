// 例: src/app/entry/complete/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '応募送信完了 | me-ish',
  description: '応募フォームの送信完了ページです。',
};

export default function CompletePage() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-[640px] bg-white p-10 rounded-2xl shadow-lg space-y-6 text-center"
        role="status"
        aria-live="polite"
      >
        <h1 className="text-2xl font-bold text-gray-800">送信完了！</h1>
        <p className="text-gray-700">ご応募ありがとうございました。</p>
        <p className="text-gray-700">ご記入いただいた内容を確認し、後日ご連絡いたします。</p>

        <Link
          href="/"
          className="inline-block mt-4 px-6 py-2 bg-[#00a1e9] text-white rounded-md font-semibold hover:bg-[#008ec4] transition"
        >
          me-ish ホームに戻る
        </Link>
      </div>
    </main>
  );
}
