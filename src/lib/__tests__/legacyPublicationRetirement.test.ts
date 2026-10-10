import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseAdmin', () => { throw new Error('retired page must not load DB code'); });
vi.mock('@/lib/supabaseServer', () => { throw new Error('retired page must not load DB code'); });
vi.mock('@/lib/supabaseClient', () => { throw new Error('retired page must not load DB code'); });
vi.mock('@/lib/aura/aura.db', () => { throw new Error('retired page must not load DB code'); });
vi.mock('@/lib/card/card.db', () => { throw new Error('retired page must not load DB code'); });
vi.mock('@/lib/aura/studio/studioDb', () => { throw new Error('retired page must not load DB code'); });

import sitemap from '@/app/sitemap';
import HomePage from '@/app/[locale]/(marketing)/page';
import NatoriArtistPage from '@/app/[locale]/artists/natori/page';
import * as Page0 from '@/app/[locale]/float/page';
import * as Page1 from '@/app/[locale]/float/2d/page';
import * as Page2 from '@/app/[locale]/white/page';
import * as Page3 from '@/app/[locale]/white/2d/page';
import * as Page4 from '@/app/[locale]/galleries/forest/page';
import * as Page5 from '@/app/[locale]/white-install/page';
import * as Page6 from '@/app/[locale]/works/[id]/page';
import * as Page7 from '@/app/[locale]/artists/[id]/page';
import * as Page8 from '@/app/[locale]/modal/about/page';
import * as Page9 from '@/app/[locale]/modal/creators/page';
import * as Page10 from '@/app/[locale]/modal/buyers/page';
import * as Page11 from '@/app/[locale]/modal/pricing/page';
import * as Page12 from '@/app/[locale]/special-thanks/page';
import * as Page13 from '@/app/[locale]/aura/p/[public_id]/page';
import * as Page14 from '@/app/[locale]/aura/u/[slug]/page';
import * as Page15 from '@/app/[locale]/aura/preview/[id]/page';
import * as Page16 from '@/app/[locale]/aura/studio/p/[id]/page';
import * as Page17 from '@/app/[locale]/card/p/[public_id]/page';
import * as Page18 from '@/app/[locale]/card/preview/[id]/page';

const retiredPages = [
  ['float', Page0],
  ['float/2d', Page1],
  ['white', Page2],
  ['white/2d', Page3],
  ['galleries/forest', Page4],
  ['white-install', Page5],
  ['works/[id]', Page6],
  ['artists/[id]', Page7],
  ['modal/about', Page8],
  ['modal/creators', Page9],
  ['modal/buyers', Page10],
  ['modal/pricing', Page11],
  ['special-thanks', Page12],
  ['aura/p/[public_id]', Page13],
  ['aura/u/[slug]', Page14],
  ['aura/preview/[id]', Page15],
  ['aura/studio/p/[id]', Page16],
  ['card/p/[public_id]', Page17],
  ['card/preview/[id]', Page18],
] as const;

describe.each(retiredPages)('ended publication %s', (_route, page) => {
  it.each(['ja', 'en'])('shows the %s notice and support links without loading legacy data', async (locale) => {
    const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ locale }) }));
    expect(html).toContain(locale === 'en' ? 'Publication has ended' : '公開を終了しました');
    expect(html).toContain(`href="${locale === 'en' ? '/en' : ''}/natori/portfolio"`);
    expect(html).toContain(`href="${locale === 'en' ? '/en' : ''}/contact"`);
    expect(html).not.toMatch(/<canvas|<form|<img/);
    expect(page.metadata.robots).toEqual({ index: false, follow: true });
    expect(page.metadata).not.toHaveProperty('openGraph');
  });
});

it.each(['ja', 'en'])('home and old Natori artist URLs lead to the current portfolio (%s)', async (locale) => {
  const props = { params: Promise.resolve({ locale }) };
  const digest = `NEXT_REDIRECT;replace;${locale === 'en' ? '/en' : ''}/natori/portfolio;307;`;
  await expect(HomePage(props)).rejects.toMatchObject({ digest });
  await expect(NatoriArtistPage(props)).rejects.toMatchObject({ digest });
});

it('indexes the current portfolio and support pages without reading any retired table', async () => {
  const entries = await sitemap();
  const paths = entries.map((entry) => new URL(entry.url).pathname);
  expect(paths).toHaveLength(13);
  expect(paths).toContain('/natori/portfolio');
  expect(paths).toContain('/natori/portfolio/contact');
  expect(paths).toContain('/footer/privacy');
  expect(paths).toContain('/contact');
  expect(paths.some((path) => /^\/(float|white|works|artists|aura|card)(\/|$)/.test(path))).toBe(false);
  expect(entries.every((entry) => entry.alternates?.languages?.en)).toBe(true);
});
