import "server-only";

// features/natori/server/orderMailService.ts
// 依頼者向けの見積もりメール・支払い依頼メールの送信と、Stripe 入金の案件反映。
//
// フロー:
//   フォーム依頼 (inquiry) → 見積もりメール送信 → quoted
//   → 依頼者から承諾の返信 → 支払い依頼メール送信（Stripe 支払いリンク自動生成）
//   → awaiting_payment → Stripe Webhook で入金確認 → rough（作業開始）
import { createHash, randomBytes, randomUUID } from "crypto";
import Stripe from "stripe";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteUrl } from "@/lib/constants";
import {
  DELIVERY_VALID_DAYS,
  QUOTE_VALID_DAYS,
  ROUGH_LINK_VALID_DAYS,
  buildOrderMailLogEntry,
  buildPaidConfirmationMail,
  injectAcceptLink,
  injectDeliveryLink,
  injectFilesLinks,
  injectPaymentLink,
} from "@/features/natori/lib/orderMail";
import { buildRoughFileLinkLines } from "@/features/natori/server/deliveryService";
import { getNextActionForStatus } from "@/features/natori/lib/projects";
import { canTransitionNatoriStatus } from "@/features/natori/lib/statusTransitions";
import { formatYen } from "@/features/natori/lib/pricing";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import type { NatoriProjectStatus } from "@/features/natori/types/projects";

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
/** 依頼者向けメールの差出人。env で上書き可能 */
const FROM = process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>";
/**
 * 依頼者が返信したときの宛先（＝ナトリのアドレス）。
 * フォーム通知の宛先と同じ env で上書きできる。
 */
const REPLY_TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";
/** 全 natori メールの BCC（me-ish 側で控えを残す用）。未設定なら BCC なし */
const BCC = process.env.NATORI_MAIL_BCC?.trim() || "";

export function isNatoriOrderMailConfigured(): boolean {
  return RESEND_API_KEY.length > 0;
}

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  client_name: string;
  amount: number;
  status: string;
  note: string | null;
  payment_confirmed_at?: string | null;
  payment_link_id?: string | null;
  quoted_amount?: number | null;
  client_email?: string | null;
  active_quote_id?: string | null;
  payment_quote_id?: string | null;
  payment_link_url?: string | null;
  payment_link_status?: string | null;
  stripe_payment_session_id?: string | null;
};

async function fetchProjectRow(
  projectId: string,
  ownerId?: string
): Promise<ProjectRow | null> {
  const admin = supabaseAdmin();
  let query = admin
    .from("natori_projects")
    .select(
      "id, user_id, title, client_name, amount, status, note, payment_confirmed_at, payment_link_id, quoted_amount, client_email, active_quote_id, payment_quote_id, payment_link_url, payment_link_status, stripe_payment_session_id"
    )
    .eq("id", projectId);
  if (ownerId) query = query.eq("user_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[natori-order-mail] project fetch failed", error);
    return null;
  }
  return (data as ProjectRow | null) ?? null;
}

function appendNote(note: string | null, entry: string): string {
  return note ? `${note}\n\n${entry}` : entry;
}

async function sendPlainMail(to: string, subject: string, body: string): Promise<boolean> {
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    ...(BCC ? { bcc: [BCC] } : {}),
    subject: subject.replace(/[\r\n]+/g, " ").slice(0, 200),
    text: body,
    replyTo: REPLY_TO,
    headers: { "X-Meish-Template": "natori-order-mail" },
  });
  if (error) {
    console.error("[natori-order-mail] send failed", error);
    return false;
  }
  return true;
}

/**
 * ナトリ宛の内部通知メール（見積もり承諾通知などで使う）。
 * 未設定なら false（呼び出し側はベストエフォート扱いにすること）。
 */
export async function sendNatoriNoticeMail(subject: string, body: string): Promise<boolean> {
  if (!isNatoriOrderMailConfigured()) return false;
  return sendPlainMail(REPLY_TO, subject, body);
}

export type SendNatoriOrderMailInput = {
  projectId: string;
  kind: "estimate" | "payment" | "rough" | "delivery";
  to: string;
  subject: string;
  body: string;
  /** 送信時に案件へ保存する確定金額（円）。rough / delivery では金額は更新しない */
  amount: number;
};

export type SendNatoriOrderMailResult =
  | { kind: "ok"; paymentLinkUrl?: string }
  | { kind: "not-found" }
  | { kind: "not-configured" }
  | { kind: "no-files" }
  | { kind: "stripe-error" }
  | { kind: "mail-error" }
  | { kind: "db-error" }
  | { kind: "state-error-after-send"; paymentLinkUrl?: string }
  | { kind: "invalid-state" }
  | { kind: "quote-not-accepted" }
  | { kind: "amount-mismatch" }
  | { kind: "already-paid" };

/**
 * 送信後に進めるステータス。見積もり→提示済み、支払い依頼→入金待ち、
 * ラフ提出→返信待ち、納品→納品済み。進めてよいかは lib/statusTransitions の
 * 遷移表で判定する（既に先へ進んでいる案件への再送では巻き戻さない）。
 */
const NEXT_STATUS: Record<SendNatoriOrderMailInput["kind"], NatoriProjectStatus> = {
  estimate: "quoted",
  payment: "awaiting_payment",
  rough: "waiting",
  delivery: "delivered",
};

const ALLOWED_MAIL_STATUSES: Record<
  SendNatoriOrderMailInput["kind"],
  ReadonlySet<NatoriProjectStatus>
> = {
  estimate: new Set(["inquiry", "consulting", "estimating", "quoted"]),
  payment: new Set(["quoted", "awaiting_payment"]),
  rough: new Set(["rough", "lineart", "coloring", "waiting"]),
  delivery: new Set(["delivery_prep", "delivered"]),
};

type QuotePaymentRow = {
  id: string;
  amount: number;
  accepted_at: string | null;
  superseded_at: string | null;
};

async function fetchAcceptedQuote(project: ProjectRow): Promise<QuotePaymentRow | null> {
  if (!project.active_quote_id) return null;
  const { data, error } = await supabaseAdmin()
    .from("natori_quotes")
    .select("id, amount, accepted_at, superseded_at")
    .eq("id", project.active_quote_id)
    .eq("project_id", project.id)
    .maybeSingle();
  if (error) {
    console.error("[natori-order-mail] accepted quote fetch failed", error);
    return null;
  }
  const quote = (data as QuotePaymentRow | null) ?? null;
  if (!quote?.accepted_at || quote.superseded_at) return null;
  return quote;
}

export async function sendNatoriOrderMail(
  input: SendNatoriOrderMailInput
): Promise<SendNatoriOrderMailResult> {
  if (!isNatoriOrderMailConfigured()) return { kind: "not-configured" };

  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const project = await fetchProjectRow(input.projectId, ownerId);
  if (!project) return { kind: "not-found" };
  const projectStatus = project.status as NatoriProjectStatus;
  if (!ALLOWED_MAIL_STATUSES[input.kind].has(projectStatus)) {
    return { kind: "invalid-state" };
  }
  if (project.payment_confirmed_at && input.kind === "payment") {
    return { kind: "already-paid" };
  }
  if (project.payment_confirmed_at && input.kind === "estimate") {
    return { kind: "invalid-state" };
  }

  let body = input.body;
  let quoteId: string | undefined;
  let acceptedQuote: QuotePaymentRow | null = null;

  if (input.kind === "payment") {
    acceptedQuote = await fetchAcceptedQuote(project);
    if (!acceptedQuote) return { kind: "quote-not-accepted" };
    if (input.amount !== acceptedQuote.amount) return { kind: "amount-mismatch" };
    quoteId = acceptedQuote.id;
  }

  // 制作物の送信は入金確認済み案件だけに限定する。UIを迂回した直接API呼び出し
  // でも未入金のまま制作・納品工程へ進めない。
  if ((input.kind === "rough" || input.kind === "delivery") && !project.payment_confirmed_at) {
    return { kind: "invalid-state" };
  }

  // 見積もりのときはワンクリック承諾用のトークンを発行し、承諾ページURLを
  // 本文へ差し込む。DB にはトークンの SHA-256 ハッシュだけ保存する。
  // 再送（再見積もり）のたびに新しいトークンになり、旧リンクと過去の承諾は
  // 無効化される（支払いリンクの再発行と同じ思想）。
  let quoteTokenHash: string | undefined;
  let quoteTokenExpiresAt: string | undefined;
  if (input.kind === "estimate") {
    const token = randomBytes(32).toString("base64url");
    quoteTokenHash = createHash("sha256").update(token).digest("hex");
    quoteTokenExpiresAt = new Date(
      Date.now() + QUOTE_VALID_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    body = injectAcceptLink(body, `${getSiteUrl()}/natori/quote/${token}`);

    // 発行時点の件名・依頼者・金額・本文を不変スナップショットとして、メールを
    // 送る前に保存する。案件の金額を後から編集しても承諾内容は変わらない。
    const { data: issuedQuoteId, error: quoteError } = await supabaseAdmin().rpc(
      "natori_issue_quote",
      {
        p_user_id: ownerId,
        p_project_id: project.id,
        p_title: project.title,
        p_client_name: project.client_name,
        p_to_email: input.to,
        p_amount: input.amount,
        p_subject: input.subject,
        // 生の承諾トークンをDBへ残さないため、リンク差し込み前の本文を保存する。
        p_body_snapshot: input.body,
        p_token_hash: quoteTokenHash,
        p_expires_at: quoteTokenExpiresAt,
      }
    );
    if (quoteError || !issuedQuoteId) {
      console.error("[natori-order-mail] quote issue failed", quoteError);
      return { kind: "db-error" };
    }
    quoteId = String(issuedQuoteId);
  }

  // ラフ提出のときはラフ確認ファイルの署名URL（14日間有効）を本文へ差し込む。
  // ファイル未アップロードのまま送るとリンク無しメールになるので弾く。
  if (input.kind === "rough") {
    const lines = await buildRoughFileLinkLines(
      project.id,
      ROUGH_LINK_VALID_DAYS * 24 * 60 * 60
    );
    if (!lines) return { kind: "no-files" };
    body = injectFilesLinks(body, lines);
  }

  // 納品のときは納品ページ用トークンを発行し、ページURLを本文へ差し込む。
  // 再送のたびに新しいトークンになり、旧リンクと受け取り記録はリセットされる。
  let deliveryTokenHash: string | undefined;
  let deliveryTokenExpiresAt: string | undefined;
  if (input.kind === "delivery") {
    const { count, error: fileCountError } = await supabaseAdmin()
      .from("natori_delivery_files")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("folder", "final");
    if (fileCountError) {
      console.error("[natori-order-mail] delivery file count failed", fileCountError);
      return { kind: "db-error" };
    }
    if ((count ?? 0) === 0) return { kind: "no-files" };

    const token = randomBytes(32).toString("base64url");
    deliveryTokenHash = createHash("sha256").update(token).digest("hex");
    deliveryTokenExpiresAt = new Date(
      Date.now() + DELIVERY_VALID_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    body = injectDeliveryLink(body, `${getSiteUrl()}/natori/delivery/${token}`);
  }

  // 支払い依頼のときは Stripe の支払いリンクを都度生成して本文へ差し込む
  let paymentLinkUrl: string | undefined;
  let paymentLinkId: string | undefined;
  if (input.kind === "payment") {
    // 同じ承諾済み見積もりへの再送は、既存の1回限りリンクを再利用する。
    // 新しいリンクを作るのは「別の承諾済み見積もり」になった場合だけ。
    const canReuseExisting =
      project.payment_quote_id === quoteId &&
      Boolean(project.payment_link_id) &&
      Boolean(project.payment_link_url) &&
      project.quoted_amount === input.amount &&
      project.payment_link_status !== "void" &&
      project.payment_link_status !== "paid";

    if (canReuseExisting) {
      paymentLinkId = project.payment_link_id ?? undefined;
      paymentLinkUrl = project.payment_link_url ?? undefined;
    } else {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return { kind: "not-configured" };
      const stripe = new Stripe(secretKey);

      // 発行中フラグを条件付きで確保し、同じ案件への並行発行を止める。
      const { data: claimed, error: claimError } = await supabaseAdmin()
        .from("natori_projects")
        .update({ payment_link_status: "issuing" })
        .eq("id", project.id)
        .eq("user_id", ownerId)
        .is("payment_confirmed_at", null)
        .or("payment_link_status.is.null,payment_link_status.neq.issuing")
        .select("id")
        .maybeSingle();
      if (claimError) {
        console.error("[natori-order-mail] payment link claim failed", claimError);
        return { kind: "db-error" };
      }
      if (!claimed) return { kind: "invalid-state" };

      if (project.payment_link_id) {
        try {
          await stripe.paymentLinks.update(project.payment_link_id, { active: false });
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code !== "resource_missing") {
            await supabaseAdmin()
              .from("natori_projects")
              .update({ payment_link_status: "send_failed" })
              .eq("id", project.id)
              .eq("user_id", ownerId);
            console.error("[natori-order-mail] old payment link deactivation failed", err);
            return { kind: "stripe-error" };
          }
        }
      }

      const idempotencyBase = `natori-plink:${project.id}:${quoteId}:${input.amount}`;
      try {
        const price = await stripe.prices.create(
          {
            currency: "jpy",
            unit_amount: input.amount,
            product_data: {
              name: `コミッション: ${project.title}（${project.client_name} 様）`,
            },
          },
          { idempotencyKey: `${idempotencyBase}:price` }
        );
        const link = await stripe.paymentLinks.create(
          {
            line_items: [{ price: price.id, quantity: 1 }],
            metadata: {
              kind: "natori_commission",
              projectId: project.id,
              quoteId: quoteId ?? "",
            },
            restrictions: { completed_sessions: { limit: 1 } },
            after_completion: {
              type: "hosted_confirmation",
              hosted_confirmation: {
                custom_message:
                  "お支払いありがとうございます。入金の確認が取れ次第、制作を開始しご連絡いたします。",
              },
            },
          },
          { idempotencyKey: `${idempotencyBase}:link` }
        );
        paymentLinkUrl = link.url;
        paymentLinkId = link.id;

        // 顧客へメールする前に、リンクと対応する見積版を永続化する。
        const { data: persisted, error: persistError } = await supabaseAdmin()
          .from("natori_projects")
          .update({
            payment_link_id: paymentLinkId,
            payment_link_url: paymentLinkUrl,
            payment_link_status: "ready",
            payment_quote_id: quoteId,
            quoted_amount: acceptedQuote?.amount ?? input.amount,
          })
          .eq("id", project.id)
          .eq("user_id", ownerId)
          .is("payment_confirmed_at", null)
          .eq("payment_link_status", "issuing")
          .select("id")
          .maybeSingle();
        if (persistError || !persisted) {
          console.error("[natori-order-mail] payment link persistence failed", persistError);
          // 同じ idempotency key の再試行で同じリンクを回収できるよう、ここでは
          // 無効化しない。発行状態だけ戻し、次回にDB保存を再試行させる。
          await supabaseAdmin()
            .from("natori_projects")
            .update({ payment_link_status: "send_failed" })
            .eq("id", project.id)
            .eq("user_id", ownerId)
            .eq("payment_link_status", "issuing");
          return { kind: "db-error" };
        }
      } catch (err) {
        await supabaseAdmin()
          .from("natori_projects")
          .update({ payment_link_status: "send_failed" })
          .eq("id", project.id)
          .eq("user_id", ownerId);
        console.error("[natori-order-mail] payment link creation failed", err);
        return { kind: "stripe-error" };
      }
    }

    if (!paymentLinkUrl) return { kind: "db-error" };
    body = injectPaymentLink(body, paymentLinkUrl);
  }

  const admin = supabaseAdmin();

  // トークン・決済リンクなど、メール内の導線を先に永続化する。ここで失敗した
  // 場合はメールを送らないため、「届いたリンクがDBに無い」状態を作らない。
  const preSendProjectUpdate: Record<string, unknown> = { client_email: input.to };
  if (input.kind === "delivery" && deliveryTokenHash) {
    preSendProjectUpdate.delivery_token_hash = deliveryTokenHash;
    preSendProjectUpdate.delivery_token_expires_at = deliveryTokenExpiresAt;
    preSendProjectUpdate.delivery_accepted_at = null;
  }
  if (input.kind === "payment") {
    preSendProjectUpdate.payment_link_status = "ready";
  }
  const { error: preSendError } = await admin
    .from("natori_projects")
    .update(preSendProjectUpdate)
    .eq("id", project.id)
    .eq("user_id", ownerId);
  if (preSendError) {
    console.error("[natori-order-mail] pre-send project persistence failed", preSendError);
    return { kind: "db-error" };
  }

  // 送信試行もメールより先に durable log へ残す。本文は生成リンク差し込み前を
  // 保存し、承諾トークンや納品トークンの平文をDBへ残さない。
  const requestId = randomUUID();
  const { error: logError } = await admin.from("natori_order_mail_logs").insert({
    request_id: requestId,
    project_id: project.id,
    kind: input.kind,
    to_email: input.to,
    amount: input.amount,
    link_url: paymentLinkUrl ?? null,
    quote_id: quoteId ?? null,
    subject: input.subject,
    body_snapshot: input.body,
    status: "pending",
    sent_at: null,
  });
  if (logError) {
    console.error("[natori-order-mail] mail log insert failed", logError);
    if (input.kind === "payment") {
      await admin
        .from("natori_projects")
        .update({ payment_link_status: "send_failed" })
        .eq("id", project.id)
        .eq("user_id", ownerId);
    }
    return { kind: "db-error" };
  }

  const mailed = await sendPlainMail(input.to, input.subject, body);
  if (!mailed) {
    await admin
      .from("natori_order_mail_logs")
      .update({ status: "failed", error_message: "resend_send_failed", updated_at: new Date().toISOString() })
      .eq("request_id", requestId);
    if (input.kind === "payment") {
      await admin
        .from("natori_projects")
        .update({ payment_link_status: "send_failed" })
        .eq("id", project.id)
        .eq("user_id", ownerId);
    }
    return { kind: "mail-error" };
  }

  await admin
    .from("natori_order_mail_logs")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("request_id", requestId);

  // 送信後の案件更新（金額・宛先・ステータス・履歴メモ）。メールは送れて
  // いるので、ここで失敗しても呼び出し側には db-error として伝えるだけに留める。
  const today = new Date().toISOString().slice(0, 10);
  const logEntry = buildOrderMailLogEntry(input.kind, today, input.to, input.amount, paymentLinkUrl);
  const nextStatus = NEXT_STATUS[input.kind];
  const update: Record<string, unknown> = {
    // 実際に送った宛先を正とする（手入力案件や宛先修正もここで反映される）
    client_email: input.to,
    note: appendNote(project.note, logEntry),
  };
  // 金額の更新は金額を連絡するメールのみ（ラフ提出・納品では触らない）
  if (input.kind === "estimate" || input.kind === "payment") {
    update.amount = input.amount;
  }
  if (
    project.status !== nextStatus &&
    canTransitionNatoriStatus(project.status as NatoriProjectStatus, nextStatus)
  ) {
    update.status = nextStatus;
    update.next_action = getNextActionForStatus(nextStatus);
  }
  if (input.kind === "payment" && paymentLinkId) update.payment_link_status = "sent";
  if (input.kind === "delivery" && deliveryTokenHash) {
    // 納品トークンを最新の納品メールに付け替え、過去の受け取り記録はリセットする
    update.delivered_mail_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("natori_projects")
    .update(update)
    .eq("id", project.id)
    .eq("user_id", ownerId);
  if (error) {
    console.error("[natori-order-mail] project update after send failed", error);
    await admin
      .from("natori_order_mail_logs")
      .update({ status: "state_error", error_message: "project_state_update_failed", updated_at: new Date().toISOString() })
      .eq("request_id", requestId);
    return { kind: "state-error-after-send", paymentLinkUrl };
  }

  return { kind: "ok", paymentLinkUrl };
}

export type MarkNatoriCommissionPaidResult =
  | { kind: "ok" }
  | { kind: "already-paid" }
  | { kind: "not-found" }
  | { kind: "amount-mismatch" }
  | { kind: "quote-mismatch" }
  | { kind: "db-error" };

/** 金額不一致の入金: DB関数で記録後、新規イベントだけナトリへ通知する。 */
async function handleAmountMismatch(
  project: ProjectRow,
  sessionId: string,
  amountTotal: number,
  shouldNotify: boolean
): Promise<MarkNatoriCommissionPaidResult> {
  const quotedText = formatYen(project.quoted_amount ?? 0);
  const receivedText = formatYen(amountTotal);

  if (shouldNotify && isNatoriOrderMailConfigured()) {
    const noticeBody = [
      "コミッションの入金がありましたが、金額が見積もりと一致しません。",
      "ステータスは変更していません。Stripe ダッシュボードで決済内容を確認してください。",
      "",
      `■ 案件: ${project.title}`,
      `■ 依頼者: ${project.client_name} 様`,
      `■ 受領金額: ${receivedText}`,
      `■ 見積金額: ${quotedText}`,
      `■ Stripe session: ${sessionId}`,
      "",
      "ダッシュボード: https://www.me-ish.art/natori/projects",
    ].join("\n");
    const sent = await sendPlainMail(
      REPLY_TO,
      `【要確認】入金金額が見積もりと一致しません / ${project.client_name} 様 / ${project.title}`,
      noticeBody
    );
    if (!sent) {
      console.error("[natori-order-mail] mismatch notice mail failed (ignored)");
    }
  }

  return { kind: "amount-mismatch" };
}

async function handleQuoteMismatch(
  project: ProjectRow,
  sessionId: string,
  amountTotal: number,
  receivedQuoteId: string | null,
  shouldNotify: boolean
): Promise<MarkNatoriCommissionPaidResult> {
  if (shouldNotify) {
    await sendNatoriNoticeMail(
      `【至急確認】旧見積もりへの入金 / ${project.client_name} 様`,
      [
        "現在の承諾済み見積もりとは異なる支払いリンクから入金がありました。",
        "制作開始には進めていません。Stripeで確認し、返金または個別対応してください。",
        "",
        `案件: ${project.title}`,
        `今回の見積ID: ${receivedQuoteId ?? "なし（旧リンク）"}`,
        `現在の見積ID: ${project.payment_quote_id ?? "不明"}`,
        `session: ${sessionId}`,
        `金額: ${formatYen(amountTotal)}`,
      ].join("\n")
    );
  }
  return { kind: "quote-mismatch" };
}

/**
 * Stripe Webhook からの入金反映。payment_confirmed_at を記録して rough
 * （作業開始）へ進め、ナトリ宛に入金通知メールを送る。
 *
 * 案件更新・金額照合・入金台帳は DB 関数の1トランザクションで処理する。
 * 同一 Checkout の再送は already-paid、別sessionは duplicate-paymentとなり、
 * 新規イベントのときだけ通知する。
 */
export async function markNatoriCommissionPaid(
  projectId: string,
  sessionId: string,
  amountTotal: number | null,
  quoteId: string | null = null
): Promise<MarkNatoriCommissionPaidResult> {
  // note 追記とメール本文のための読み取り。冪等判定には使わない。
  const project = await fetchProjectRow(projectId);
  if (!project) return { kind: "not-found" };

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("natori_record_stripe_payment", {
    p_project_id: projectId,
    p_session_id: sessionId,
    p_amount: amountTotal,
    p_quote_id: quoteId,
  });
  if (error) {
    console.error("[natori-order-mail] atomic payment record failed", error);
    return { kind: "db-error" };
  }
  const outcome = (Array.isArray(data) ? data[0] : data) as
    | {
        result?: string;
        advanced?: boolean;
        new_event?: boolean;
        recorded_amount?: number | null;
      }
    | null;
  if (!outcome || outcome.result === "not-found") return { kind: "not-found" };
  const recordedAmount = outcome.recorded_amount ?? amountTotal ?? project.amount;

  if (outcome.result === "amount-mismatch") {
    return handleAmountMismatch(project, sessionId, recordedAmount, outcome.new_event === true);
  }
  if (outcome.result === "quote-mismatch") {
    return handleQuoteMismatch(
      project,
      sessionId,
      recordedAmount,
      quoteId,
      outcome.new_event === true
    );
  }
  if (outcome.result === "duplicate-payment") {
    if (outcome.new_event) {
      await sendNatoriNoticeMail(
        `【至急確認】重複入金の可能性 / ${project.client_name} 様`,
        [
          "入金確認済み案件に別のStripe sessionから入金がありました。",
          "Stripeダッシュボードで確認し、必要なら返金してください。",
          "",
          `案件: ${project.title}`,
          `今回のsession: ${sessionId}`,
          `既存のsession: ${project.stripe_payment_session_id ?? "不明"}`,
          `金額: ${formatYen(recordedAmount)}`,
        ].join("\n")
      );
    }
    return { kind: "already-paid" };
  }
  if (outcome.result === "already-paid") return { kind: "already-paid" };
  if (outcome.result !== "received") {
    console.error("[natori-order-mail] unexpected payment outcome", outcome.result);
    return { kind: "db-error" };
  }

  const advanceToRough = outcome.advanced === true;
  const amountText = formatYen(recordedAmount);

  // 依頼者への入金確認メール（失敗しても入金反映自体は成功扱い）。
  // 決済直後の不安に応えるため、Stripe の完了画面とは別にメールで記録を残す。
  if (isNatoriOrderMailConfigured() && project.client_email) {
    const confirmation = buildPaidConfirmationMail({
      clientName: project.client_name,
      title: project.title,
      amount: recordedAmount,
    });
    const sentToClient = await sendPlainMail(
      project.client_email,
      confirmation.subject,
      confirmation.body
    );
    if (!sentToClient) {
      console.error("[natori-order-mail] client paid confirmation mail failed (ignored)");
    }
  } else if (!project.client_email) {
    console.error(
      "[natori-order-mail] client paid confirmation skipped: client_email missing",
      { projectId: project.id }
    );
  }

  // ナトリへの入金通知（失敗しても入金反映自体は成功扱い）
  if (isNatoriOrderMailConfigured()) {
    const statusLine =
      advanceToRough && project.status !== "rough"
        ? "案件は自動で「ラフ」ステータスに進んでいます。"
        : "案件のステータスは変更していません（入金記録のみ追加）。";
    const noticeBody = [
      "コミッションの入金がありました。制作を開始できます。",
      "",
      `■ 案件: ${project.title}`,
      `■ 依頼者: ${project.client_name} 様`,
      `■ 金額: ${amountText}`,
      "",
      statusLine,
      "ダッシュボード: https://www.me-ish.art/natori/projects",
    ].join("\n");
    const sent = await sendPlainMail(
      REPLY_TO,
      `【入金確認】${project.client_name} 様 / ${project.title}`,
      noticeBody
    );
    if (!sent) {
      console.error("[natori-order-mail] paid notice mail failed (ignored)");
    }
  }

  return { kind: "ok" };
}
