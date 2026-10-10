import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 最大60秒

// Intake is retired; keep this URL inert even without middleware.
export async function GET() {
  return createLegacyServicePausedResponse('gallery');
}

export async function POST() {
  return createLegacyServicePausedResponse('gallery');
}
