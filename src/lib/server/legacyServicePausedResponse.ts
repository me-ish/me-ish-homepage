import 'server-only';

import { NextResponse } from 'next/server';
import {
  LEGACY_SERVICE_PAUSED_MESSAGE,
  type LegacyService,
} from '@/lib/legacyServiceSuspension';

// Retired handlers remain closed independently of the middleware route matcher.
export function createLegacyServicePausedResponse(service: LegacyService) {
  return NextResponse.json(
    { error: 'legacy_service_paused', message: LEGACY_SERVICE_PAUSED_MESSAGE, service },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
