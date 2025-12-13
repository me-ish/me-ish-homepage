// src/app/api/aiPortfolio/save/[id]/route.ts
import { NextResponse } from "next/server";
import { ContentSchema } from "@/lib/aiPortfolio/aiPortfolio.schema";
import {
  findRequest,
  publishContent,
} from "@/lib/aiPortfolio/aiPortfolio.db";

/**
 * slugは publishContent 内で自動生成するので
 * ここでは id と content だけ受け取ればOK
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // もともと PreviewEditor から { content: next } で飛んでくる
    const body = await req.json();
    const parsedContent = ContentSchema.parse(body.content);

    // 既存レコード確認（存在しなければ404）
    const existing = findRequest(id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 }
      );
    }

    // 公開＋slug発行
    const { record, slug } = publishContent(id, parsedContent);

    if (!record || !slug) {
      return NextResponse.json(
        { ok: false, error: "publish_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: record.id,
      slug,
    });
  } catch (e: any) {
    console.error("[aiPortfolio/save] error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown_error" },
      { status: 400 }
    );
  }
}
