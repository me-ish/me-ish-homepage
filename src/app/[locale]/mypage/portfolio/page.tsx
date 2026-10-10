import { redirect } from 'next/navigation';
import { getLegacyPauseDestination } from '@/lib/legacyServiceSuspension';

export default async function PortfolioSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(getLegacyPauseDestination(`/${locale}/mypage/portfolio`, 'gallery'));
}
