import "server-only";

import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { injectAcceptLink, buildOrderMailLogEntry, QUOTE_VALID_DAYS } from "@/features/natori/lib/orderMail";
import { getNextActionForStatus } from "@/features/natori/lib/projects";
import { issueNatoriQuoteViaRpc } from "@/features/natori/server/quoteIssueRpcAdapter";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteUrl } from "@/lib/constants";
import type { NatoriQuoteIssuePayloadV1 } from "@/features/natori/types/quoteSnapshot";

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

export type IssueStructuredQuoteInput = NatoriQuoteIssuePayloadV1;

export type IssueStructuredQuoteResult =
  | { kind: "ok"; quoteId: string; version: number; reused: boolean }
  | { kind: "not-found" | "not-configured" | "invalid-state" | "rejected" | "db-error" | "mail-error"; reason?: string };

export async function issueStructuredQuoteAndSend(
  input: IssueStructuredQuoteInput,
): Promise<IssueStructuredQuoteResult> {
  if (!RESEND_API_KEY) return { kind: "not-configured" };

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

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    Date.now() + QUOTE_VALID_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const issued = await issueNatoriQuoteViaRpc({
    ...input,
    ownerId,
    title: project.title,
    clientName: project.client_name,
    tokenHash,
    expiresAt,
  });
  if (issued.kind === "rejected") {
    return { kind: "rejected", reason: issued.reason };
  }
  if (issued.kind === "db-error") return { kind: "db-error" };

  const body = injectAcceptLink(
    input.bodySnapshot,
    `${getSiteUrl()}/natori/quote/${token}`,
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
