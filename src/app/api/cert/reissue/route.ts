import { NextRequest, NextResponse } from 'next/server';
import { issueReissueLink } from '@/lib/coa/server';
import { CertAdminError, requireCertAdmin } from '@/lib/coa/reissueAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    requireCertAdmin(req);
    const entryIdStr = req.nextUrl.searchParams.get('entryId');
    if (!entryIdStr) return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    const entryId = Number(entryIdStr);
    if (!Number.isSafeInteger(entryId) || entryId <= 0) {
      return NextResponse.json({ error: 'entryId must be a positive safe integer' }, { status: 400 });
    }
    const url = await issueReissueLink(entryId, req);
    return NextResponse.redirect(new URL(url, req.url), {
      status: 302, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch (error: unknown) {
    if (error instanceof CertAdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[CoA] certificate reissue unavailable');
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 });
  }
}
