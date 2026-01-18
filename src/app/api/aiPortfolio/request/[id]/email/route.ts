// src/app/api/aiPortfolio/request/[id]/email/route.ts
// ============================================
// 確定前メールアドレス更新 API
// - published 以外のステータスでのみ変更可能
// - aura_requests.email と payload.email を同期更新
// ============================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/aiPortfolio/supabaseAdmin";
import { requireAuraRequestAccess } from "@/lib/aiPortfolio/requireAuraAccess";

export const dynamic = "force-dynamic";

type Params = { id: string };

/**
 * email を正規化（trim + lowercase）
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export async function POST(req: Request, { params }: { params: Params }) {
  const id = params.id;

  try {
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const rawEmail = (json as any).email;
    if (typeof rawEmail !== "string" || !rawEmail.trim()) {
      return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    if (!normalizedEmail) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    // ✅ 所有権チェック（cookie aura_st_{id} → DB session_token 照合）
    const access = await requireAuraRequestAccess(id, req);
    if (!access.ok) return access.response;
    const rec = access.rec;

    const admin = supabaseAdmin() as any;

    // 2) published の場合は拒否（確定後は変更不可）
    if (rec.status === "published") {
      console.log("[email/update] rejected: already published", { id, status: rec.status });
      return NextResponse.json(
        { ok: false, error: "already_published", message: "確定後はメールアドレスを変更できません" },
        { status: 403 }
      );
    }

    // 3) payload 内の email も同期更新（JSON の場合）
    let updatedPayload = rec.payload;
    if (updatedPayload && typeof updatedPayload === "object") {
      updatedPayload = {
        ...updatedPayload,
        email: normalizedEmail,
      };
    }

    // 4) DB 更新
    const { error: updateErr } = await admin
      .from("aura_requests")
      .update({
        email: normalizedEmail,
        payload: updatedPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[email/update] update error:", updateErr);
      return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
    }

    console.log("[email/update] SUCCESS:", { id, email: normalizedEmail });

    return NextResponse.json({
      ok: true,
      email: normalizedEmail,
    });
  } catch (e: any) {
    console.error("[email/update] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
