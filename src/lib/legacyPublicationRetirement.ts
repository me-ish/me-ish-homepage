// Publication ending approved on 2026-10-10. Keep records/assets for recovery.
// Match stable public IDs so a saved edit or renamed slug cannot reopen a page.
// This list is deliberately limited to the three approved publications.
const retiredPublicIds: Record<'aura' | 'card', ReadonlySet<string>> = {
  aura: new Set([
    '4d6395d7-1e01-4ae5-9d28-15dd51cd8643', // /aura/u/portfolio
    'ed4567ef-877b-4bd2-ae4e-32cdca68bf37', // /aura/u/portfolio-2
  ]),
  card: new Set([
    '070a68ba-11a5-48f9-9672-5f1f563b78e1', // /card/p/me-ish
  ]),
};

export function isRetiredLegacyPublication(
  service: 'aura' | 'card',
  publicId: string | null | undefined,
): boolean {
  return typeof publicId === 'string' && retiredPublicIds[service].has(publicId.trim().toLowerCase());
}
