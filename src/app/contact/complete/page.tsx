// app/contact/complete/page.tsx
import Link from 'next/link';

export default function ContactCompletePage() {
  return (
    <main className="min-h-screen bg-white py-20 px-6 text-center">
      <h1 className="text-2xl font-bold text-[#00a1e9] mb-4">送信完了</h1>
      <p className="mb-6">お問い合わせありがとうございました。担当者より折り返しご連絡いたします。</p>
      <Link href="/" className="text-[#00a1e9] underline">
        トップページへ戻る
      </Link>
    </main>
  );
}
