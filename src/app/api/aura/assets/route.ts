// src/app/api/aura/assets/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


// bucket / TTL は env で上書き可。未設定なら安全なデフォルト。
const BUCKET = process.env.AURA_ASSETS_BUCKET ?? "aura-assets";
const TTL = Number(process.env.AURA_ASSETS_SIGNED_TTL ?? 3600); // seconds（デフォルト 1h）

function isAllowedPath(path: string) {
  // 実運用で使う prefix のみ許可（必要なら増やす）
  const allowedPrefixes = [
    "avatars/",
    "works/",
    "ai-portfolio/",
  ];
  return allowedPrefixes.some((p) => path.startsWith(p));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("path") ?? "").trim();

  if (!raw) {
    return NextResponse.json({ ok: false, error: "path_required" }, { status: 400 });
  }

  // 正規化（先頭/ を落とす）
  const path = raw.replace(/^\/+/, "");

  // 最低限の安全チェック
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "invalid_path" }, { status: 400 });
  }

  if (!isAllowedPath(path)) {
    return NextResponse.json({ ok: false, error: "invalid_path" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { ok: false, error: "sign_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  // 重要：302 の “行き先（signed URL）” をブラウザにキャッシュさせない
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
res.headers.set("Pragma", "no-cache");
  return res;
}
