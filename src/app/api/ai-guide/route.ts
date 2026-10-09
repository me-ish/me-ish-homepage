import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

// Intake is retired; keep this URL inert even without middleware.
export async function POST() {
  return createLegacyServicePausedResponse('gallery');
}
