// src/app/(marketing)/contact/complete/page.tsx
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'お問い合わせ送信完了 | me-ish',
  description: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。',
  robots: { index: false, follow: false }, // サンクスページは noindex 推奨
};

export default async function ContactCompletePage() {
  const t = await getTranslations('pages.contactComplete');
  return (
    <main className="min-h-screen bg-white px-6 py-20 text-center">
      <h1 className="mb-4 text-2xl font-bold text-[#00a1e9]">{t('title')}</h1>
      <p className="mb-6">{t('body')}</p>
      <Link href="/" className="underline text-[#00a1e9]">
        {t('backToTop')}
      </Link>
    </main>
  );
}
