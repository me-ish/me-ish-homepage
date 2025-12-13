// src/app/api/aiPortfolio/form/submit/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  FormInputSchema,
  type FormInput,
  type Design,
  type Content,
} from "@/lib/aiPortfolio/aiPortfolio.schema";
import {
  insertDraft,
  updateGenerated,
} from "@/lib/aiPortfolio/aiPortfolio.db";
import { generatePortfolioFromForm } from "@/lib/aiPortfolio/aiPortfolio.generate";

/**
 * GET: OpenAI 接続テスト用エンドポイント
 *
 * 例）http://localhost:3000/api/aiPortfolio/form/submit?test_openai=1
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  // test_openai=1 のときだけ接続テスト。それ以外は 404 にしておく
  if (url.searchParams.get("test_openai") !== "1") {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const client = new OpenAI({
    apiKey,
    timeout: 10_000, // 10秒で諦める
    maxRetries: 0,    // リトライしない
  });

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: "返事は一言で「OK」とだけ返してください。",
        },
      ],
    });

    const text = res.choices[0]?.message?.content ?? "";

    return NextResponse.json(
      {
        ok: true,
        result: text,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[aiPortfolio/form/submit][GET test_openai] error", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 本来のフォーム送信 → 生成フロー
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);

  // フォームの中身を Zod で検証
  const parsed = FormInputSchema.safeParse(json);
  if (!parsed.success) {
    console.error(
      "aiPortfolio: invalid form payload",
      parsed.error.issues,
      json
    );
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const formInput: FormInput = parsed.data;

  // 1) draft レコードを作成（id 発行）
  const draft = insertDraft({
    email: formInput.email,
    prompt: formInput,
  });

  try {
    // 2) OpenAI + variant ロジックで Design / Content 生成
    const { design, content } = await generatePortfolioFromForm(formInput);

    // 3) 生成結果を保存（status: generated）
    updateGenerated(draft.id, { design, content });

    // クライアントには id と status だけ返せばOK（プレビューで再取得）
    return NextResponse.json({
      ok: true,
      id: draft.id,
      status: "generated",
    });
  } catch (e: any) {
    console.error("[aiPortfolio/form/submit] generate error", e);
    return NextResponse.json(
      { error: "generate_failed", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
