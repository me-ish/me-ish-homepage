import { redirect } from 'next/navigation';

export default async function NatoriEntryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`${locale === 'en' ? '/en' : ''}/natori/portfolio`);
}
