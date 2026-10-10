import { redirect } from 'next/navigation';
import { getLegacyPauseDestination } from '@/lib/legacyServiceSuspension';

export default async function AuraFormPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(getLegacyPauseDestination(`/${locale}/aura/form`, 'aura'));
}
