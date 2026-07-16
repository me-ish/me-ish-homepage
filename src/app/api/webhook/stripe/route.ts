// src/app/api/webhook/stripe/route.ts
// =============================================================================
// Stripe Webhook 統合エンドポイント（Source of Truth）
// - ギャラリー購入（entries）と AURA購入（aura_requests）を両方処理
// - Stripe Dashboard の Webhook 送信先: /api/webhook/stripe
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { issueReissueLink } from "@/lib/coa/server";
import { getSiteUrl, calcFee, calcReward } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  claimStripeEvent,
  releaseStripeEvent,
} from "@/lib/stripe/processedEvents";
import { markNatoriCommissionPaid } from "@/features/natori/server/orderMailService";

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

  // イベント単位の dedup。同一 event.id の再送・同時配送は最初の1リクエスト
  // だけが処理権を得る。処理が一時エラーで失敗した経路では releaseStripeEvent で
  // 行を消してから 500 を返し、Stripe の再送でリトライさせる。
  const claim = await claimStripeEvent(event.id);
  if (claim === "duplicate") {
    return NextResponse.json(
      { ok: true, received: true, deduped: true },
      { status: 200 }
    );
  }
  if (claim === "error") {
    // dedup 行は入っていないので、500 で再送させれば取りこぼさない
    return NextResponse.json({ ok: false, error: "dedup_failed" }, { status: 500 });
  }

  const kind = String(session.metadata?.kind ?? "");
  const entryId = String(session.metadata?.entryId ?? "");
  const requestId = String(session.metadata?.requestId ?? "");

  // AURA purchase
  if (kind === "aura" && requestId && isUuidLike(requestId)) {
    return handleAuraPurchase(event.id, session, requestId);
  }

  // CARD purchase
  if (kind === "card" && requestId && isUuidLike(requestId)) {
    return handleCardPurchase(event.id, session, requestId);
  }

  // ナトリのコミッション入金（支払い依頼メールの Payment Link 経由）
  const natoriProjectId = String(session.metadata?.projectId ?? "");
  if (kind === "natori_commission" && natoriProjectId && isUuidLike(natoriProjectId)) {
    return handleNatoriCommissionPayment(event.id, session, natoriProjectId);
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
 * ナトリのコミッション入金処理
 * - natori_projects に payment_confirmed_at を記録し rough（作業開始）へ進める
 * - ナトリ宛に入金通知メールを送る
 * - 冪等性: `payment_confirmed_at IS NULL` 条件の原子的 UPDATE（orderMailService 側）
 * - 一時的な DB エラーは claim を解放して 500（Stripe に再送させる）。
 *   対象行なしは恒久エラーなので 200 ACK。
 */
async function handleNatoriCommissionPayment(
  eventId: string,
  session: Stripe.Checkout.Session,
  projectId: string
): Promise<NextResponse> {
  try {
    const result = await markNatoriCommissionPaid(projectId, session.id, session.amount_total);
    if (result.kind === "db-error") {
      console.error("[webhook/stripe/natori-commission] mark paid failed:", {
        eventId,
        sessionId: session.id,
        projectId,
        result: result.kind,
      });
      await releaseStripeEvent(eventId);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }
    if (result.kind === "not-found") {
      console.error("[webhook/stripe/natori-commission] project not found:", {
        eventId,
        sessionId: session.id,
        projectId,
      });
    }
    if (result.kind === "amount-mismatch") {
      // 恒久エラー扱い（再送されても金額は変わらない）。管理者への要確認
      // 通知とnote への警告は orderMailService 側で実施済み。
      console.error("[webhook/stripe/natori-commission] amount mismatch:", {
        eventId,
        sessionId: session.id,
        projectId,
        amountTotal: session.amount_total,
      });
    }
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/natori-commission] exception:", {
      eventId,
      sessionId: session.id,
      projectId,
      error: message,
    });
    await releaseStripeEvent(eventId);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
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
    // 未払い行だけを対象にした条件付き UPDATE。二重配送がレースしても
    // 更新できるのは1リクエストだけ（select での事前判定はしない）。
    const { data: updated, error: updErr } = await admin
      .from("entries")
      .update({
        plan_payment_status: "paid",
        plan_payment_paid_at: new Date().toISOString(),
        plan_payment_session_id: session.id,
      })
      .eq("id", Number(entryId))
      .or("plan_payment_status.is.null,plan_payment_status.neq.paid")
      .select("id");

    if (updErr) {
      console.error("[webhook/stripe/entry-plan] update failed:", {
        eventId,
        sessionId: session.id,
        entryId,
        error: updErr,
      });
      await releaseStripeEvent(eventId);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      // already-paid か対象行なし。どちらも恒久なので ACK（ログで追跡）
      console.log("[webhook/stripe/entry-plan] skipped (already paid or missing):", {
        eventId,
        sessionId: session.id,
        entryId,
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
    await releaseStripeEvent(eventId);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}

async function handleAuraPurchase(
  eventId: string,
  session: Stripe.Checkout.Session,
  requestId: string
): Promise<NextResponse> {
  const admin = supabaseAdmin();

  try {
    // 未払い行だけを対象にした条件付き UPDATE（select での事前判定はしない）。
    // 注: aura_requests に stripe_session_id 列は存在しない（型再生成で発覚）。
    // 以前は存在しない列を含む update が常に失敗し、paid 反映されないバグだった。
    const { data: updated, error: updErr } = await admin
      .from("aura_requests")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .neq("payment_status", "paid")
      .select("id");

    if (updErr) {
      console.error("[webhook/stripe/aura] update failed:", {
        eventId,
        sessionId: session.id,
        requestId,
        error: updErr,
      });
      await releaseStripeEvent(eventId);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      // already-paid か対象行なし。どちらも恒久なので ACK（ログで追跡）
      console.log("[webhook/stripe/aura] skipped (already paid or missing):", {
        eventId,
        sessionId: session.id,
        requestId,
      });
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
    await releaseStripeEvent(eventId);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}

/**
 * CARD購入処理
 * - card_requests.payment_status を paid に更新
 * - 冪等性: 未払い行だけを対象にした条件付き UPDATE
 */
async function handleCardPurchase(
  eventId: string,
  session: Stripe.Checkout.Session,
  requestId: string
): Promise<NextResponse> {
  const admin = supabaseAdmin();

  try {
    // payment_status は nullable なので is.null も未払い扱いに含める
    const { data: updated, error: updErr } = await admin
      .from("card_requests")
      .update({
        payment_status: "paid",
        stripe_session_id: session.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .or("payment_status.is.null,payment_status.neq.paid")
      .select("id");

    if (updErr) {
      console.error("[webhook/stripe/card] update failed:", {
        eventId,
        sessionId: session.id,
        requestId,
        error: updErr,
      });
      await releaseStripeEvent(eventId);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      console.log("[webhook/stripe/card] skipped (already paid or missing):", {
        eventId,
        sessionId: session.id,
        requestId,
      });
    }

    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/card] exception:", {
      eventId,
      sessionId: session.id,
      requestId,
      error: message,
    });
    await releaseStripeEvent(eventId);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}

/**
 * ギャラリー購入処理
 * - finalize_sale RPC が DB 側で stripe_session_id を冪等キーに原子化済み
 *   （ON CONFLICT DO NOTHING で確保できた場合のみ edition_sold を加算）
 * - 手前の sales select は早期 return 用の最適化で、正しさは RPC 側が担保
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
    const meishFeeYen = price != null ? calcFee(price) : null;
    const artistRewardYen = price != null ? calcReward(price) : null;

    // finalize_sale RPC（p_price を渡して fee/reward も DB 側で設定）
    const { data: rpcResult, error: rpcErr } = await admin.rpc("finalize_sale", {
      p_entry_id: Number(entryId),
      p_quantity: quantity,
      p_session_id: session.id,
      p_price: price ?? 0,
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
            entry_id: Number(entryId),
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
        .eq("id", Number(entryId))
        .single();

      if (entry && entry.user_id) {
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
    // 一時障害の可能性が高いので claim を解放して再送させる
    // （finalize_sale が session 冪等なので再実行しても二重加算しない）
    await releaseStripeEvent(eventId);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}

// GET は 405（Webhookは POST のみ）
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Stripe webhooks require POST." },
    { status: 405 }
  );
}
