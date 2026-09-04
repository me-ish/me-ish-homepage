// src/app/api/card/public-slug/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireCardRequestAccess } from "@/lib/card/requireCardAccess";
import { checkCsrf } from "@/lib/auth/csrf";

export const dynamic = "force-dynamic";

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug) && slug.length >= 3;
}

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  try {
    const json = await req.json().catch(() => null);
    if (!json?.requestId || !json?.slug) {
      return NextResponse.json(
        { ok: false, error: "missing_fields" },
        { status: 400 },
      );
    }

    const requestId = String(json.requestId);
    const rawSlug = String(json.slug);

    // Ownership check
    const access = await requireCardRequestAccess(requestId, req);
    if (!access.ok) return access.response;
    const rec = access.rec;

    // Must be published
    if (rec.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "not_published" },
        { status: 400 },
      );
    }

    const slug = normalizeSlug(rawSlug);

    if (!isValidSlug(slug)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_slug",
          message:
            "スラッグは3〜32文字、英小文字・数字・ハイフンのみ使用可能です。",
        },
        { status: 400 },
      );
    }

    // Check availability
    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from("card_requests")
      .select("id")
      .eq("public_slug", slug)
      .neq("id", requestId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { ok: false, error: "slug_taken", message: "このスラッグは既に使用されています。" },
        { status: 409 },
      );
    }

    // Save
    const { error: updErr } = await admin
      .from("card_requests")
      .update({
        public_slug: slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updErr) {
      return NextResponse.json(
        { ok: false, error: "update_failed" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, slug },
      { status: 200 },
    );
  } catch (e: unknown) {
    console.error("[card/public-slug] error:", e);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
