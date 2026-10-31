import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.me-ish.art';

function pageEntry(path: string) {
  return { url: `${SITE_URL}/${path}` };
}

// Retired gallery/AURA/CARD records must never be queried or indexed here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { ...pageEntry('natori/portfolio'), changeFrequency: 'weekly', priority: 1.0 },
    { ...pageEntry('natori/legal/terms'), changeFrequency: 'monthly', priority: 0.5 },
    { ...pageEntry('natori/legal/privacy'), changeFrequency: 'monthly', priority: 0.5 },
    { ...pageEntry('natori/legal/tokushoho'), changeFrequency: 'monthly', priority: 0.5 },
  ];
}
