import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE() {
  return createLegacyServicePausedResponse('gallery');
}
