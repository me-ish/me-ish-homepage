import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Intake is retired; keep this URL inert even without middleware.
export async function GET() {
  return createLegacyServicePausedResponse('aura');
}
