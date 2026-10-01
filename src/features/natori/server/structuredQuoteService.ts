import "server-only";

import { dispatchAcceptanceNotification } from "./acceptanceNotifications";
import { sealDeliveryNotification } from "./deliveryNotificationPayload";
import type { Json } from "@/types/supabase";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { injectAcceptLink } from "@/features/natori/lib/orderMail";
import { getNextActionForStatus } from "@/features/natori/lib/projects";
import { validateStructuredQuoteDeliveryAttempt } from "@/features/natori/lib/structuredQuoteAttempt";
import { issueNatoriQuoteViaRpc } from "@/features/natori/server/quoteIssueRpcAdapter";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteUrl } from "@/lib/constants";
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import type { NatoriQuoteIssuePayloadV1 } from "@/features/natori/types/quoteSnapshot";
import type { StructuredQuoteDeliveryAttempt } from "@/features/natori/lib/structuredQuoteAttempt";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>";
const REPLY_TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";
const BCC = process.env.NATORI_MAIL_BCC?.trim() || "";

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  client_name: string;
  status: string;
};

export type IssueStructuredQuoteInput = NatoriQuoteIssuePayloadV1 &
  StructuredQuoteDeliveryAttempt & { draftRevision: number };

export type IssueStructuredQuoteResult =
  | { kind: "ok"; quoteId: string; version: number; reused: boolean; notificationId?: string; notificationStatus?: string }
  | {
      kind:
        | "not-found"
        | "not-configured"
        | "invalid-state"
        | "invalid-attempt"
        | "rejected"
        | "db-error"
        | "mail-error";
      reason?: string;
    };

export async function issueStructuredQuoteAndSend(
  input: IssueStructuredQuoteInput,
): Promise<IssueStructuredQuoteResult> {
  if (!RESEND_API_KEY) return { kind: "not-configured" };

  const attempt = validateStructuredQuoteDeliveryAttempt(input);
  if (!attempt.success) return { kind: "invalid-attempt" };
  if (!Number.isSafeInteger(input.draftRevision) || input.draftRevision < 1 || !input.pricingSnapshot.agreedTerms) {
    return { kind: "rejected", reason: "estimate_draft_required" };
  }
  if (input.requestSnapshot) {
    const request = readNatoriRequestData(input.requestSnapshot);
    if (!request.success || request.data.options.some((option) => option.id === "copyright_transfer")) {
      return { kind: "rejected", reason: "copyright_terms_require_individual_review" };
    }
  }

  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "not-found" };

  if (quoteIntegrityEnabled()) return issueAtomicQuote(input, ownerId, attempt.data.acceptToken);

  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .select("id, user_id, title, client_name, status")
    .eq("id", input.projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error || !data) return { kind: error ? "db-error" : "not-found" };

  const project = data as ProjectRow;
  if (!["inquiry", "consulting", "estimating", "quoted"].includes(project.status)) {
    return { kind: "invalid-state" };
  }

  const tokenHash = createHash("sha256")
    .update(attempt.data.acceptToken)
    .digest("hex");

  const issued = await issueNatoriQuoteViaRpc({
    projectId: input.projectId,
    toEmail: input.toEmail,
    subject: input.subject,
    bodySnapshot: input.bodySnapshot,
    idempotencyKey: input.idempotencyKey,
    requestSnapshot: input.requestSnapshot,
    pricingSnapshot: input.pricingSnapshot,
    ownerId,
    title: project.title,
    clientName: project.client_name,
    tokenHash,
    expiresAt: attempt.data.expiresAt,
    draftRevision: input.draftRevision,
  });
  if (issued.kind === "rejected") {
    return { kind: "rejected", reason: issued.reason };
  }
  if (issued.kind === "db-error") return { kind: "db-error" };

  const body = injectAcceptLink(
    input.bodySnapshot,
    `${getSiteUrl()}/natori/quote/${attempt.data.acceptToken}`,
  );
  const resend = new Resend(RESEND_API_KEY);
  const { error: mailError } = await resend.emails.send(
    {
      from: FROM,
      to: [input.toEmail],
      ...(BCC ? { bcc: [BCC] } : {}),
      subject: input.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
      text: body,
      replyTo: REPLY_TO,
      headers: { "X-Meish-Template": "natori-structured-quote" },
    },
    {
      // A lost HTTP response must not cause the same quote email to be delivered twice.
      // Resend retains idempotency keys for 24 hours, which covers normal retries.
      idempotencyKey: `natori-structured-quote/${issued.quoteId}`,
    },
  );
  if (mailError) {
    console.error("[natori-structured-quote] mail send failed", mailError);
    return { kind: "mail-error" };
  }

  // Lifecycle history is recorded in natori_project_activity by DB triggers.
  // Keep note reserved for administrator-authored free text.
  const { error: updateError } = await supabaseAdmin()
    .from("natori_projects")
    .update({
      status: "quoted",
      next_action: getNextActionForStatus("quoted"),
    })
    .eq("id", project.id)
    .eq("user_id", ownerId)
    .eq("status", project.status)
    .eq("active_quote_id", issued.quoteId)
    .is("quote_accepted_at", null)
    .is("payment_confirmed_at", null)
    .is("deleted_at", null);
  if (updateError) {
    console.error("[natori-structured-quote] post-send state update failed", updateError);
  }

  return {
    kind: "ok",
    quoteId: issued.quoteId,
    version: issued.version,
    reused: issued.kind === "reused",
  };
}

export const quoteIntegrityEnabled = () => process.env.NATORI_QUOTE_INTEGRITY_ENABLED === "1";

export async function getStructuredQuoteRecovery(projectId: string) {
  if (!quoteIntegrityEnabled()) return { enabled: false, issue: null };
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { enabled: true, issue: null };
  const { data, error } = await supabaseAdmin().rpc("natori_quote_issue_recovery_v1", {
    p_owner_id: ownerId, p_project_id: projectId,
  });
  if (error) throw new Error("quote_recovery_failed");
  const row = data?.[0];
  return { enabled: true, issue: row ? { quoteId: row.quote_id, version: row.version,
    notificationId: row.notification_id ?? undefined, notificationStatus: row.notification_status } : null };
}

async function issueAtomicQuote(input: IssueStructuredQuoteInput, ownerId: string, token: string): Promise<IssueStructuredQuoteResult> {
  const payload = {
    from: FROM, to: [input.toEmail], ...(BCC ? { bcc: [BCC] } : {}), reply_to: REPLY_TO,
    subject: input.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
    text: injectAcceptLink(input.bodySnapshot, `${getSiteUrl()}/natori/quote/${token}`),
    headers: { "X-Meish-Template": "natori-structured-quote" },
  };
  let sealed: Json;
  try { sealed = sealDeliveryNotification(payload, input.expiresAt); }
  catch { return { kind: "not-configured" }; }
  // Token hash participates in replay identity; plaintext only enters encrypted payload.
  const request: Json = JSON.parse(JSON.stringify({
    projectId: input.projectId, toEmail: input.toEmail, subject: input.subject,
    bodySnapshot: input.bodySnapshot, idempotencyKey: input.idempotencyKey,
    tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: input.expiresAt,
    requestSnapshot: input.requestSnapshot, pricingSnapshot: input.pricingSnapshot,
    draftRevision: input.draftRevision,
  }));
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("natori_issue_quote_with_notification_v1", {
    p_owner_id: ownerId, p_input: request, p_payload: sealed,
  });
  if (error) {
    const reasons = ["project_not_found", "project_archived", "project_already_paid", "quote_already_accepted",
      "invalid_quote_state", "idempotency_conflict", "estimate_draft_changed", "estimate_draft_mismatch",
      "estimate_terms_incomplete", "estimate_due_date_past", "quote_terms_conflict"];
    const reason = reasons.find(value => error.message.includes(value));
    return reason ? { kind: "rejected", reason } : { kind: "db-error" };
  }
  const row = data?.[0];
  if (!row || !row.quote_id || !Number.isSafeInteger(row.version) || !row.notification_id) return { kind: "db-error" };
  await dispatchAcceptanceNotification(row.notification_id);
  const notice = await db.from("natori_notification_jobs").select("status").eq("id", row.notification_id).maybeSingle();
  return { kind: "ok", quoteId: row.quote_id, version: row.version, reused: row.reused,
    notificationId: row.notification_id, notificationStatus: notice.error ? "unknown" : notice.data?.status ?? "unknown" };
}

export async function renotifyStructuredQuote(quoteId: string, operationId: string): Promise<IssueStructuredQuoteResult> {
  if (!quoteIntegrityEnabled()) return { kind: "invalid-state" };
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "not-found" };
  const db = supabaseAdmin();
  const { data: quote, error } = await db.from("natori_quotes")
    .select("id, project_id, subject, body_snapshot, to_email, expires_at, accepted_at, version")
    .eq("id", quoteId).eq("user_id", ownerId).maybeSingle();
  if (error) return { kind: "db-error" };
  if (!quote) return { kind: "not-found" };
  const token = randomBytes(32).toString("base64url");
  const expiresAt = quote.accepted_at ? new Date(Date.now()+14*86400000).toISOString() : quote.expires_at;
  if (Date.parse(expiresAt)<=Date.now()) return { kind: "invalid-state" };
  let payload: Json;
  try { payload = sealDeliveryNotification({ from: FROM, to: [quote.to_email], ...(BCC ? { bcc: [BCC] } : {}),
    reply_to: REPLY_TO, subject: quote.subject.replace(/[\r\n]+/g," ").slice(0,200),
    text: injectAcceptLink(quote.body_snapshot,`${getSiteUrl()}/natori/quote/${token}`),
    headers: { "X-Meish-Template": "natori-structured-quote" } }, expiresAt); }
  catch { return { kind: "not-configured" }; }
  const { data, error: noticeError } = await db.rpc("natori_renotify_quote_v1", {
    p_owner_id: ownerId, p_quote_id: quoteId, p_operation_id: operationId,
    p_request: { quoteId, toEmail: quote.to_email, subject: quote.subject, bodySnapshot: quote.body_snapshot },
    p_token_hash: createHash("sha256").update(token).digest("hex"), p_expires_at: expiresAt, p_payload: payload,
  });
  if (noticeError) {
    const reason = ["invalid_quote_state","invalid_quote_expiry","idempotency_conflict","notification_recovery_required"].find(v=>noticeError.message.includes(v));
    return reason ? { kind: "rejected", reason } : { kind: "db-error" };
  }
  const noticeId = data?.[0]?.notification_id;
  if (!noticeId) return { kind: "db-error" };
  await dispatchAcceptanceNotification(noticeId);
  const notice = await db.from("natori_notification_jobs").select("status").eq("id",noticeId).maybeSingle();
  return { kind: "ok", quoteId, version: quote.version, reused: true, notificationId: noticeId,
    notificationStatus: notice.error ? "unknown" : notice.data?.status ?? "unknown" };
}
