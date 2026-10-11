import 'server-only';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireCertAdmin } from '@/lib/coa/reissueAuth';
import type { CoACertificateEntry } from '@/lib/coa/types';

const ONE_TIME = process.env.CERT_ONE_TIME === '1';
const LINK_TTL_DAYS = Number(process.env.CERT_LINK_TTL_DAYS || 7);
// CERT_REQUIRE_TOKEN=0 must never bypass proof of access.

type VerifyResult =
  | { ok: true; entryId: number }
  | { ok: false; reason: 'missing' | 'expired' | 'revoked' | 'notfound' };

const sha256hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const sha256b64 = (s: string) => crypto.createHash('sha256').update(s).digest('base64');
const genToken = () => crypto.randomBytes(32).toString('base64url');

/** Issue only after explicit admin authentication, including direct helper calls. */
export async function issueReissueLink(entryId: number, request: Pick<Request, 'headers'>) {
  requireCertAdmin(request);
  if (!Number.isSafeInteger(entryId) || entryId <= 0) throw new Error('Invalid certificate ID');
  if (!Number.isFinite(LINK_TTL_DAYS) || LINK_TTL_DAYS <= 0) throw new Error('Invalid certificate link lifetime');
  const sb = supabaseAdmin();
  const token = genToken();
  const tokenHashHex = sha256hex(token);
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 86400_000).toISOString();

  const { error } = await sb.from('cert_links')
    .insert({ entry_id: entryId, token_hash: tokenHashHex, expires_at: expiresAt }).single();
  if (error) throw new Error('Certificate link issuance failed');

  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  return `${site}/cert/${entryId}?t=${encodeURIComponent(token)}`;
}

/** Validate both the legacy token hash format and its exact URL entry ID. */
export async function verifyCertToken(token: string | null | undefined, expectedEntryId: number): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'missing' };
  if (token.length > 512 || !Number.isSafeInteger(expectedEntryId) || expectedEntryId <= 0) {
    return { ok: false, reason: 'notfound' };
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('v_cert_links_active')
    .select('id, entry_id, used_at, created_at')
    .in('token_hash', [sha256hex(token), sha256b64(token)])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('Certificate token verification unavailable');
  // The existing active view must enforce expiry/revocation; do not fall back
  // to cert_links or recreate a missing view when verification fails.
  if (!data || data.entry_id !== expectedEntryId) return { ok: false, reason: 'notfound' };

  if (ONE_TIME) {
    if (data.used_at || !data.id) return { ok: false, reason: 'notfound' };
    const { data: claimed, error: claimError } = await sb.from('cert_links')
      .update({ used_at: new Date().toISOString() }).eq('id', data.id)
      .is('used_at', null).select('id').maybeSingle();
    if (claimError) throw new Error('Certificate token claim unavailable');
    if (!claimed) return { ok: false, reason: 'notfound' };
  }
  return { ok: true, entryId: expectedEntryId };
}

/** Privileged read: query and return an explicit certificate-only DTO. */
export async function getEntryForCoA(entryId: number): Promise<CoACertificateEntry | null> {
  if (!Number.isSafeInteger(entryId) || entryId <= 0) throw new Error('Invalid certificate ID');
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('entries')
    .select('id,title,artist_name,edition_total,created_at,confirmed_at')
    .eq('id', entryId).maybeSingle();
  if (error) throw new Error('Certificate lookup unavailable');
  if (!data || data.id !== entryId) return null;
  return {
    id: data.id,
    title: data.title,
    artist_name: data.artist_name,
    edition_total: data.edition_total,
    created_at: data.created_at,
    confirmed_at: data.confirmed_at,
  };
}

export async function resolveLangFromRequest(_sp: URLSearchParams) {
  return 'ja' as const;
}
