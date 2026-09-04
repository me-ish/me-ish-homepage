// src/app/cert/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  // 旧式パラメータ互換
  const id = sp.get('id') || sp.get('entry') || '';
  const t  = sp.get('t') || '';

  // id と t がそろっていれば /cert/[id]?t=... へ 308 永続リダイレクト
  if (id && t) {
    return NextResponse.redirect(new URL(`/cert/${id}?t=${encodeURIComponent(t)}`, url), 308);
  }

  // それ以外はギャラリーへ退避
  return NextResponse.redirect(new URL('/', url), 302);
}
