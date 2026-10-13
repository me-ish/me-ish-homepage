import { permanentRedirect } from 'next/navigation';

// The old English portfolio page is retired. Requests go to the current
// portfolio, where pricing and the consultation form live.
export default async function NatoriRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`${locale === 'en' ? '/en' : ''}/natori/portfolio`);
}
