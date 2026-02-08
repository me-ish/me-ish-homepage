// src/app/api/webhook/stripe/route.ts
// =============================================================================
// Stripe Webhook 統合エンドポイント（Source of Truth）
// - ギャラリー購入（entries）と AURA購入（aura_requests）を両方処理
// - Stripe Dashboard の Webhook 送信先: /api/webhook/stripe
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { issueReissueLink } from "@/lib/coa/server";
import { getSiteUrl } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 署名検証だけなので apiVersion 指定は必須ではないが、警告回避したい場合は指定しても良い
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * 内部メール送信API呼び出し
 */
async function sendEmailInternal(
  kind: "purchaseBuyer" | "purchaseArtist",
  to: string,
  payload: Record<string, unknown>
): Promise<void> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    return;
  }
  const url = `${getSiteUrl()}/api/send-email/${kind}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-meish-admin-token": token,
    },
    body: JSON.stringify({ to, ...payload }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`sendEmail(${kind}) failed: ${res.status} ${text}`);
  }
}

function isUuidLike(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isEntryIdLike(v: string): boolean {
  return /^\d+$/.test(v);
}

/**
 * Stripe Webhook POST（署名検証必須）
 *
 * 対象イベント:
 * - checkout.session.completed
 * - checkout.session.async_payment_succeeded
 *
 * 分岐条件:
 * - AURA: metadata.kind === "aura" && metadata.requestId が UUID
 * - Gallery: metadata.entryId が数字（bigint）
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[webhook/stripe] missing stripe-signature header");
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  // 署名検証には raw body が必要
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook/stripe] signature_verification_failed:", message);
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }


  const isTarget =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";

  if (!isTarget) {
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const isPaid =
    session.payment_status === "paid" ||
    (session.status === "complete" && session.payment_status !== "unpaid");

  if (!isPaid) {
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }

  const kind = String(session.metadata?.kind ?? "");
  const entryId = String(session.metadata?.entryId ?? "");
  const requestId = String(session.metadata?.requestId ?? "");

  // AURA purchase
  if (kind === "aura" && requestId && isUuidLike(requestId)) {
    return handleAuraPurchase(event.id, session, requestId);
  }

  // Entry plan purchase
  if (kind === "entry_plan" && entryId && isEntryIdLike(entryId)) {
    return handleEntryPlanPurchase(event.id, session, entryId);
  }

  // ギャラリー購入
  if (entryId && isEntryIdLike(entryId)) {
    const rawQty = parseInt(session.metadata?.quantity ?? "1", 10);
    const quantity = Math.max(1, Math.min(99, Number.isFinite(rawQty) ? rawQty : 1));
    return handleGalleryPurchase(event.id, session, entryId, quantity);
  }

  return NextResponse.json({ ok: true, received: true }, { status: 200 });
}

/**
 * AURA購入処理
 * - aura_requests.payment_status を paid に更新
 * - 冪等性: 既に paid なら何もしない
 */

async function handleEntryPlanPurchase(
  eventId: string,
  session: Stripe.Checkout.Session,
  entryId: string
): Promise<NextResponse> {
  const admin = supabaseAdmin();

  try {
    const id = Number(entryId);
    const { data: rec, error: selErr } = await admin
      .from("entries")
      .select("id, plan_payment_status")
      .eq("id", id)
      .maybeSingle();

    if (selErr || !rec) {
      console.error("[webhook/stripe/entry-plan] entry not found:", {
        eventId,
        sessionId: session.id,
        entryId,
        error: selErr,
      });
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    const alreadyPaid = String(rec.plan_payment_status ?? "").toLowerCase() === "paid";
    if (alreadyPaid) {
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    const { error: updErr } = await admin
      .from("entries")
      .update({
        plan_payment_status: "paid",
        plan_payment_paid_at: new Date().toISOString(),
        plan_payment_session_id: session.id,
      })
      .eq("id", id);

    if (updErr) {
      console.error("[webhook/stripe/entry-plan] update failed:", {
        eventId,
        sessionId: session.id,
        entryId,
        error: updErr,
      });
    }

    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/entry-plan] exception:", {
      eventId,
      sessionId: session.id,
      entryId,
      error: message,
    });
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }
}

async function handleAuraPurchase(
  eventId: string,
  session: Stripe.Checkout.Session,
  requestId: string
): Promise<NextResponse> {
  const admin = supabaseAdmin();

  try {
    const { data: rec, error: selErr } = await admin
      .from("aura_requests")
      .select("id, payment_status, stripe_session_id")
      .eq("id", requestId)
      .maybeSingle();

    if (selErr || !rec) {
      console.error("[webhook/stripe/aura] request not found:", {
        eventId,
        sessionId: session.id,
        requestId,
        error: selErr,
      });
      // 見つからなくても 200（再送ループ回避）
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    const alreadyPaid = String(rec.payment_status ?? "").toLowerCase() === "paid";
    if (alreadyPaid) {
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    const { error: updErr } = await admin
      .from("aura_requests")
      .update({
        payment_status: "paid",
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updErr) {
      console.error("[webhook/stripe/aura] update failed:", {
        eventId,
        sessionId: session.id,
        requestId,
        error: updErr,
      });
      // 200返す（Stripe再送で復旧の可能性）
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/aura] exception:", {
      eventId,
      sessionId: session.id,
      requestId,
      error: message,
    });
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }
}

/**
 * ギャラリー購入処理
 * - finalize_sale RPC で原子的に edition_sold を加算（※DB側で session 冪等化するのが理想）
 * - sales テーブルに記録（冪等性キー: stripe_session_id）
 */
async function handleGalleryPurchase(
  eventId: string,
  session: Stripe.Checkout.Session,
  entryId: string, // bigint文字列
  quantity: number
): Promise<NextResponse> {
  const admin = supabaseAdmin();

  try {
    // 任意：軽い冪等チェック（DB関数側で冪等化できているなら必須ではない）
    const { data: existing, error: checkErr } = await admin
      .from("sales")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (checkErr) {
      console.error("[webhook/stripe/gallery] idempotency check failed:", {
        eventId,
        sessionId: session.id,
        error: checkErr,
      });
    } else if (existing) {
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    const buyerEmail = session.customer_details?.email ?? session.customer_email ?? null;
    const price = session.amount_total ?? null;

    // 手数料・報酬を計算（JPY = zero-decimal）
    const meishFeeYen = price != null ? Math.floor(price * 0.1) : null;
    const artistRewardYen = price != null && meishFeeYen != null ? price - meishFeeYen : null;

    // finalize_sale RPC（p_price を渡して fee/reward も DB 側で設定）
    const { data: rpcResult, error: rpcErr } = await admin.rpc("finalize_sale", {
      p_entry_id: entryId, // stringでもbigintに解釈される（DB側がbigint）
      p_quantity: quantity,
      p_session_id: session.id,
      p_price: price,
    });

    if (rpcErr) {
      console.error("[webhook/stripe/gallery] finalize_sale RPC failed:", {
        eventId,
        sessionId: session.id,
        entryId: entryId.toString(),
        quantity,
        error: rpcErr,
      });
      // sold out 等でも 200（運用判断）
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    // ✅ 推奨：DB関数内で sales を確保する設計の場合は update が基本
    // ただし現時点の移行中でも壊れないように、
    // updateが0件になり得るケースを upsert で救済する。
    const { data: updData, error: updErr } = await admin
      .from("sales")
      .update({
        buyer_email: buyerEmail,
        price,
        meish_fee_yen: meishFeeYen,
        artist_reward_yen: artistRewardYen,
        payout_status: "pending",
        purchased_at: new Date().toISOString(),
        metadata: {
          event_id: eventId,
          quantity,
          session_status: session.status,
          payment_status: session.payment_status,
          rpc_result: rpcResult,
        },
      })
      .eq("stripe_session_id", session.id)
      .select("id"); // 0件判定のため

    if (updErr) {
      console.error("[webhook/stripe/gallery] sales update failed:", {
        eventId,
        sessionId: session.id,
        error: updErr,
      });
      // 再送ループ回避のため ACK
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    if (!updData || updData.length === 0) {
      // まだDB側で sales を作っていない等のケース救済（UNIQUEが必須）
      const { error: upsertErr } = await admin
        .from("sales")
        .upsert(
          {
            entry_id: entryId,
            stripe_session_id: session.id,
            buyer_email: buyerEmail,
            price,
            meish_fee_yen: meishFeeYen,
            artist_reward_yen: artistRewardYen,
            payout_status: "pending",
            purchased_at: new Date().toISOString(),
            metadata: {
              event_id: eventId,
              quantity,
              session_status: session.status,
              payment_status: session.payment_status,
              rpc_result: rpcResult,
            },
          },
          { onConflict: "stripe_session_id" }
        );

      if (upsertErr) {
        console.error("[webhook/stripe/gallery] sales upsert failed:", {
          eventId,
          sessionId: session.id,
          error: upsertErr,
        });
        // ここもACK（DBを直して後で修復）
        return NextResponse.json({ ok: true, received: true }, { status: 200 });
      }
    }

    const newSold =
      Array.isArray(rpcResult) && rpcResult[0] ? rpcResult[0].new_edition_sold : "unknown";
    const soldOut =
      Array.isArray(rpcResult) && rpcResult[0] ? rpcResult[0].sold_out : false;


    // ========================================
    // 購入通知メール送信
    // ========================================
    try {
      // 作品情報を取得
      const { data: entry } = await admin
        .from("entries")
        .select("title, user_id, edition_total")
        .eq("id", entryId)
        .single();

      if (entry) {
        const buyerEmail = session.customer_details?.email ?? session.customer_email;
        const buyerName =
          session.customer_details?.name ?? buyerEmail?.split("@")[0] ?? "お客様";
        const priceYen = price != null ? Math.round(price) : undefined; // JPY = zero-decimal

        // アーティスト情報を取得
        const { data: artistProfile } = await admin
          .from("profiles")
          .select("display_name")
          .eq("id", entry.user_id)
          .single();

        // アーティストのメールアドレスを取得（auth.users）
        const { data: artistAuthData } = await admin.auth.admin.getUserById(
          entry.user_id
        );
        const artistEmail = artistAuthData?.user?.email ?? null;
        const artistName = artistProfile?.display_name ?? "アーティスト";

        // 購入者へメール送信
        if (buyerEmail) {
          // COAリンク発行（証明書 + ダウンロードリンク付き）
          let certificateUrl: string | undefined;
          try {
            certificateUrl = await issueReissueLink(Number(entryId));
          } catch (coaErr) {
            console.error("[webhook/stripe/gallery] COA link issue failed:", coaErr);
          }

          // 領収書URL
          const receiptUrl = `${getSiteUrl()}/receipt/${session.id}`;

          await sendEmailInternal("purchaseBuyer", buyerEmail, {
            name: buyerName,
            title: entry.title,
            artistName,
            priceYen,
            editionNo: typeof newSold === "number" ? newSold : undefined,
            editionTotal: entry.edition_total,
            orderId: session.id,
            certificateUrl,
            receiptUrl,
          });
        }

        // アーティストへメール送信
        if (artistEmail) {
          await sendEmailInternal("purchaseArtist", artistEmail, {
            name: artistName,
            title: entry.title,
            priceYen,
            editionNo: typeof newSold === "number" ? newSold : undefined,
            editionTotal: entry.edition_total,
            orderId: session.id,
            manageUrl: `${getSiteUrl()}/mypage`,
          });
        }
      }
    } catch (emailErr: unknown) {
      // メール送信失敗でもWebhookは成功扱い（DB処理は完了済み）
      const emailErrMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error("[webhook/stripe/gallery] email sending failed:", {
        eventId,
        sessionId: session.id,
        error: emailErrMsg,
      });
    }

    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/gallery] exception:", {
      eventId,
      sessionId: session.id,
      entryId: entryId.toString(),
      error: message,
    });
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }
}

// GET は 405（Webhookは POST のみ）
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Stripe webhooks require POST." },
    { status: 405 }
  );
}
