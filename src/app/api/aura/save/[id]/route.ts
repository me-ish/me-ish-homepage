// src/app/api/aura/save/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { ContentSchema } from "@/lib/aura/aura.schema";
import { publishContent } from "@/lib/aura/aura.db";
import { claimMeishFree, claimFirst20Free } from "@/lib/aura/auraBillingGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuraRequestAccess } from "@/lib/aura/requireAuraAccess";
import { checkCsrf } from "@/lib/auth/csrf";
import { isAdminEmailAsync } from "@/lib/isAdmin";

async function getSessionUserEmail(): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    const cookieStore = cookies();
    const sb = createClient(url, anonKey, {
      global: { headers: { cookie: cookieStore.toString() } },
    });
    const { data } = await sb.auth.getUser();
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

type Params = { id: string };

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Params }) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const id = params.id;

  try {
    // ✅ 1) 所有権チェック（cookie aura_st_{id} → DB session_token 照合）
    // - これが通らない限り、以降の publish / paid化 / 無料枠消費 を一切させない
    const access = await requireAuraRequestAccess(id, req);
    if (!access.ok) return access.response;
    const rec = access.rec;

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

    // sectionOrder は任意（最大20セクション、各64文字以内）
    const rawOrder = (json as any).sectionOrder;
    const sectionOrder = Array.isArray(rawOrder)
      && rawOrder.length <= 20
      && rawOrder.every((s: unknown) => typeof s === "string" && s.length <= 64)
      ? (rawOrder as string[])
      : undefined;

    // =========================================================
    // 4) PUBLISH GATE（無料 or 支払い済みのみ publish を許可）
    //    - 既に published_at がある場合は「更新扱い」で再課金しない
    // =========================================================
    const alreadyPublished = Boolean((rec as any).published_at ?? (rec as any).publishedAt);

    // デバッグログ: 課金ゲート状態

    if (!alreadyPublished) {
      const email = ((rec as any).email as string | null) ?? null;
      const paymentStatus = (((rec as any).payment_status as string | null) ?? "unpaid").toLowerCase();

      let allowed = paymentStatus === "paid";

      // 0) 管理者は決済スルー（セッションのメールで判定）
      if (!allowed) {
        const sessionEmail = await getSessionUserEmail();
        if (sessionEmail && await isAdminEmailAsync(sessionEmail)) {
          await supabaseAdmin()
            .from("aura_requests")
            .update({ payment_status: "paid", updated_at: new Date().toISOString() })
            .eq("id", id);
          allowed = true;
        }
      }

      if (!allowed && email) {

        // 1) me-ish採用（entries.confirmed=true）で 1回無料
        const meishResult = await claimMeishFree(email, id);

        if (meishResult.success) {
          const admin = supabaseAdmin();
          await admin
            .from("aura_requests")
            .update({ payment_status: "paid", updated_at: new Date().toISOString() })
            .eq("id", id);

          allowed = true;
        }

        // 2) 先着20名無料
        if (!allowed) {
          const first20Result = await claimFirst20Free(email, id);

          if (first20Result.success) {
            const admin = supabaseAdmin();
            await admin
              .from("aura_requests")
              .update({ payment_status: "paid", updated_at: new Date().toISOString() })
              .eq("id", id);

            allowed = true;
          }
        }

        if (!allowed) {
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
      console.error("[aura/save] publish_failed:no_record", {
        id,
        slug,
        publicId,
        publicSlug,
      });
      return NextResponse.json({ ok: false, error: "publish_failed" }, { status: 500 });
    }

    // ✅ public_slug方式：公開URLは publicSlug を必須にする
    if (!publicSlug) {
      console.error("[aura/save] publish_failed:no_public_slug", {
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
  } catch (e: unknown) {
    console.error("[aura/save] unexpected_error", { id, error: e });
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
