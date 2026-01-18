// src/app/api/cert/reissue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { issueReissueLink } from '@/lib/coa/server';
import crypto from "crypto";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function requireAdmin(req: NextRequest) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return { ok: false as const, status: 500, error: "missing_ADMIN_API_TOKEN" };

  const header =
    req.headers.get("x-meish-admin-token") ??
    (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice("Bearer ".length)
      : null);

  if (!header) return { ok: false as const, status: 401, error: "missing_admin_token" };

  const a = Buffer.from(String(header));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return { ok: false as const, status: 403, error: "invalid_admin_token" };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false as const, status: 403, error: "invalid_admin_token" };

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    // ✅ 緊急遮断（購入者照合が入るまで admin only）
    const adminAuth = requireAdmin(req);
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
    }

    const { searchParams } = new URL(req.url);
    const entryIdStr = searchParams.get('entryId');
    if (!entryIdStr) return NextResponse.json({ error: 'entryId is required' }, { status: 400 });

    const entryId = Number(entryIdStr);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return NextResponse.json({ error: 'entryId must be a positive integer' }, { status: 400 });
    }

    const url = await issueReissueLink(entryId);
    return NextResponse.redirect(url, { status: 302 });
  } catch (e: any) {
    console.error('reissue error:', e);
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 });
  }
}
