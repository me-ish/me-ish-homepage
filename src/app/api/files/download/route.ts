// /src/app/api/files/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCertToken } from '@/lib/coa/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUCKET = process.env.SUPABASE_BUCKET || 'artworks';
const FOLDER = process.env.SB_ARTWORK_FOLDER || 'final';
const TTL = Number(process.env.CERT_SIGNED_URL_TTL_SECONDS || 300);
const ALLOW_OFFCHAIN_DOWNLOAD_FOR_NFT =
  String(process.env.ALLOW_OFFCHAIN_DOWNLOAD_FOR_NFT || '').toLowerCase() === 'true';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('certToken') || '';
    if (!token) return NextResponse.json({ error: 'missing_cert_token' }, { status: 400 });

    // 1) トークン検証
    const ver = await verifyCertToken(token);
    if (!ver.ok) return NextResponse.json({ error: 'invalid_or_expired' }, { status: 403 });

    const admin = supabaseAdmin();

    // 2) entries を取得（* で取り、存在するフィールドを後で参照）
    const { data: entry, error: eErr } = await admin
      .from('entries')
      .select('*')
      .eq('id', ver.entryId)
      .single();

    if (eErr || !entry) {
      return NextResponse.json({ error: 'entry_not_found' }, { status: 404 });
    }

    // sales_type / sale_type / type の順で拾う（型には無い可能性があるので any 経由）
    const saleType = String(
      (entry as any)?.sales_type ??
      (entry as any)?.sale_type ??
      (entry as any)?.type ??
      'normal'
    ).toLowerCase();

    if (saleType === 'nft' && !ALLOW_OFFCHAIN_DOWNLOAD_FOR_NFT) {
      return NextResponse.json({ error: 'offchain_download_disabled_for_nft' }, { status: 403 });
    }

    // 3) ストレージのオブジェクトパス（例: final/{entryId}.zip）
    const objectPath = `${FOLDER}/${ver.entryId}.zip`;

    // 4) 署名URL発行（ダウンロードファイル名も設定）→ 302 リダイレクト
    const { data: signed, error: sErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, TTL, { download: `meish_artwork_${ver.entryId}.zip` });

    if (sErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: 'asset_not_found', path: `${BUCKET}/${objectPath}`, detail: sErr?.message ?? null },
        { status: 404 },
      );
    }

    return NextResponse.redirect(signed.signedUrl, 302);
  } catch (e) {
    console.error('[files/download] error:', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
