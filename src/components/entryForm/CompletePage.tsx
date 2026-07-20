// src/app/entry/complete/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '応募送信完了 | me-ish',
  description: '応募フォームの送信完了ページです。',
  robots: { index: false, follow: false }, // ← 検索に出さない
  openGraph: {
    title: '応募送信完了 | me-ish',
    description: 'ご応募ありがとうございます。内容を確認のうえご連絡します。',
    // 画像があれば og:image を追加するとさらに良いです
  },
  // alternates: { canonical: '/entry/complete' }, // 必要なら明示
};

export default function CompletePage() {
  return (
    <main
      className="min-h-[60vh] flex items-center justify-center px-4"
      aria-labelledby="complete-title"
    >
      <div
        className="w-full max-w-[640px] bg-white p-10 rounded-2xl shadow-lg space-y-6 text-center"
        role="status"
        aria-live="polite"
      >
        {/* 装飾アイコン（任意） */}
        <div
          className="mx-auto h-14 w-14 rounded-full flex items-center justify-center bg-[#00a1e9]/10"
          aria-hidden
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M20 7L9 18l-5-5" stroke="#00a1e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 id="complete-title" className="text-2xl font-bold text-gray-900">
          送信完了！
        </h1>
        <p className="text-gray-700">ご応募ありがとうございました。</p>
        <p className="text-gray-700">
          ご記入いただいた内容を確認し、後日ご連絡いたします。
        </p>

        <div className="mt-2 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-[#00a1e9] text-white rounded-md font-semibold hover:bg-[#008ec4] transition"
          >
            me-ish ホームに戻る
          </Link>
          {/* もう一度応募ボタン（ルートに合わせて変更） */}
<Link
  href="/entry"
  className="inline-block px-6 py-2 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition"
>
  もう一度応募する
</Link>

        </div>

        <p className="text-xs text-gray-500 mt-4">
          ※ 数分以内に、送信完了メールが届かない場合は迷惑メールをご確認ください。
        </p>
      </div>
    </main>
  );
}

