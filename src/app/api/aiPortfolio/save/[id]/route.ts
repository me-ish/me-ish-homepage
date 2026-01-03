// src/app/api/aiPortfolio/save/[id]/route.ts
import { NextResponse } from "next/server";
import { ContentSchema } from "@/lib/aiPortfolio/aiPortfolio.schema";
import { findRequest, publishContent } from "@/lib/aiPortfolio/aiPortfolio.db";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { id: string };

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Params }) {
  const id = params.id;

  try {
    // 1) 既存レコード確認
    const rec = await findRequest(id);
    if (!rec) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // 2) JSON 読み取り
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    // 3) content validate（必須）
    if (!("content" in json)) {
      return NextResponse.json({ ok: false, error: "missing_content" }, { status: 400 });
    }

    const parsed = ContentSchema.safeParse((json as any).content);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_content", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const content = parsed.data;

    // sectionOrder は任意
    const sectionOrder = Array.isArray((json as any).sectionOrder)
      ? ((json as any).sectionOrder as string[])
      : undefined;

    // =========================================================
    // 4) PUBLISH GATE（無料 or 支払い済みのみ publish を許可）
    //    - 既に published_at がある場合は「更新扱い」で再課金しない
    // =========================================================
    const alreadyPublished = Boolean((rec as any).published_at ?? (rec as any).publishedAt);
    if (!alreadyPublished) {
      const email = ((rec as any).email as string | null) ?? null;
      const paymentStatus = (((rec as any).payment_status as string | null) ?? "unpaid").toLowerCase();

      let allowed = paymentStatus === "paid";

      if (!allowed && email) {
        const admin = supabaseAdmin();

// 1) me-ish採用（entries.confirmed=true）で 1回無料（消費できたら true）
const { data: meishOk } = await (admin as any).rpc("aura_claim_meish_free", {
  p_email: email,
});
allowed = meishOk === true;


// 2) 先着20名無料（消費できたら true）
if (!allowed) {
  const { data: first20Ok } = await (admin as any).rpc("aura_claim_first20", {
    p_email: email,
  });
  allowed = first20Ok === true;
}

      }

      if (!allowed) {
        const checkoutUrl = `/api/aura/checkout?requestId=${encodeURIComponent(id)}`;
        return NextResponse.json(
          { ok: false, error: "payment_required", checkoutUrl },
          { status: 402 },
        );
      }
    }

    // 5) publish（ここで public_id / public_slug / visibility / published_at も確定）
    const { record, slug, publicId, publicSlug } = await publishContent(
      id,
      content,
      sectionOrder,
    );

    if (!record) {
      console.error("[aiPortfolio/save] publish_failed:no_record", {
        id,
        slug,
        publicId,
        publicSlug,
      });
      return NextResponse.json({ ok: false, error: "publish_failed" }, { status: 500 });
    }

    // ✅ public_slug方式：公開URLは publicSlug を必須にする
    if (!publicSlug) {
      console.error("[aiPortfolio/save] publish_failed:no_public_slug", {
        id,
        status: record.status,
        slug,
        publicId,
        visibility: (record as any).visibility,
        publishedAt: (record as any).publishedAt,
      });

      return NextResponse.json(
        { ok: false, error: "publish_failed_no_public_slug" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        slug, // 互換で残してOK
        publicId: record.publicId,
        publicSlug: record.publicSlug,
        status: record.status,
      },
      { status: 200 },
    );
  } catch (e: any) {
    console.error("[aiPortfolio/save] unexpected_error", { id, error: e });
    return NextResponse.json(
      { ok: false, error: "internal_error", message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
