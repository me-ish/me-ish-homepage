import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/aiPortfolio/supabaseAdmin";

export const dynamic = "force-dynamic";

const BUCKET = process.env.AURA_ASSETS_BUCKET ?? "aura-assets";
const TTL = Number(process.env.AURA_ASSETS_SIGNED_TTL ?? 300); // seconds

function isAllowedPath(path: string) {
  // 必要に応じてここを「運用で使うprefix」だけに絞る
  const allowedPrefixes = [
    "avatars/",
    "works/",
    "ai-portfolio/", // ← これが無いと drafts 配下が弾かれる
  ];
  return allowedPrefixes.some((p) => path.startsWith(p));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = (url.searchParams.get("path") ?? "").trim();

  if (!path) {
    return NextResponse.json(
      { ok: false, error: "path_required" },
      { status: 400 }
    );
  }

  // 最低限の安全チェック
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    return NextResponse.json(
      { ok: false, error: "invalid_path" },
      { status: 400 }
    );
  }

  if (!isAllowedPath(path)) {
    return NextResponse.json(
      { ok: false, error: "invalid_path" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { ok: false, error: "sign_failed", detail: error?.message ?? "unknown" },
      { status: 500 }
    );
  }

  // 画像用途なので 302 でOK（img が追従する）
  return NextResponse.redirect(data.signedUrl, 302);
}
