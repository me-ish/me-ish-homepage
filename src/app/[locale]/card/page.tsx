import { redirect } from 'next/navigation';
import { getLegacyPauseDestination } from '@/lib/legacyServiceSuspension';

export default async function CardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(getLegacyPauseDestination(`/${locale}/card`, 'card'));
}
