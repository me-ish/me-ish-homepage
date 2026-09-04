// src/app/api/card/assets/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = process.env.CARD_ASSETS_BUCKET ?? "card-assets";
const TTL = Number(process.env.CARD_ASSETS_SIGNED_TTL ?? 3600);

function isAllowedPath(path: string) {
  const allowedPrefixes = ["avatars/", "works/"];
  return allowedPrefixes.some((p) => path.startsWith(p));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("path") ?? "").trim();

  if (!raw) {
    return NextResponse.json(
      { ok: false, error: "path_required" },
      { status: 400 },
    );
  }

  const path = raw.replace(/^\/+/, "");

  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    return NextResponse.json(
      { ok: false, error: "invalid_path" },
      { status: 400 },
    );
  }

  if (!isAllowedPath(path)) {
    return NextResponse.json(
      { ok: false, error: "invalid_path" },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "sign_failed",
        detail: error?.message ?? "unknown",
      },
      { status: 500 },
    );
  }

  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );
  res.headers.set("Pragma", "no-cache");
  return res;
}
