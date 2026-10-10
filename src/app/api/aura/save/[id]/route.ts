import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const dynamic = "force-dynamic";

export async function POST() {
  return createLegacyServicePausedResponse('aura');
}
