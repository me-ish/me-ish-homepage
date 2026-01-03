// src/app/api/aiPortfolio/draft/route.ts
import { NextResponse } from "next/server";
import { insertDraft } from "@/lib/aiPortfolio/aiPortfolio.db";
import type { FormInput } from "@/lib/aiPortfolio/aiPortfolio.schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  if (!json?.email) {
    return NextResponse.json(
      { ok: false, error: "email_required" },
      { status: 400 }
    );
  }

  // 最低限だけ入れて draft を作る
  const prompt: Partial<FormInput> = {
    email: json.email,
    name: json.name ?? "",
  };

  const record = await insertDraft({
    email: json.email,
    prompt: prompt as FormInput,
  });

  return NextResponse.json(
    { ok: true, requestId: record.id },
    { status: 200 }
  );
}
