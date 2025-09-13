import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CoALang } from "@/lib/i18n/coa-ui";


export type PurchaseType = "normal" | "nft";


export async function resolveLangFromRequest(searchParams: URLSearchParams): Promise<CoALang> {
const qp = searchParams.get("lang");
if (qp === "en" || qp === "ja") return qp;
const h = await headers();
const al = h.get("accept-language") || "";
return al.toLowerCase().startsWith("ja") ? "ja" : "en";
}


export async function verifyCertToken(token: string): Promise<
| { ok: true; entryId: number; purchaserEmail?: string | null }
| { ok: false }
> {
if (!token) return { ok: false } as const;
const db = supabaseAdmin();
const { data, error } = await db
.from("cert_links")
.select("entry_id, email, expires_at, revoked, used_at")
.eq("token_hash", token)
.maybeSingle();
if (error || !data) return { ok: false } as const;
if (data.revoked) return { ok: false } as const;
if (data.expires_at && new Date(data.expires_at) < new Date()) return { ok: false } as const;
return { ok: true, entryId: data.entry_id, purchaserEmail: data.email } as const;
}


export async function getEntryForCoA(entryId: number) {
const db = supabaseAdmin();
const { data, error } = await db
.from("entries")
.select(
"id, title, artist_name, sales_type, edition_total, edition_sold, token_id, contract_address, purchaser_display_name, purchased_at"
)
.eq("id", entryId)
.maybeSingle();
if (error || !data) return null;
return data;
}


export async function issueReissueLink(entryId: number, email?: string | null) {
const base = process.env.NEXT_PUBLIC_SITE_URL || "";
return `${base}/api/cert/reissue?entryId=${entryId}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
}