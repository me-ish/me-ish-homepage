// src/app/api/aiPortfolio/draft/route.ts
import { NextResponse } from "next/server";
import { insertDraft } from "@/lib/aiPortfolio/aiPortfolio.db";
import type { FormInput } from "@/lib/aiPortfolio/aiPortfolio.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);

    if (!json?.email || typeof json.email !== "string") {
      return NextResponse.json(
        { ok: false, error: "email_required" },
        { status: 400 }
      );
    }

    // draft: 最低限（※insertDraft側が厳格バリデーションしているとここで落ちる可能性あり）
    const prompt: Partial<FormInput> = {
      email: json.email,
      name: typeof json.name === "string" ? json.name : "",
    };

    const record = await insertDraft({
      email: json.email,
      // 型はPartialだが、insertDraftの型都合で必要なら any で渡す
      prompt: prompt as any,
    });

    return NextResponse.json(
      { ok: true, requestId: record.id },
      { status: 200 }
    );
  } catch (e: any) {
    // ✅ これを入れないと Vercel で “何も出ない 500” になりがち
    console.error("[POST /api/aiPortfolio/draft] failed:", e);

    // Zod等のバリデーション例外が見えるよう、メッセージだけ返す（本番なら必要に応じてマスク）
    const message =
      typeof e?.message === "string" ? e.message : "internal_error";

    return NextResponse.json(
      { ok: false, error: "internal_error", message },
      { status: 500 }
    );
  }
}
