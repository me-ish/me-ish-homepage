// src/app/(marketing)/contact/complete/page.tsx
import Link from 'next/link';

export const metadata = {
  title: 'お問い合わせ送信完了 | me-ish',
  description: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。',
  robots: { index: false, follow: false }, // サンクスページは noindex 推奨
};

export default function ContactCompletePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-20 text-center">
      <h1 className="mb-4 text-2xl font-bold text-[#00a1e9]">送信完了</h1>
      <p className="mb-6">
        お問い合わせありがとうございました。担当者より折り返しご連絡いたします。
      </p>
      <Link href="/" className="underline text-[#00a1e9]">
        トップページへ戻る
      </Link>
    </main>
  );
}
