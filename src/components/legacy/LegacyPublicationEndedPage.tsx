import type { Metadata } from 'next';
import Link from 'next/link';
import type { LegacyService } from '@/lib/legacyServiceSuspension';

export const legacyPublicationEndedMetadata: Metadata = {
  title: '公開終了 | me-ish',
  robots: { index: false, follow: true },
};

// All legacy publications were retired by the owner on 2026-10-10.
// These pages intentionally never load saved content, assets or a DB client.
export function createLegacyPublicationEndedPage(service: LegacyService) {
  return async function LegacyPublicationEndedPage({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }) {
    const { locale } = await params;
    const english = locale === 'en';
    const prefix = english ? '/en' : '';
    const name = service === 'aura' ? 'me-ish AURA' : service === 'card' ? 'me-ish CARD' : 'me-ish gallery';

    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16 text-[#333]">
        <div className="w-full max-w-xl space-y-6 text-center">
          <p className="text-sm font-semibold tracking-widest text-[#00a1e9]">{name}</p>
          <h1 className="text-2xl font-bold leading-relaxed">
            {english ? 'Publication has ended' : '公開を終了しました'}
          </h1>
          <p className="text-base leading-relaxed text-gray-600">
            {english
              ? 'This service is no longer available. For help with an existing purchase, please contact us.'
              : 'このサービスの公開は終了しました。ご購入済みの内容については、お問い合わせください。'}
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-base">
            <Link href={`${prefix}/natori/portfolio`} className="rounded-full bg-[#00a1e9] px-6 py-3 font-semibold text-white">
              {english ? 'Atelier Natori' : 'ナトリのポートフォリオ'}
            </Link>
            <Link href={`${prefix}/contact`} className="rounded-full border border-gray-300 px-6 py-3 font-semibold">
              {english ? 'Contact us' : 'お問い合わせ'}
            </Link>
          </div>
        </div>
      </main>
    );
  };
}
