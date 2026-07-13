import "server-only";

// features/natori/server/orderMailService.ts
// 依頼者向けの見積もりメール・支払い依頼メールの送信と、Stripe 入金の案件反映。
//
// フロー:
//   フォーム依頼 (inquiry) → 見積もりメール送信 → quoted
//   → 依頼者から承諾の返信 → 支払い依頼メール送信（Stripe 支払いリンク自動生成）
//   → awaiting_payment → Stripe Webhook で入金確認 → rough（作業開始）
import Stripe from "stripe";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildOrderMailLogEntry,
  injectPaymentLink,
} from "@/features/natori/lib/orderMail";
import { getNextActionForStatus } from "@/features/natori/lib/projects";
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
};

async function fetchProjectRow(projectId: string): Promise<ProjectRow | null> {
  const admin = supabaseAdmin();
  const { data, error } = await (admin as any)
    .from("natori_projects")
    .select("id, title, client_name, amount, status, note, payment_confirmed_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    // payment_confirmed_at カラムが無い旧環境向けフォールバック
    if (/payment_confirmed_at/i.test(error.message ?? "")) {
      const retry = await (admin as any)
        .from("natori_projects")
        .select("id, title, client_name, amount, status, note")
        .eq("id", projectId)
        .maybeSingle();
      if (retry.error) {
        console.error("[natori-order-mail] project fetch failed", retry.error);
        return null;
      }
      return (retry.data as ProjectRow | null) ?? null;
    }
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

export type SendNatoriOrderMailInput = {
  projectId: string;
  kind: "estimate" | "payment";
  to: string;
  subject: string;
  body: string;
  /** 送信時に案件へ保存する確定金額（円） */
  amount: number;
};

export type SendNatoriOrderMailResult =
  | { kind: "ok"; paymentLinkUrl?: string }
  | { kind: "not-found" }
  | { kind: "not-configured" }
  | { kind: "stripe-error" }
  | { kind: "mail-error" }
  | { kind: "db-error" };

/** 見積もりメール送信後は quoted、支払い依頼メール送信後は awaiting_payment に進める */
const NEXT_STATUS: Record<
  SendNatoriOrderMailInput["kind"],
  { advanceFrom: ReadonlySet<string>; to: NatoriProjectStatus }
> = {
  estimate: {
    advanceFrom: new Set(["inquiry", "consulting", "estimating"]),
    to: "quoted",
  },
  payment: {
    advanceFrom: new Set(["inquiry", "consulting", "estimating", "quoted"]),
    to: "awaiting_payment",
  },
};

export async function sendNatoriOrderMail(
  input: SendNatoriOrderMailInput
): Promise<SendNatoriOrderMailResult> {
  if (!isNatoriOrderMailConfigured()) return { kind: "not-configured" };

  const project = await fetchProjectRow(input.projectId);
  if (!project) return { kind: "not-found" };

  // 支払い依頼のときは Stripe の支払いリンクを都度生成して本文へ差し込む
  let body = input.body;
  let paymentLinkUrl: string | undefined;
  if (input.kind === "payment") {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return { kind: "not-configured" };
    try {
      const stripe = new Stripe(secretKey);
      const price = await stripe.prices.create({
        currency: "jpy",
        unit_amount: input.amount,
        product_data: {
          name: `コミッション: ${project.title}（${project.client_name} 様）`,
        },
      });
      const link = await stripe.paymentLinks.create({
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
      });
      paymentLinkUrl = link.url;
      body = injectPaymentLink(body, link.url);
    } catch (err) {
      console.error("[natori-order-mail] payment link creation failed", err);
      return { kind: "stripe-error" };
    }
  }

  const mailed = await sendPlainMail(input.to, input.subject, body);
  if (!mailed) return { kind: "mail-error" };

  // 送信後の案件更新（金額・ステータス・送信ログ）。メールは送れているので、
  // ここで失敗しても呼び出し側には db-error として伝えるだけに留める。
  const today = new Date().toISOString().slice(0, 10);
  const logEntry = buildOrderMailLogEntry(input.kind, today, input.to, input.amount, paymentLinkUrl);
  const flow = NEXT_STATUS[input.kind];
  const update: Record<string, unknown> = {
    amount: input.amount,
    note: appendNote(project.note, logEntry),
  };
  if (flow.advanceFrom.has(project.status)) {
    update.status = flow.to;
    update.next_action = getNextActionForStatus(flow.to);
  }

  const admin = supabaseAdmin();
  const { error } = await (admin as any)
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
  | { kind: "db-error" };

/**
 * Stripe Webhook からの入金反映。payment_confirmed_at を記録して rough
 * （作業開始）へ進め、ナトリ宛に入金通知メールを送る。
 * 二重配送されても payment_confirmed_at 済みならスキップ（冪等）。
 */
export async function markNatoriCommissionPaid(
  projectId: string,
  sessionId: string,
  amountTotal: number | null
): Promise<MarkNatoriCommissionPaidResult> {
  const project = await fetchProjectRow(projectId);
  if (!project) return { kind: "not-found" };
  if (project.payment_confirmed_at) return { kind: "already-paid" };

  const today = new Date().toISOString().slice(0, 10);
  const amountText = amountTotal != null ? formatYen(amountTotal) : formatYen(project.amount);
  const logEntry = `【入金確認（Stripe） ${today}】${amountText} / session: ${sessionId}`;
  const update: Record<string, unknown> = {
    status: "rough",
    next_action: getNextActionForStatus("rough"),
    payment_confirmed_at: new Date().toISOString(),
    note: appendNote(project.note, logEntry),
  };

  const admin = supabaseAdmin();
  let { error } = await (admin as any)
    .from("natori_projects")
    .update(update)
    .eq("id", projectId);
  if (error && /payment_confirmed_at/i.test(error.message ?? "")) {
    // カラム未追加の旧環境ではステータス更新だけ通す
    delete update.payment_confirmed_at;
    const retry = await (admin as any)
      .from("natori_projects")
      .update(update)
      .eq("id", projectId);
    error = retry.error;
  }
  if (error) {
    console.error("[natori-order-mail] mark paid failed", error);
    return { kind: "db-error" };
  }

  // ナトリへの入金通知（失敗しても入金反映自体は成功扱い）
  if (isNatoriOrderMailConfigured()) {
    const noticeBody = [
      "コミッションの入金がありました。制作を開始できます。",
      "",
      `■ 案件: ${project.title}`,
      `■ 依頼者: ${project.client_name} 様`,
      `■ 金額: ${amountText}`,
      "",
      "案件は自動で「ラフ」ステータスに進んでいます。",
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
