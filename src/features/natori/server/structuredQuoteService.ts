import "server-only";

import { createHash } from "crypto";
import { Resend } from "resend";
import { injectAcceptLink, buildOrderMailLogEntry } from "@/features/natori/lib/orderMail";
import { getNextActionForStatus } from "@/features/natori/lib/projects";
import { validateStructuredQuoteDeliveryAttempt } from "@/features/natori/lib/structuredQuoteAttempt";
import { issueNatoriQuoteViaRpc } from "@/features/natori/server/quoteIssueRpcAdapter";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteUrl } from "@/lib/constants";
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
  note: string | null;
};

export type IssueStructuredQuoteInput = NatoriQuoteIssuePayloadV1 &
  StructuredQuoteDeliveryAttempt;

export type IssueStructuredQuoteResult =
  | { kind: "ok"; quoteId: string; version: number; reused: boolean }
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

  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };

  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .select("id, user_id, title, client_name, status, note")
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
  const { error: mailError } = await resend.emails.send({
    from: FROM,
    to: [input.toEmail],
    ...(BCC ? { bcc: [BCC] } : {}),
    subject: input.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
    text: body,
    replyTo: REPLY_TO,
    headers: { "X-Meish-Template": "natori-structured-quote" },
  });
  if (mailError) {
    console.error("[natori-structured-quote] mail send failed", mailError);
    return { kind: "mail-error" };
  }

  const sentAt = new Date().toISOString().slice(0, 10);
  const noteEntry = buildOrderMailLogEntry(
    "estimate",
    sentAt,
    input.toEmail,
    input.pricingSnapshot.total,
  );
  const nextNote = project.note ? `${project.note}\n\n${noteEntry}` : noteEntry;
  const { error: updateError } = await supabaseAdmin()
    .from("natori_projects")
    .update({
      status: "quoted",
      next_action: getNextActionForStatus("quoted"),
      note: nextNote,
    })
    .eq("id", project.id)
    .eq("user_id", ownerId);
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
