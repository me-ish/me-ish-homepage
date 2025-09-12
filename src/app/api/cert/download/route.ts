// src/app/api/cert/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ★ バケットは artworks、プレフィックスは final に固定
const BUCKET = "artworks";
const FINAL_PREFIX = "final";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// t= の生トークンを cert_links.token_hash と照合
async function verifyToken(entryId: number, token?: string | null) {
  if (!token) return { ok: false as const, error: "missing token" };
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase
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

async function firstFileUnder(path: string): Promise<string | null> {
  // path 末尾の / は Supabase list では「フォルダ扱い」になる
  const normalized = path.endsWith("/") ? path : path + "/";
  const { data, error } = await supabase.storage.from(BUCKET).list(normalized, { limit: 200 });
  if (error || !data?.length) return null;
  const file = data.find((o) => o.name && !o.id?.endsWith("/"));
  return file ? normalized + file.name : null;
}

async function findInFinalRootByPrefix(entryId: number): Promise<string | null> {
  // final/ 直下を 200 件だけ見る。ファイル名が "<entryId>_" で始まるものを拾う（暫定）
  const { data, error } = await supabase.storage.from(BUCKET).list(`${FINAL_PREFIX}/`, { limit: 200 });
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

    // トークン検証（使わないなら外してOK）
    const v = await verifyToken(entryId, token);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 401 });

    // entries から file_name を拾う（最終フォールバックに使う）
    const { data: entry, error: entryErr } = await supabase
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
    // 3) entries.file_name があれば final/<file_name> を試す
    let filePath: string | null = null;

    filePath ||= await firstFileUnder(`${FINAL_PREFIX}/${entryId}`);
    filePath ||= await findInFinalRootByPrefix(entryId);

    if (!filePath && entry.file_name) {
      filePath = `${FINAL_PREFIX}/${entry.file_name}`;
    }

    if (!filePath) {
      return NextResponse.json({ ok: false, error: "file not available" }, { status: 404 });
    }

    // 5分だけ有効なサイン付きURLを発行
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 5);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: "file not available" }, { status: 404 });
    }

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "download failed" }, { status: 500 });
  }
}
