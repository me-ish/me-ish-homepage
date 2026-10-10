import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

// Keep the retired admin write closed even without middleware.
export async function POST() {
  return createLegacyServicePausedResponse('gallery');
}
