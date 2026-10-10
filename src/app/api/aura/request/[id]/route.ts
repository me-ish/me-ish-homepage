import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const dynamic = "force-dynamic";

export async function GET() {
  return createLegacyServicePausedResponse('aura');
}
