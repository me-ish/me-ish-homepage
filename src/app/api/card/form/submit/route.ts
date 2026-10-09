import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Intake is retired; keep this URL inert even without middleware.
export async function POST() {
  return createLegacyServicePausedResponse('card');
}
