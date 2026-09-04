'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function CancelPage() {
  const t = useTranslations('pages.cancel');
  return (
    <div className="text-center py-20 px-4">
      <h1 className="text-2xl font-bold text-red-500">{t('title')}</h1>
      <p className="mt-4 text-gray-700">{t('body')}</p>

      <Link
        href="/"
        className="inline-block mt-8 px-6 py-3 bg-[#00a1e9] text-white rounded-lg font-semibold text-sm hover:bg-[#008cc5] transition"
      >
        {t('backToHome')}
      </Link>
    </div>
  );
}
