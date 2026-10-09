// Call only with the owned record returned by the server access check. Client
// request fields must never establish an existing payment or publication.
export function canContinueLegacyPublication(record: {
  payment_status?: unknown;
  published_at?: unknown;
  publishedAt?: unknown;
}): boolean {
  const publishedAt = record.published_at ?? record.publishedAt;
  return (typeof publishedAt === 'string' && publishedAt.length > 0) ||
    (typeof record.payment_status === 'string' &&
      record.payment_status.toLowerCase() === 'paid');
}
