// src/app/api/cert/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** ─ Env ─ **/
const BUCKET = process.env.SUPABASE_BUCKET || 'certificates';
const TTL_SEC = Number(process.env.CERT_SIGNED_URL_TTL_SECONDS || 300); // 既定: 5分
const REQUIRE_TOKEN = (process.env.CERT_REQUIRE_TOKEN || '0') === '1';   // 1でt必須
const ONE_TIME = (process.env.CERT_ONE_TIME || '0') === '1';             // 1でワンタイム消費

/** ─ Utils ─ **/
function sha256hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

/** ─ Token validation (cert_links) ─
 * 想定テーブル: cert_links
 * - id (uuid) / entry_id (int) / token_hash (text) / expires_at (timestamptz) / revoked (bool) / used_at (timestamptz)
 */
async function validateCertToken(
  supabase: ReturnType<typeof supabaseAdmin>,
  entryId: number,
  tokenRaw?: string | null
): Promise<{ ok: boolean; err?: string }> {
  if (REQUIRE_TOKEN && !tokenRaw) return { ok: false, err: 'missing token' };
  if (!tokenRaw) return { ok: true }; // 任意運用: t省略可

  const tokenHash = sha256hex(tokenRaw);
  const nowIso = new Date().toISOString();

  // cert_links が未作成でも落ちないようにハンドリング
  const { data: link, error: qErr } = await supabase
    .from('cert_links')
    .select('id, revoked, expires_at, used_at')
    .eq('entry_id', entryId)
    .eq('token_hash', tokenHash)
    .limit(1)
    .single();

  if (qErr) {
    // テーブル未作成など。必須なら落とす、任意なら通す
    return REQUIRE_TOKEN ? { ok: false, err: 'token table not ready' } : { ok: true };
  }
  if (!link) return { ok: false, err: 'invalid token' };
  if (link.revoked) return { ok: false, err: 'token revoked' };
  if (link.expires_at && link.expires_at < nowIso) return { ok: false, err: 'token expired' };
  if (ONE_TIME && link.used_at) return { ok: false, err: 'token already used' };

  // ワンタイムなら消費マーク
  if (ONE_TIME) {
    const { error: updErr } = await supabase
      .from('cert_links')
      .update({ used_at: nowIso })
      .eq('id', link.id);
    if (updErr) return { ok: false, err: 'token consume failed' };
  }
  return { ok: true };
}

/** ─ Handler ─ **/
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin(); // ← トップレベル生成禁止。必ずハンドラ内で作成

    const { searchParams } = new URL(req.url);
    const entryParam = searchParams.get('entry'); // 例: /api/cert/download?entry=123&t=xxxx
    const token = searchParams.get('t');

    const entryId = Number(entryParam);
    if (!entryId || !Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json({ ok: false, error: 'invalid entry id' }, { status: 400 });
    }

    // トークン検証（必要に応じて）
    const tok = await validateCertToken(supabase, entryId, token);
    if (!tok.ok) {
      return NextResponse.json({ ok: false, error: tok.err || 'unauthorized' }, { status: 401 });
    }

    // entries から file_name を取得
    const { data: entry, error: entryErr } = await supabase
      .from('entries')
      .select('id, file_name')
      .eq('id', entryId)
      .single();

    if (entryErr || !entry) {
      return NextResponse.json({ ok: false, error: 'entry not found' }, { status: 404 });
    }

    const filePath: string =
      entry.file_name?.includes('/') ? entry.file_name : `${entry.id}/${entry.file_name}`;

    // 署名付きURLをTTLで発行
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, TTL_SEC);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: 'file not available' }, { status: 404 });
    }

    // 302でリダイレクト（ブラウザ側でダウンロード開始）
    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'download failed' },
      { status: 500 }
    );
  }
}
