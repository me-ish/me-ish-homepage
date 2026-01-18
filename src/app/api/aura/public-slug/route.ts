// src/app/api/aura/public-slug/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/aiPortfolio/supabaseAdmin";
import { requireAuraRequestAccess } from "@/lib/aiPortfolio/requireAuraAccess";

export const dynamic = "force-dynamic";

type Body =
  | {
      requestId: string;
      mode: "check";
      publicSlug: string;
    }
  | {
      requestId: string;
      mode: "save";
      publicSlug: string;
    };

function normalizePublicSlug(input: string) {
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "") // サーバー側でも保険（フロントとズレても事故らない）
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function validatePublicSlug(slug: string): { ok: true } | { ok: false; message: string } {
  if (!slug) return { ok: false, message: "publicSlug が空です。" };
  if (slug.length < 3) return { ok: false, message: "3文字以上にしてください。" };
  if (slug.length > 32) return { ok: false, message: "32文字以内にしてください。" };
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return { ok: false, message: "英小文字・数字・ハイフンのみ使用できます（先頭末尾は英数字）。" };
  }
  // 予約語（必要に応じて追加）
  const reserved = new Set(["admin", "api", "aura", "p", "u", "preview", "form", "login", "signup"]);
  if (reserved.has(slug)) return { ok: false, message: "この文字列は予約されています。" };
  return { ok: true };
}

export async function POST(req: Request) {
  const supabase = supabaseAdmin();

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "invalid_json" }, { status: 400 });
  }

  const requestId = (body as any).requestId as string | undefined;
  const mode = (body as any).mode as "check" | "save" | undefined;
  const rawSlug = (body as any).publicSlug as string | undefined;

  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ ok: false, message: "requestId is required" }, { status: 400 });
  }
  if (mode !== "check" && mode !== "save") {
    return NextResponse.json({ ok: false, message: "mode must be 'check' or 'save'" }, { status: 400 });
  }
  if (!rawSlug || typeof rawSlug !== "string") {
    return NextResponse.json({ ok: false, message: "publicSlug is required" }, { status: 400 });
  }

  // ✅ 所有権チェック（IDOR遮断）
  const access = await requireAuraRequestAccess(requestId);
  if (!access.ok) return access.response;

  const publicSlug = normalizePublicSlug(rawSlug);
  const v = validatePublicSlug(publicSlug);
  if (!v.ok) {
    return NextResponse.json({ ok: false, message: v.message }, { status: 400 });
  }

  // 対象レコード（本人）を取得：公開済みであることを要求
  // ※ access.rec は select("*") なので利用もできるが、ここは現状ロジックを温存する
  const { data: self, error: selfErr } = await supabase
    .from("aura_requests")
    .select("id, status, public_id, visibility, published_at, public_slug")
    .eq("id", requestId)
    .maybeSingle();

  if (selfErr || !self) {
    return NextResponse.json({ ok: false, message: "not_found" }, { status: 404 });
  }

  // 「公開後に設定できます。」とフロントに合わせて、公開要件を軽くゲート
  // 必要ならここを緩められますが、まずは安全側
  if (self.status !== "published" || self.visibility !== "public" || !self.published_at || !self.public_id) {
    return NextResponse.json({ ok: false, message: "not_published" }, { status: 400 });
  }

  // 既に同じslugが付いている場合は、check/save ともに「OK」にして扱いやすくする
  if (self.public_slug && self.public_slug === publicSlug) {
    if (mode === "check") {
      return NextResponse.json({ ok: true, available: true, publicSlug }, { status: 200 });
    }
    return NextResponse.json({ ok: true, publicSlug }, { status: 200 });
  }

  // 競合チェック（他人が使っていないか）
  const { data: hit, error: hitErr } = await supabase
    .from("aura_requests")
    .select("id")
    .eq("public_slug", publicSlug)
    .maybeSingle();

  if (hitErr) {
    return NextResponse.json({ ok: false, message: "db_error" }, { status: 500 });
  }

  const available = !hit || hit.id === requestId;

  if (mode === "check") {
    return NextResponse.json({ ok: true, available, publicSlug }, { status: 200 });
  }

  // mode === "save"
  if (!available) {
    return NextResponse.json({ ok: false, message: "already_taken" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  const { data: updated, error: upErr } = await supabase
    .from("aura_requests")
    .update({
      public_slug: publicSlug,
      updated_at: nowIso,
    })
    .eq("id", requestId)
    .select("public_slug")
    .single();

  if (upErr || !updated) {
    return NextResponse.json({ ok: false, message: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, publicSlug: updated.public_slug }, { status: 200 });
}
