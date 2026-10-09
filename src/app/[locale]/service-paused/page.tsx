import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Service notice | me-ish',
  robots: { index: false, follow: true },
};

export default async function ServicePausedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const [{ locale }, { service }] = await Promise.all([params, searchParams]);
  const english = locale === 'en';
  const name = service === 'aura' ? 'me-ish AURA' : service === 'card' ? 'me-ish CARD' : 'me-ish gallery';
  const prefix = english ? '/en' : '';

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16 text-[#333]">
      <div className="w-full max-w-xl space-y-6 text-center">
        <p className="text-sm font-semibold tracking-widest text-[#00a1e9]">{name}</p>
        <h1 className="text-2xl font-bold leading-relaxed">
          {english ? 'New requests are currently paused' : '新規受付を休止しています'}
        </h1>
        <p className="text-base leading-relaxed text-gray-600">
          {english
            ? 'New submissions, creation and purchases for this service are currently unavailable. Existing public pages remain available.'
            : 'このサービスの新規応募・作成・購入は現在受け付けていません。既存の公開ページは引き続きご覧いただけます。'}
        </p>
        <p className="text-sm leading-relaxed text-gray-600">
          {english
            ? 'For help with an existing order or published page, please contact us.'
            : 'ご購入済みの内容や公開済みページについては、お問い合わせください。'}
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-base">
          <Link href={`${prefix}/contact`} className="rounded-full bg-[#00a1e9] px-6 py-3 font-semibold text-white">
            {english ? 'Contact us' : 'お問い合わせ'}
          </Link>
          <Link href={prefix || '/'} className="rounded-full border border-gray-300 px-6 py-3 font-semibold">
            {english ? 'Home' : 'ホームへ'}
          </Link>
        </div>
      </div>
    </main>
  );
}
