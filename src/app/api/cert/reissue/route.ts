// src/app/api/cert/reissue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 平文トークン生成（URLセーフ）
function genToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
// SHA-256 ハッシュ（DBにはハッシュを保存）
function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entryIdStr = searchParams.get('entryId');
    if (!entryIdStr) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    }
    const entryId = Number(entryIdStr);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return NextResponse.json({ error: 'entryId must be a positive integer' }, { status: 400 });
    }

    const TOKEN_TTL_DAYS = Number(process.env.CERT_LINK_TTL_DAYS || 7);
    const site = process.env.NEXT_PUBLIC_SITE_URL || '';

    const token = genToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const sb = supabaseAdmin(); // service_role を内部で使う想定
    // revoked/used_at は既定値 null
    const { error } = await sb
      .from('cert_links')
      .insert({ entry_id: entryId, token_hash: tokenHash, expires_at: expiresAt })
      .single();

    if (error) {
      console.error('cert_links insert error:', error);
      return NextResponse.json({ error: 'failed to issue token' }, { status: 500 });
    }

    // 新しいCoA URLへ302リダイレクト
    const url = `${site}/cert/${entryId}?t=${encodeURIComponent(token)}`;
    return NextResponse.redirect(url, { status: 302 });
  } catch (e: any) {
    console.error('reissue error:', e);
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 });
  }
}
