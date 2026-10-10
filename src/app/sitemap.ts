import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.me-ish.art';

/** hreflang alternates for a given path */
function withAlternates(path: string) {
  const url = path ? `${SITE_URL}/${path}` : SITE_URL;
  return {
    url,
    alternates: {
      languages: {
        ja: url,
        en: path ? `${SITE_URL}/en/${path}` : `${SITE_URL}/en`,
      },
    },
  };
}

// Retired gallery/AURA/CARD records must never be queried or indexed here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { ...withAlternates('natori/portfolio'), changeFrequency: 'weekly', priority: 1.0 },
    { ...withAlternates('natori/portfolio/contact'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('natori/legal/terms'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('natori/legal/privacy'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('natori/legal/tokushoho'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('contact'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('news'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('footer/terms'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('footer/privacy'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('footer/tokushoho'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('footer/faq'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('footer/copyright'), changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('footer/disclaimer'), changeFrequency: 'monthly', priority: 0.5 },
  ];
}
