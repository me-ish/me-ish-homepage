// src/app/api/aiPortfolio/request/[id]/route.ts
import { NextResponse } from "next/server";
import { findRequest } from "@/lib/aiPortfolio/aiPortfolio.db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rec = await findRequest(params.id);

    // レコードそのものが無い → まだ生成前 or 何かおかしい
    if (!rec) {
      return NextResponse.json(
        { ok: false, status: "pending" },
        { status: 200 }
      );
    }

    // 生成完了（preview SSR の条件と揃える）
    if (rec.status === "generated" && rec.design && rec.content) {
      return NextResponse.json(
        { ok: true, status: "ready" },
        { status: 200 }
      );
    }

    // draft / paid / published など、目的に応じて扱いを分けたい場合はここでハンドリング
    // ひとまず draft の間は pending 扱いにしておく
    if (rec.status === "draft") {
      return NextResponse.json(
        { ok: false, status: "pending" },
        { status: 200 }
      );
    }

    // その他の状態（エラー or 仕様外）は error 扱い
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        error: `unexpected_status:${rec.status}`,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[AI_PORTFOLIO_REQUEST_GET_ERROR]", e);
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        error: "internal_error",
      },
      { status: 200 }
    );
  }
}
