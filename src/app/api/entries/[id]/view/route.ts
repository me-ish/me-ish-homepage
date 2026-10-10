import { NextResponse } from 'next/server';
import { createLegacyServicePausedResponse } from '@/lib/server/legacyServicePausedResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return createLegacyServicePausedResponse('gallery');
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
