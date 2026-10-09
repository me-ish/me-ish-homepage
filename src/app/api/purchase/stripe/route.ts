import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const runtime = 'nodejs';

export async function POST() {
  return createLegacyServicePausedResponse('gallery');
}


