// src/lib/coa/server.ts
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ONE_TIME = process.env.CERT_ONE_TIME === '1';
const REQUIRE_TOKEN = process.env.CERT_REQUIRE_TOKEN !== '0';
const LINK_TTL_DAYS = Number(process.env.CERT_LINK_TTL_DAYS || 7);

type VerifyResult =
  | { ok: true; entryId: number }
  | { ok: false; reason: 'missing' | 'expired' | 'revoked' | 'notfound' };

const sha256hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const sha256b64 = (s: string) => crypto.createHash('sha256').update(s).digest('base64');
const genToken   = () => crypto.randomBytes(32).toString('base64url');

/** CoAリンク（平文トークン）を発行して /cert/:id?t=... を返す */
export async function issueReissueLink(entryId: number, _lang?: string) {
  const sb = supabaseAdmin();
  const token = genToken();
  const tokenHashHex = sha256hex(token);
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 86400_000).toISOString();

  const { error } = await sb
    .from('cert_links')
    .insert({ entry_id: entryId, token_hash: tokenHashHex, expires_at: expiresAt })
    .single();
  if (error) throw error;

  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  return `${site ? site : ''}/cert/${entryId}?t=${encodeURIComponent(token)}`;
}

/** トークン検証（hex と base64 の両方を後方互換で許容） */
export async function verifyCertToken(token?: string | null): Promise<VerifyResult> {
  if (!REQUIRE_TOKEN) return { ok: true, entryId: 0 };
  if (!token) return { ok: false, reason: 'missing' };

  const sb = supabaseAdmin();
  const hex = sha256hex(token);
  const b64 = sha256b64(token);

  // v_cert_links_active ビューを使用（有効なリンクのみ返す）
  const { data, error } = await sb
    .from('v_cert_links_active')
    .select('id, entry_id, used_at, created_at')
    .in('token_hash', [hex, b64])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.entry_id) return { ok: false, reason: 'notfound' };
  // ビューで既に revoked=false, expires_at > now() のフィルタ済み

  if (ONE_TIME && !data.used_at && data.id) {
    // used_at の更新は cert_links テーブルに対して行う
    await sb.from('cert_links').update({ used_at: new Date().toISOString() }).eq('id', data.id);
  }
  return { ok: true, entryId: data.entry_id };
}

/** entries の列名ゆらぎを吸収して返す（* で取り列を補完） */
export async function getEntryForCoA(entryId: number) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('entries')
    .select('*')
    .eq('id', entryId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const salesType =
    (data as any).sales_type ??
    (data as any).sale_type ??
    null;

  const purchaserDisplayName =
    (data as any).purchaser_display_name ??
    (data as any).buyer_display_name ??
    (data as any).buyer_name ??
    (data as any).customer_name ??
    null;

  return {
    ...data,
    sales_type: salesType,
    purchaser_display_name: purchaserDisplayName,
  } as typeof data & { sales_type: string | null; purchaser_display_name: string | null };
}

export async function resolveLangFromRequest(_sp: URLSearchParams) {
  return 'ja' as const;
}
