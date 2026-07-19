import "server-only";

// features/natori/server/orderMailService.ts
// 依頼者向けの見積もりメール・支払い依頼メールの送信と、Stripe 入金の案件反映。
//
// フロー:
//   フォーム依頼 (inquiry) → 見積もりメール送信 → quoted
//   → 依頼者から承諾の返信 → 支払い依頼メール送信（Stripe 支払いリンク自動生成）
//   → awaiting_payment → Stripe Webhook で入金確認 → rough（作業開始）
import { createHash, randomBytes } from "crypto";
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
  title: string;
  client_name: string;
  amount: number;
  status: string;
  note: string | null;
  payment_confirmed_at?: string | null;
  payment_link_id?: string | null;
  quoted_amount?: number | null;
  client_email?: string | null;
};

async function fetchProjectRow(projectId: string): Promise<ProjectRow | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_projects")
    .select(
      "id, title, client_name, amount, status, note, payment_confirmed_at, payment_link_id, quoted_amount, client_email"
    )
    .eq("id", projectId)
    .maybeSingle();
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
  | { kind: "db-error" };

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

export async function sendNatoriOrderMail(
  input: SendNatoriOrderMailInput
): Promise<SendNatoriOrderMailResult> {
  if (!isNatoriOrderMailConfigured()) return { kind: "not-configured" };

  const project = await fetchProjectRow(input.projectId);
  if (!project) return { kind: "not-found" };

  let body = input.body;

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
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return { kind: "not-configured" };
    const stripe = new Stripe(secretKey);

    // 再送（再見積もり）時は旧リンクを先に無効化し、旧金額での支払いを塞ぐ。
    // 無効化に失敗したまま新リンクを発行すると旧リンクが生き残るため、
    // resource_missing（Stripe 側に既に無い）以外の失敗は中断する。
    if (project.payment_link_id) {
      try {
        await stripe.paymentLinks.update(project.payment_link_id, { active: false });
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code !== "resource_missing") {
          console.error("[natori-order-mail] old payment link deactivation failed", err);
          return { kind: "stripe-error" };
        }
      }
    }

    // idempotency key: 同じ案件・同じ金額・同じ「直前のリンク」からの発行を
    // 1つに畳む（送信ボタン二度押しでのリンク二重発行防止）。発行するたびに
    // payment_link_id が変わるので、意図的な再発行では自然に別キーになる。
    const idempotencyBase = `natori-plink:${project.id}:${input.amount}:${project.payment_link_id ?? "none"}`;
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
          // Webhook (checkout.session.completed) の分岐用。Payment Link の
          // metadata は Checkout Session に自動でコピーされる。
          metadata: { kind: "natori_commission", projectId: project.id },
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
      body = injectPaymentLink(body, link.url);
    } catch (err) {
      console.error("[natori-order-mail] payment link creation failed", err);
      return { kind: "stripe-error" };
    }
  }

  const mailed = await sendPlainMail(input.to, input.subject, body);
  if (!mailed) return { kind: "mail-error" };

  const admin = supabaseAdmin();

  // 送信ログは natori_order_mail_logs が正（機械的参照はこちら）。note への
  // 追記は人間可読の履歴表示用に残す。ログ書き込み失敗はメール送信済みの後
  // なので処理は止めず、エラーログだけ残す。
  const { error: logError } = await admin.from("natori_order_mail_logs").insert({
    project_id: project.id,
    kind: input.kind,
    to_email: input.to,
    amount: input.amount,
    link_url: paymentLinkUrl ?? null,
  });
  if (logError) {
    console.error("[natori-order-mail] mail log insert failed", logError);
  }

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
  if (input.kind === "payment" && paymentLinkId) {
    // 次回再送時の旧リンク無効化と、Webhook での入金金額照合に使う
    update.payment_link_id = paymentLinkId;
    update.quoted_amount = input.amount;
  }
  if (input.kind === "estimate" && quoteTokenHash) {
    // 承諾トークンを最新の見積もりに付け替え、過去の承諾記録はリセットする
    update.quote_accept_token_hash = quoteTokenHash;
    update.quote_token_expires_at = quoteTokenExpiresAt;
    update.quote_accepted_at = null;
    update.quote_accepted_amount = null;
  }
  if (input.kind === "delivery" && deliveryTokenHash) {
    // 納品トークンを最新の納品メールに付け替え、過去の受け取り記録はリセットする
    update.delivery_token_hash = deliveryTokenHash;
    update.delivery_token_expires_at = deliveryTokenExpiresAt;
    update.delivery_accepted_at = null;
    update.delivered_mail_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("natori_projects")
    .update(update)
    .eq("id", project.id);
  if (error) {
    console.error("[natori-order-mail] project update after send failed", error);
    return { kind: "db-error" };
  }

  return { kind: "ok", paymentLinkUrl };
}

export type MarkNatoriCommissionPaidResult =
  | { kind: "ok" }
  | { kind: "already-paid" }
  | { kind: "not-found" }
  | { kind: "amount-mismatch" }
  | { kind: "db-error" };

/** 金額不一致の入金: 警告を note に残し、ナトリへ要確認メールを送る（ステータス据え置き） */
async function handleAmountMismatch(
  project: ProjectRow,
  sessionId: string,
  amountTotal: number,
  today: string
): Promise<MarkNatoriCommissionPaidResult> {
  const quotedText = formatYen(project.quoted_amount ?? 0);
  const receivedText = formatYen(amountTotal);
  const warnEntry = `【要確認: 入金金額不一致（Stripe） ${today}】受領 ${receivedText} / 見積 ${quotedText} / session: ${sessionId}`;

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("natori_projects")
    .update({ note: appendNote(project.note, warnEntry) })
    .eq("id", project.id);
  if (error) {
    console.error("[natori-order-mail] mismatch note update failed", error);
  }

  if (isNatoriOrderMailConfigured()) {
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

/**
 * Stripe Webhook からの入金反映。payment_confirmed_at を記録して rough
 * （作業開始）へ進め、ナトリ宛に入金通知メールを送る。
 *
 * 冪等性は `payment_confirmed_at IS NULL` を条件に含めた原子的な UPDATE で
 * 担保する。同一 Checkout の completed / async_payment_succeeded や再送が
 * 同時に届いても、更新できるのは 1 リクエストだけで、note 追記・通知メールも
 * その 1 回に限られる（select での事前判定はレースするため行わない）。
 */
export async function markNatoriCommissionPaid(
  projectId: string,
  sessionId: string,
  amountTotal: number | null
): Promise<MarkNatoriCommissionPaidResult> {
  // note 追記とメール本文のための読み取り。冪等判定には使わない。
  const project = await fetchProjectRow(projectId);
  if (!project) return { kind: "not-found" };

  const today = new Date().toISOString().slice(0, 10);

  // 金額照合: 支払いリンク発行時に保存した quoted_amount と受領額が一致しない
  // 入金（無効化前の旧リンク経由など）は rough に進めない。note に警告を残して
  // ナトリへ要確認メールを送る。payment_confirmed_at は立てないので、正しい
  // 金額の入金が来ればそのとき通常フローで確定できる。
  // quoted_amount が null の既存案件・amount_total が取れないセッションは照合対象外。
  if (
    project.quoted_amount != null &&
    amountTotal != null &&
    amountTotal !== project.quoted_amount
  ) {
    return handleAmountMismatch(project, sessionId, amountTotal, today);
  }

  const amountText = amountTotal != null ? formatYen(amountTotal) : formatYen(project.amount);
  const logEntry = `【入金確認（Stripe） ${today}】${amountText} / session: ${sessionId}`;

  // 遷移表の payment-confirmed ルール: 受注前の案件だけ rough（作業開始）へ進める。
  // 既に制作中・完了の案件（手動で先に進めた等）は巻き戻さず、入金記録だけ残す。
  const advanceToRough = canTransitionNatoriStatus(
    project.status as NatoriProjectStatus,
    "rough",
    "payment-confirmed"
  );
  const update: Record<string, unknown> = {
    payment_confirmed_at: new Date().toISOString(),
    note: appendNote(project.note, logEntry),
  };
  if (advanceToRough && project.status !== "rough") {
    update.status = "rough";
    update.next_action = getNextActionForStatus("rough");
  }

  const admin = supabaseAdmin();
  const { data: updated, error } = await admin
    .from("natori_projects")
    .update(update)
    .eq("id", projectId)
    .is("payment_confirmed_at", null)
    .select("id");
  if (error) {
    console.error("[natori-order-mail] mark paid failed", error);
    return { kind: "db-error" };
  }
  if (!updated || updated.length === 0) {
    // 別リクエスト（再送・別イベント）が先に入金確定済み
    return { kind: "already-paid" };
  }

  // 依頼者への入金確認メール（失敗しても入金反映自体は成功扱い）。
  // 決済直後の不安に応えるため、Stripe の完了画面とは別にメールで記録を残す。
  if (isNatoriOrderMailConfigured() && project.client_email) {
    const confirmation = buildPaidConfirmationMail({
      clientName: project.client_name,
      title: project.title,
      amount: amountTotal ?? project.amount,
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
