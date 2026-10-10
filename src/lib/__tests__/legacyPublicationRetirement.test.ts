import { isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), row: vi.fn(), auraRequest: vi.fn(), cardRequest: vi.fn(),
}));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: () => ({ from: mocks.from }) }));
vi.mock('@/lib/aura/aura.db', () => ({ findRequest: mocks.auraRequest }));
vi.mock('@/lib/card/card.db', () => ({ findCardRequest: mocks.cardRequest }));
vi.mock('@/components/aura/renderer/RendererRouter', () => ({ RendererRouter: () => null }));
vi.mock('@/components/card/renderer/CardRenderer', () => ({ default: () => null }));
vi.mock('@/components/aura/AuraPreviewShellClient', () => ({ default: () => null }));
vi.mock('@/components/card/CardPreviewShellClient', () => ({ default: () => null }));
vi.mock('@/app/[locale]/aura/preview/[id]/PreviewWaitClient', () => ({ default: () => null }));
vi.mock('@/components/card/CardPreviewWaitClient', () => ({ default: () => null }));

import AuraPage, { generateMetadata as auraMetadata } from '@/app/[locale]/aura/p/[public_id]/page';
import CardPage, { generateMetadata as cardMetadata } from '@/app/[locale]/card/p/[public_id]/page';
import AuraSlug from '@/app/[locale]/aura/u/[slug]/page';
import AuraPreview from '@/app/[locale]/aura/preview/[id]/page';
import CardPreview from '@/app/[locale]/card/preview/[id]/page';
import sitemap from '@/app/sitemap';
import { isRetiredLegacyPublication } from '@/lib/legacyPublicationRetirement';

const publications = [
  { service: 'aura', id: '4d6395d7-1e01-4ae5-9d28-15dd51cd8643', slug: 'portfolio',
    page: AuraPage, metadata: auraMetadata, preview: AuraPreview, request: mocks.auraRequest },
  { service: 'aura', id: 'ed4567ef-877b-4bd2-ae4e-32cdca68bf37', slug: 'portfolio-2',
    page: AuraPage, metadata: auraMetadata, preview: AuraPreview, request: mocks.auraRequest },
  { service: 'card', id: '070a68ba-11a5-48f9-9672-5f1f563b78e1', slug: 'me-ish',
    page: CardPage, metadata: cardMetadata, preview: CardPreview, request: mocks.cardRequest },
] as const;
const retainedId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const notFoundError = 'NEXT_HTTP_ERROR_FALLBACK;404';

function publishedRow(publicId: string) {
  return {
    public_id: publicId, public_slug: 'renamed-slug', slug: 'legacy-alias',
    visibility: 'public', status: 'published', published_at: '2026-10-01T00:00:00Z',
    design: { sections: [], theme: {} },
    content: {
      sections: [{ type: 'hero', headings: ['Synthetic portfolio title'], paragraphs: ['Synthetic description'] }],
      profile: { name: 'Synthetic card name', title: 'Artist', tagline: 'Synthetic description' },
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockImplementation(() => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), limit: vi.fn(() => query),
      maybeSingle: mocks.row,
    };
    return query;
  });
});

describe.each(publications)('$service / $slug publication ending', ({ service, id, slug, page, metadata, preview, request }) => {
  it.each(['slug', 'UUID', 'uppercase UUID', 'renamed slug'])('blocks %s before rendering, redirecting or returning content metadata', async (kind) => {
    const key = kind === 'slug' ? slug : kind === 'UUID' ? id : kind === 'uppercase UUID' ? id.toUpperCase() : 'renamed-slug';
    mocks.row.mockResolvedValue({ data: publishedRow(id), error: null });
    const props = { params: Promise.resolve({ public_id: key }) };
    await expect(page(props)).rejects.toThrow(notFoundError);
    const meta = await metadata(props);
    expect(meta.title).toMatch(/^Not Found/);
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });

  it.each([true, false])('blocks the same record in preview, including incomplete content (%s)', async (complete) => {
    request.mockResolvedValue({ ...publishedRow(id), publicId: id, content: complete ? publishedRow(id).content : null });
    await expect(preview({ params: Promise.resolve({ id: 'synthetic-request-id' }) })).rejects.toThrow(notFoundError);
  });

  it('normalizes the public UUID without applying the decision to another service', () => {
    expect(isRetiredLegacyPublication(service, ` ${id.toUpperCase()} `)).toBe(true);
    expect(isRetiredLegacyPublication(service === 'aura' ? 'card' : 'aura', id)).toBe(false);
  });
});

describe('AURA legacy aliases', () => {
  it.each(publications.filter((p) => p.service === 'aura'))('blocks the old and renamed /u alias for $slug', async ({ id }) => {
    mocks.row.mockResolvedValue({ data: publishedRow(id), error: null });
    await expect(AuraSlug({ params: Promise.resolve({ slug: 'renamed-legacy-alias' }) })).rejects.toThrow(notFoundError);
  });

  it('retains the redirect for another published record', async () => {
    mocks.row.mockResolvedValue({ data: publishedRow(retainedId), error: null });
    await expect(AuraSlug({ params: Promise.resolve({ slug: 'retained' }) })).rejects.toMatchObject({ digest: `NEXT_REDIRECT;replace;/aura/p/${retainedId};307;` });
  });
});

describe.each([publications[0], publications[2]])('$service publications outside the decision', ({ page, metadata, preview, request, service }) => {
  it('still renders another published page and its metadata', async () => {
    mocks.row.mockResolvedValue({ data: publishedRow(retainedId), error: null });
    const props = { params: Promise.resolve({ public_id: 'retained' }) };
    expect(isValidElement(await page(props))).toBe(true);
    expect((await metadata(props)).description).toBe('Synthetic description');
  });

  it('still canonicalizes another UUID to its public slug', async () => {
    mocks.row.mockResolvedValue({ data: publishedRow(retainedId), error: null });
    await expect(page({ params: Promise.resolve({ public_id: retainedId }) })).rejects.toMatchObject({ digest: `NEXT_REDIRECT;replace;/${service}/p/renamed-slug;308;` });
  });

  it('preserves the existing visibility gate', async () => {
    mocks.row.mockResolvedValue({ data: { ...publishedRow(retainedId), visibility: 'private' }, error: null });
    await expect(page({ params: Promise.resolve({ public_id: 'retained' }) })).rejects.toThrow(notFoundError);
  });

  it.each([retainedId, null])('retains other previews, including drafts without a public ID (%s)', async (publicId) => {
    request.mockResolvedValue({ ...publishedRow(retainedId), publicId });
    expect(isValidElement(await preview({ params: Promise.resolve({ id: 'retained-request' }) }))).toBe(true);
  });
});

it('removes retired AURA rows from the sitemap even after a rename, and keeps unrelated entries', async () => {
  const records: Record<string, unknown[]> = {
    entries: [{ id: 123, created_at: '2026-10-01' }],
    aura_requests: [
      ...publications.filter((p) => p.service === 'aura').map((p, i) => ({ ...publishedRow(p.id), public_slug: `renamed-retired-${i}` })),
      { ...publishedRow(retainedId), public_slug: 'retained-aura' },
    ],
    portfolio_settings: [{ user_id: 'retained-artist', updated_at: '2026-10-01' }],
  };
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), not: vi.fn(() => query), order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: records[table], error: null }),
    };
    return query;
  });
  const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);
  expect(paths.filter((path) => path.startsWith('/aura/'))).toEqual(['/aura/u/retained-aura']);
  expect(paths).toEqual(expect.arrayContaining(['/works/123', '/artists/retained-artist', '/footer/privacy']));
});
