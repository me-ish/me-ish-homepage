import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Keep the retired admin write closed even without middleware.
export async function POST() {
  return createLegacyServicePausedResponse('gallery');
}
