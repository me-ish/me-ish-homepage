// src/lib/coa/server.ts
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ---- 設定 -------------------------------------------------
const ONE_TIME = process.env.CERT_ONE_TIME === '1';
const REQUIRE_TOKEN = process.env.CERT_REQUIRE_TOKEN !== '0';
const LINK_TTL_DAYS = Number(process.env.CERT_LINK_TTL_DAYS || 7);

// ---- ユーティリティ ----------------------------------------
const sha256hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const sha256b64 = (s: string) => crypto.createHash('sha256').update(s).digest('base64');
const genToken = () => crypto.randomBytes(32).toString('base64url'); // 平文トークン

type VerifyResult =
  | { ok: true; entryId: number }
  | { ok: false; reason: 'missing' | 'expired' | 'revoked' | 'notfound' };

export async function issueReissueLink(entryId: number, _lang?: string) {
  // ここは hex 保存を“正”とする
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
  return `${site}/cert/${entryId}?t=${encodeURIComponent(token)}`;
}

export async function verifyCertToken(token?: string | null): Promise<VerifyResult> {
  if (!REQUIRE_TOKEN) return { ok: true, entryId: 0 };
  if (!token) return { ok: false, reason: 'missing' };

  const sb = supabaseAdmin();

  // ① まず hex で照合 → 見つからなければ ② base64 でも照合（後方互換）
  const hex = sha256hex(token);
  const b64 = sha256b64(token);

  const { data, error } = await sb
    .from('cert_links')
    .select('id, entry_id, expires_at, revoked, used_at, created_at')
    .in('token_hash', [hex, b64]) // ★ どちらでもヒットさせる
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, reason: 'notfound' };
  if (data.revoked) return { ok: false, reason: 'revoked' };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  if (ONE_TIME && !data.used_at) {
    await sb.from('cert_links').update({ used_at: new Date().toISOString() }).eq('id', data.id);
  }
  return { ok: true, entryId: data.entry_id };
}

export async function getEntryForCoA(entryId: number) {
  const sb = supabaseAdmin();

  // sales_type と sale_type の両取り（後で片方に寄せる）
  const { data, error } = await sb
    .from('entries')
    .select(`
      id,
      title,
      artist_name,
      edition_total,
      edition_sold,
      purchaser_display_name,
      purchased_at,
      sales_type,
      sale_type,
      token_id,
      contract_address
    `)
    .eq('id', entryId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null as any;

  // どちらか入っている方を統一キーに寄せる
  const unified = {
    ...data,
    sales_type: (data as any).sales_type ?? (data as any).sale_type ?? null,
  };
  return unified as typeof data & { sales_type: string | null };
}

export async function resolveLangFromRequest(_sp: URLSearchParams) {
  return 'ja' as const;
}
