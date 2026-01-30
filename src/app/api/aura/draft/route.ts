// src/app/api/aura/draft/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { insertDraft } from "@/lib/aura/aura.db";
import type { FormInput } from "@/lib/aura/aura.schema";
import { buildAuraSessionCookie } from "@/lib/aura/requireAuraAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);

    if (!json?.email || typeof json.email !== "string") {
      return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
    }

    // draft: 最低限
    const prompt: Partial<FormInput> = {
      email: json.email,
      name: typeof json.name === "string" ? json.name : "",
    };

    // ✅ request 所有を証明する sessionToken を発行
    const sessionToken = randomUUID();

    // ✅ insertDraft 側に sessionToken を保存させる（要: insertDraftの引数対応）
    const record = await insertDraft({
      email: json.email,
      prompt: prompt as any,
      sessionToken, // ★ insertDraft が受け取れるように aura.db を後で修正
    } as any);

    // ✅ requestIdごとのCookieを設定
    const res = NextResponse.json({ ok: true, requestId: record.id }, { status: 200 });
    res.headers.append("Set-Cookie", buildAuraSessionCookie(record.id, sessionToken));
    return res;
  } catch (e: any) {
    console.error("[POST /api/aura/draft] failed:", e);
    const message = typeof e?.message === "string" ? e.message : "internal_error";
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
