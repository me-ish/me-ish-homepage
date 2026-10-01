import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatYen } from "@/features/natori/lib/pricing";
import { buildDeliveryCompletionMail } from "@/features/natori/server/deliveryCompletionMailService";
import type { NatoriNotificationRow } from "@/types/supabase";
import { openDeliveryNotification } from "./deliveryNotificationPayload";

export const acceptanceOutboxEnabled = () => process.env.NATORI_ACCEPTANCE_OUTBOX_ENABLED === "1";
export const notificationSendingEnabled = () => process.env.NATORI_NOTIFICATION_SENDING_ENABLED === "1";

const address = z.email().max(320);
const payloadSchema = z.object({
  from: z.string().min(1).max(500),
  to: z.array(address).min(1).max(1),
  bcc: z.array(address).max(1).optional(),
  reply_to: address,
  subject: z.string().min(1).max(998),
  text: z.string().min(1).max(20000),
  headers: z.record(z.string(), z.string()),
});
export type NotificationPayload = z.infer<typeof payloadSchema>;
export type NotificationSendResult =
  | { status: "sent"; providerId: string }
  | { status: "failed" | "unknown"; errorCode: string };
export type NotificationTransport = (payload: NotificationPayload, key: string) => Promise<NotificationSendResult>;

export function buildAcceptanceNotificationPayload(job: Pick<NatoriNotificationRow, "payload" | "snapshot" | "purpose">): NotificationPayload {
  if ((job.purpose === "delivery_issue_client" || job.purpose === "quote_issue_client" || job.purpose === "payment_link_client")) {
    if (!job.payload) throw new Error("mail_configuration");
    return payloadSchema.parse(openDeliveryNotification(job.payload));
  }
  // A retry never renders from current project values or current mail settings.
  if (job.payload) return payloadSchema.parse(job.payload);
  const snapshot = z.object({
    title: z.string(), clientName: z.string(), reviewReason: z.string().optional(), sessionId: z.string().optional(), amount: z.number().optional(), clientEmail: z.string().nullable().optional(),
  }).parse(job.snapshot);
  const recipient = process.env.NATORI_PORTFOLIO_CONTACT_TO?.trim();
  const from = process.env.NATORI_ORDER_MAIL_FROM?.trim();
  // No implicit personal address fallback on this new path. Configuration errors remain visible.
  if (!recipient || !from) throw new Error("mail_configuration");
  const bcc = process.env.NATORI_MAIL_BCC?.trim();
  let subject: string;
  let text: string;
  let to = recipient;
  if (job.purpose === "quote_accept_artist") {
    if (!Number.isSafeInteger(snapshot.amount)) throw new Error("mail_configuration");
    subject = `【承諾】${snapshot.clientName} 様 / ${snapshot.title}`;
    text = ["見積もりが承諾されました。お支払いのご案内を送ってください。", "",
      `■ 案件: ${snapshot.title}`, `■ 依頼者: ${snapshot.clientName} 様`, `■ 承諾金額: ${formatYen(snapshot.amount!)}`, "",
      "案件管理 → 該当案件 → 「支払い依頼メール」から送信できます。", "ダッシュボード: https://www.me-ish.art/natori/projects"].join("\n");
  } else if (job.purpose === "delivery_accept_artist") {
    subject = `【納品完了】${snapshot.clientName} 様 / ${snapshot.title}`;
    text = ["納品の受け取りが確認されました。案件は「対応完了」になり、実績に追加されています。", "",
      `■ 案件: ${snapshot.title}`, `■ 依頼者: ${snapshot.clientName} 様`, "", "実績ページ: https://www.me-ish.art/natori/results"].join("\n");
  } else if (job.purpose === "delivery_accept_client") {
    const mail = buildDeliveryCompletionMail(snapshot);
    subject = mail.subject;
    text = mail.body;
    to = snapshot.clientEmail ?? "";
  } else if (job.purpose === "payment_received_artist" || job.purpose === "payment_received_client") {
    if (!Number.isSafeInteger(snapshot.amount)) throw new Error("mail_configuration");
    subject = `【入金確認】${snapshot.clientName} 様 / ${snapshot.title}`;
    text = ["入金を確認しました。", "", `案件: ${snapshot.title}`, `金額: ${formatYen(snapshot.amount!)}`,
      job.purpose === "payment_received_client" ? "次の確認事項は担当者からご案内します。ご不明な点はこのメールへご返信ください。" : "案件管理で次の作業と合意済みの予定を確認してください。"].join("\n");
    if (job.purpose === "payment_received_client") to = snapshot.clientEmail ?? "";
  } else if (job.purpose === "payment_review_artist") {
    subject = `【入金の要確認】${snapshot.clientName} 様 / ${snapshot.title}`;
    text = ["入金イベントを要確認として保存しました。自動で制作を再開したり返金したりはしていません。", "",
      `案件: ${snapshot.title}`, `確認項目: ${snapshot.reviewReason ?? "payment_review"}`,
      Number.isSafeInteger(snapshot.amount) ? `金額: ${formatYen(snapshot.amount!)}` : "金額は要照合です。",
      "Stripeの取引と案件管理の記録を照合してください。"].join("\n");
  } else throw new Error("mail_configuration");
  return payloadSchema.parse({ from, to: [to], ...(bcc ? { bcc: [bcc] } : {}), reply_to: recipient,
    subject, text, headers: { "X-Meish-Template": `natori-${job.purpose}` } });
}

/** Fixed production endpoint. Tests inject a transport; there is no arbitrary endpoint environment variable. */
export const sendAcceptanceNotification: NotificationTransport = async (payload, key) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "failed", errorCode: "mail_configuration" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000), cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && body && typeof body === "object" && "id" in body && typeof body.id === "string" && body.id.length <= 200) {
      return { status: "sent", providerId: body.id };
    }
    // Transport/5xx/concurrency/invalid idempotency outcomes may have been accepted.
    const definiteRejection = [400, 401, 403, 404, 413, 422].includes(response.status);
    return { status: definiteRejection ? "failed" : "unknown", errorCode: definiteRejection ? "provider_rejected" : "provider_unknown" };
  } catch {
    return { status: "unknown", errorCode: "provider_unknown" };
  }
};

/** One bounded attempt, fenced before send and on completion. Never throws into an acceptance response. */
export async function dispatchAcceptanceNotification(
  id: string,
  manual = false,
  transport: NotificationTransport = sendAcceptanceNotification,
): Promise<void> {
  if (!notificationSendingEnabled()) return;
  const admin = supabaseAdmin();
  const claimToken = randomUUID();
  let paymentMailProject: string | null = null;
  try {
    const claim = await admin.rpc("natori_notification_claim_v1", { p_id: id, p_claim_token: claimToken, p_manual: manual });
    const job = claim.data?.[0];
    if (claim.error || !job) return;
    if(job.purpose === "payment_link_client"){
      paymentMailProject=job.project_id;
      const {paymentLinkMailGate}=await import("./paymentLinkService");
      if(!await paymentLinkMailGate(paymentMailProject,id,claimToken))return;
    }
    let payload: NotificationPayload;
    try { payload = buildAcceptanceNotificationPayload(job); }
    catch {
      // No provider request has been made; a new attempt is safe after configuration is corrected.
      await admin.rpc("natori_notification_finish_v1", { p_id: id, p_claim_token: claimToken,
        p_status: job.send_started_at ? "unknown" : "failed", p_error_code: "mail_configuration" });
      return;
    }
    const started = await admin.rpc("natori_notification_start_v1", { p_id: id, p_claim_token: claimToken,
      p_payload: (job.purpose === "delivery_issue_client" || job.purpose === "quote_issue_client" || job.purpose === "payment_link_client") ? job.payload! : payload });
    const active = started.data?.[0];
    if (started.error || !active?.lease_expires_at || !active.send_started_at) return;
    if (Date.parse(active.lease_expires_at) <= Date.now() + 15000 || Date.parse(active.send_started_at) <= Date.now() - 23 * 3600000) return;
    let result = await transport(payload, `natori-notice/${id}`);
    // A rejection of this replay (for example a rotated/invalid API key) does not
    // prove an earlier interrupted request was rejected. Keep its original key.
    if (result.status === "failed" && job.send_started_at) result = { status: "unknown", errorCode: "provider_unknown" };
    const finish = await admin.rpc("natori_notification_finish_v1", {
      p_id: id, p_claim_token: claimToken, p_status: result.status,
      ...(result.status === "sent" ? { p_provider_id: result.providerId } : { p_error_code: result.errorCode }),
    });
    if (finish.error || !finish.data) console.error("[natori-notification] completion_unconfirmed");
  } catch {
    // Lease expiry permits SAME key/payload recovery. No raw error contains an address, body or token.
    console.error("[natori-notification] attempt_interrupted");
  } finally {
    if(paymentMailProject)try{const {paymentLinkMailGate}=await import("./paymentLinkService");await paymentLinkMailGate(paymentMailProject,id,claimToken,true);}catch{/* Lease expiry retains recovery without sending invalid links. */}
  }
}

export async function dispatchAcceptanceNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.slice(0, 2).map(id => dispatchAcceptanceNotification(id)));
}
