import { PAYMENT_DUE_DAYS } from "./orderMail";

export type LegacyPaymentLinkEvidence = {
  linkId: string | null;
  url: string | null;
  projectedStatus: string | null;
  paymentConfirmedAt: string | null;
  closed: boolean;
  archived: boolean;
  // A caller must explicitly fetch the same Stripe object in the configured account/mode.
  providerLinkId: string | null;
  providerUrl: string | null;
  providerActive: boolean | null;
  paymentReconciliation: "clear" | "received" | "unknown";
  successfulMail: ReadonlyArray<{ linkUrl: string | null; sentAt: string | null }>;
};

export type LegacyPaymentLinkAssessment =
  | { state: "absent" }
  | { state: "needs_review"; reason: string }
  | { state: "active" | "inactive" | "stop_required"; linkId: string; url: string; deadline: string };

/** Read-only migration candidate. Never changes a URL, extends an existing deadline,
 * infers an external result, or backfills business rows. No wall-clock expiry rewrite:
 * an elapsed deadline still needs a separately fenced provider stop operation. */
export function assessLegacyPaymentLink(evidence: LegacyPaymentLinkEvidence): LegacyPaymentLinkAssessment {
  if (!evidence.linkId && !evidence.url && !evidence.projectedStatus) return { state: "absent" };
  if (!evidence.linkId || !evidence.url) return { state: "needs_review", reason: "incomplete_link_identity" };
  if (evidence.providerLinkId !== evidence.linkId || evidence.providerUrl !== evidence.url
    || typeof evidence.providerActive !== "boolean") return { state: "needs_review", reason: "provider_identity_unverified" };
  if (evidence.paymentReconciliation === "unknown") return { state: "needs_review", reason: "payment_reconciliation_required" };
  if (evidence.paymentConfirmedAt || evidence.paymentReconciliation === "received") {
    return { state: "needs_review", reason: "received_payment_preserve_facts" };
  }
  // Existing issuing/failed attempts have no durable generation identity. Provider
  // evidence alone cannot prove which external attempt produced this projection.
  if (evidence.projectedStatus === "issuing") return { state: "needs_review", reason: "issuance_attempt_unresolved" };
  const matching = evidence.successfulMail.filter(mail => mail.linkUrl === evidence.url && mail.sentAt !== null);
  if (matching.length === 0) return { state: "needs_review", reason: "deadline_evidence_missing" };
  const times = matching.map(mail => Date.parse(mail.sentAt!));
  if (times.some(time => !Number.isFinite(time))) return { state: "needs_review", reason: "deadline_evidence_invalid" };
  // Match the legacy latest-successful-mail policy exactly, including prior resends.
  const deadlineMs = Math.max(...times) + PAYMENT_DUE_DAYS * 86_400_000;
  if (!Number.isFinite(deadlineMs) || Math.abs(deadlineMs) > 8.64e15) return { state: "needs_review", reason: "deadline_evidence_invalid" };
  const common = { linkId: evidence.linkId, url: evidence.url, deadline: new Date(deadlineMs).toISOString() };
  if (!evidence.providerActive) return { state: "inactive", ...common };
  if (evidence.closed || evidence.archived) return { state: "stop_required", ...common };
  if (!['sent', 'ready', 'send_failed'].includes(evidence.projectedStatus ?? '')) {
    return { state: "needs_review", reason: "projection_provider_conflict" };
  }
  return { state: "active", ...common };
}
