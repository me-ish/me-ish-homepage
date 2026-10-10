import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export async function POST() {
  return createLegacyServicePausedResponse('gallery');
}

export async function GET() {
  return createLegacyServicePausedResponse('gallery');
}
