import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 固定：保護済みデータは artworks/final/ 以下
const BUCKET = "artworks";
const FINAL_PREFIX = "final";

// 実行時にだけ Supabase クライアントを作る
function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // ここは実行時にだけ到達する。build フェーズでは評価されない。
    throw new Error("Server misconfig: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

// t= の生トークンを cert_links.token_hash と照合
async function verifyToken(
  supa: SupabaseClient,
  entryId: number,
  token?: string | null
) {
  if (!token) return { ok: false as const, error: "missing token" };
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supa
    .from("cert_links")
    .select("id, expires_at, revoked")
    .eq("entry_id", entryId)
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !data) return { ok: false as const, error: "invalid token" };
  if (data.revoked) return { ok: false as const, error: "revoked token" };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: "expired token" };
  }
  return { ok: true as const };
}

async function firstFileUnder(
  supa: SupabaseClient,
  path: string
): Promise<string | null> {
  const normalized = path.endsWith("/") ? path : path + "/";
  const { data, error } = await supa.storage.from(BUCKET).list(normalized, { limit: 200 });
  if (error || !data?.length) return null;
  const file = data.find((o) => o.name && !o.id?.endsWith("/"));
  return file ? normalized + file.name : null;
}

async function findInFinalRootByPrefix(
  supa: SupabaseClient,
  entryId: number
): Promise<string | null> {
  const { data, error } = await supa.storage.from(BUCKET).list(`${FINAL_PREFIX}/`, { limit: 200 });
  if (error || !data?.length) return null;
  const prefix = String(entryId) + "_";
  const hit = data.find((o) => o.name?.startsWith(prefix));
  return hit ? `${FINAL_PREFIX}/${hit.name}` : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entryStr = searchParams.get("entry");
    const token = searchParams.get("t");
    const entryId = Number(entryStr);

    if (!entryStr || !Number.isFinite(entryId)) {
      return NextResponse.json({ ok: false, error: "missing entry id" }, { status: 400 });
    }

    const supa = admin(); // ← 実行時にだけ生成

    // トークン検証（不要なら外してください）
    const v = await verifyToken(supa, entryId, token);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 401 });

    // entries.file_name は最終フォールバックに使用
    const { data: entry, error: entryErr } = await supa
      .from("entries")
      .select("id, file_name")
      .eq("id", entryId)
      .single();

    if (entryErr || !entry) {
      return NextResponse.json({ ok: false, error: "entry not found" }, { status: 404 });
    }

    // 探索順：
    // 1) final/<id>/ 配下の最初のファイル
    // 2) final/ 直下で "<id>_" で始まるファイル
    // 3) entries.file_name があれば final/<file_name>
    let filePath: string | null = null;

    filePath ||= await firstFileUnder(supa, `${FINAL_PREFIX}/${entryId}`);
    filePath ||= await findInFinalRootByPrefix(supa, entryId);

    if (!filePath && entry.file_name) {
      filePath = `${FINAL_PREFIX}/${entry.file_name}`;
    }

    if (!filePath) {
      return NextResponse.json({ ok: false, error: "file not available" }, { status: 404 });
    }

    // 5分有効の署名URL
    const { data: signed, error: signErr } = await supa.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 5);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: "file not available" }, { status: 404 });
    }

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (e: any) {
    console.error("[cert/download] error", e);
    return NextResponse.json({ ok: false, error: "download_failed" }, { status: 500 });
  }
}
