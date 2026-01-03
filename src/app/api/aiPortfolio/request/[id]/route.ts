import { NextResponse } from "next/server";
import { findRequest } from "@/lib/aiPortfolio/aiPortfolio.db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rec = await findRequest(params.id);

    // レコードなし → まだINSERT前 or 伝播遅延（基本は pending 扱い）
    if (!rec) {
      return NextResponse.json({ ok: true, status: "pending" }, { status: 200 });
    }

    // 明確な失敗（待機UIがメッセージを出せるように）
    if (rec.status === "error") {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          error: rec.error ?? "generation_failed",
        },
        { status: 200 }
      );
    }

// 準備完了：design/content が揃っていることを条件にする（status文字列には依存しない）
if (rec.design && rec.content) {
  return NextResponse.json({ ok: true, status: "ready" }, { status: 200 });
}


    // それ以外は pending（例：pending のまま、または中途半端に更新された等）
    return NextResponse.json({ ok: true, status: "pending" }, { status: 200 });
  } catch (e: any) {
    console.error("[AI_PORTFOLIO_REQUEST_GET_ERROR]", e);
    return NextResponse.json(
      { ok: false, status: "error", error: "internal_error" },
      { status: 200 }
    );
  }
}
