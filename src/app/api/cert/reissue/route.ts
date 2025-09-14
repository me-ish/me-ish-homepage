// src/app/api/cert/reissue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { issueReissueLink } from '@/lib/coa/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entryIdStr = searchParams.get('entryId');
    if (!entryIdStr) return NextResponse.json({ error: 'entryId is required' }, { status: 400 });

    const entryId = Number(entryIdStr);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return NextResponse.json({ error: 'entryId must be a positive integer' }, { status: 400 });
    }

    const url = await issueReissueLink(entryId);
    // 302で新URLへ
    return NextResponse.redirect(url, { status: 302 });
  } catch (e: any) {
    console.error('reissue error:', e);
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 });
  }
}

