import "server-only";
import { z } from "zod";
import type {
  CaseFinancialReviewFact, CaseNotificationAttempt, CaseObservation, CaseOperationFact,
  CasePaymentLinkFact, CaseSnapshot, CaseTarget,
} from "../types/caseReadModel";
import {
  absentSource, incompleteSource, readySource, sourceFact, sourceFailure, sourceId,
  sourceMoney, sourceOccurred, sourceRows, sourceTime, sourceTimestamp, compareSourceTimes, sameSourceTime,
  type CaseRelation, type CaseSourceContext, type CaseSourceRows,
} from "./caseSnapshotSource";

/**
 * Fixed, owner-scoped fragments for the single-statement reader. IDs of provider
 * objects, bearer URLs, message bodies and encrypted payloads never leave SQL.
 * The inbox's opaque ID encodes its actual composite PK; it is not a ledger row.
 */
export const CURRENT_LINK_READ_PROJECTION = "a.id::text AS attempt_id, md5(l.link_url) AS link_identity, coalesce(l.link_url=p.payment_link_url AND l.quote_id=p.payment_quote_id,false) AS is_project_link";
export const FINANCIAL_RELATIONS: CaseRelation[] = [
  { name: "financial_quotes", select: `SELECT q.id::text, q.project_id::text, q.user_id::text,
      q.version, q.amount, q.expires_at, q.accepted_at, q.superseded_at, q.created_at, q.issued_at
    FROM public.natori_quotes q JOIN authorized_case p ON q.project_id=p.id AND q.user_id=p.user_id` },
  { name: "financial_drafts", select: `SELECT d.project_id::text AS id, d.project_id::text,
      d.user_id::text, d.revision, d.updated_at
    FROM public.natori_estimate_drafts d JOIN authorized_case p ON d.project_id=p.id AND d.user_id=p.user_id` },
  { name: "financial_links", select: `SELECT a.id::text, a.project_id::text, a.owner_id::text,
      a.quote_id::text, a.generation, a.amount, a.state, a.deadline, a.deadline_revision,
      a.created_at, a.updated_at, (a.link_id IS NOT NULL AND a.link_url IS NOT NULL) AS has_provider_link,
      coalesce(a.link_id=p.payment_link_id AND a.link_url=p.payment_link_url,false) AS is_project_link
    FROM public.natori_payment_link_attempts a JOIN authorized_case p ON a.project_id=p.id AND a.owner_id=p.user_id` },
  { name: "financial_payments", select: `SELECT t.id::text, t.project_id::text, t.quote_id::text,
      t.amount, t.status, t.received_at, t.stripe_currency AS currency,
      (t.stripe_session_id IS NOT NULL) AS has_session,
      coalesce(t.stripe_session_id=p.stripe_payment_session_id,false) AS is_original,
      (p.stripe_payment_session_id IS NULL AND t.stripe_session_id IS NULL AND t.status='manual'
        AND t.received_at=p.payment_confirmed_at AND t.amount=p.paid_amount) IS TRUE AS is_manual_candidate,
      (t.status='needs_review' AND t.note='amount_unavailable') IS TRUE AS amount_unavailable,
      (t.status='received' AND t.stripe_account_scope IS NOT NULL AND t.stripe_livemode IS NOT NULL
        AND (t.stripe_payment_intent_id IS NOT NULL OR t.stripe_charge_id IS NOT NULL)) AS has_refund_mapping
    FROM public.natori_payment_transactions t JOIN authorized_case p ON t.project_id=p.id` },
  { name: "financial_inbox", select: `SELECT md5(jsonb_build_array(e.account_scope,e.livemode,e.event_id)::text) AS id,
      e.project_id::text, e.owner_id::text, e.status, e.created_at, e.updated_at
    FROM public.natori_stripe_event_inbox e JOIN authorized_case p ON e.project_id=p.id AND e.owner_id=p.user_id
    WHERE e.status IN ('processing','needs_review') AND (
      e.request->>'kind' IS DISTINCT FROM 'refund'
      OR e.error_code IN ('refund_snapshot_missing','refund_snapshot_incomplete','refund_id_missing','event_identity_conflict')
      OR e.status='processing')` },
  { name: "financial_refunds", select: `SELECT r.id::text, r.project_id::text, r.owner_id::text,
      r.transaction_id::text, r.amount, r.currency, r.provider_status, r.resolution,
      r.confirmed_at, r.created_at, r.updated_at,
      (r.claimed_project_id IS NULL OR r.claimed_project_id=p.id) AS project_matches
    FROM public.natori_refund_ledger r JOIN authorized_case p ON r.project_id=p.id AND r.owner_id=p.user_id` },
  { name: "financial_notifications", select: `SELECT j.id::text, j.project_id::text, j.quote_id::text,
      md5(j.notification_key) AS notification_key, j.attempt_no, j.purpose, j.status,
      j.sent_at, j.created_at, j.updated_at,
      jsonb_build_object('version',j.snapshot->'version','amount',j.snapshot->'amount',
        'acceptedAt',j.snapshot->'acceptedAt','attemptId',j.snapshot->'attemptId',
        'generation',j.snapshot->'generation','deadline',j.snapshot->'deadline',
        'releaseId',j.snapshot->'releaseId','roughId',j.snapshot->'roughId',
        'clientOkAt',j.snapshot->'clientOkAt','messageId',j.snapshot->'messageId',
        'operationId',j.snapshot->'operationId') AS snapshot,
      r.id::text AS release_id, r.expires_at AS release_expires_at, r.accepted_at AS release_accepted_at,
      m.id::text AS message_id, m.created_at AS message_created_at, m.sender AS message_sender,
      m.operation_id::text AS message_operation_id,
      e.rough_id::text AS rough_id, e.client_ok_at AS rough_ok_at
    FROM public.natori_notification_jobs j JOIN authorized_case p ON j.project_id=p.id
    LEFT JOIN public.natori_delivery_releases r ON r.project_id=p.id AND
      ((j.purpose='delivery_issue_client' AND r.id::text=j.snapshot->>'releaseId')
        OR j.purpose IN ('delivery_accept_artist','delivery_accept_client'))
    LEFT JOIN public.natori_consultation_messages m ON m.project_id=p.id AND m.id::text=j.snapshot->>'messageId'
    LEFT JOIN public.natori_rough_ok_events e ON e.project_id=p.id AND e.rough_id::text=j.snapshot->>'roughId'` },
  { name: "financial_legacy_notices", select: `SELECT l.id::text, l.project_id::text, l.quote_id::text,
      l.kind, l.amount, l.status, l.sent_at, l.created_at, l.updated_at,
      ${CURRENT_LINK_READ_PROJECTION}
    FROM public.natori_order_mail_logs l JOIN authorized_case p ON l.project_id=p.id
    LEFT JOIN public.natori_payment_link_attempts a ON a.project_id=p.id AND a.owner_id=p.user_id
      AND l.kind='payment' AND a.link_url=l.link_url AND a.quote_id=l.quote_id AND a.amount=l.amount` },
  { name: "financial_quote_operations", select: `SELECT o.operation_id::text AS id, o.project_id::text,
      o.quote_id::text, o.notification_id::text, o.created_at
    FROM public.natori_quote_issue_operations o JOIN authorized_case p ON o.project_id=p.id` },
  { name: "financial_link_operations", select: `SELECT o.operation_id::text AS id, o.project_id::text,
      o.attempt_id::text, o.action, o.status, o.proposed_deadline, o.expected_revision,
      o.notification_id::text, o.created_at,
      (SELECT jsonb_build_object('id',r.id,'kind',r.kind,'at',r.created_at) FROM public.natori_case_reconciliation_resolutions r
       WHERE r.id=o.reconciliation_id AND r.project_id=o.project_id AND r.target_id=o.operation_id) AS reconciliation
    FROM public.natori_payment_link_operations o JOIN authorized_case p ON o.project_id=p.id` },
  { name: "financial_link_stops", select: `SELECT s.id::text, s.project_id::text, s.owner_id::text,
      s.attempt_id::text, s.deadline_revision, s.status, s.created_at, s.updated_at
    FROM public.natori_payment_link_stops s JOIN authorized_case p ON s.project_id=p.id AND s.owner_id=p.user_id` },
  { name: "financial_delivery_operations", select: `SELECT o.operation_id::text AS id, o.project_id::text,
      o.release_id::text, o.notification_id::text, o.created_at,
      r.expires_at AS original_expires_at, x.new_expires_at AS extension_expires_at,
      md5(j.notification_key) AS notification_key
    FROM public.natori_delivery_operations o JOIN authorized_case p ON o.project_id=p.id
    LEFT JOIN public.natori_delivery_releases r ON r.id=o.release_id AND r.project_id=p.id
    LEFT JOIN public.natori_delivery_extensions x ON x.project_id=p.id AND x.release_id=r.id AND x.operation_id=o.operation_id
    LEFT JOIN public.natori_notification_jobs j ON j.id=o.notification_id AND j.project_id=p.id AND j.purpose='delivery_issue_client'` },
  { name: "financial_consultation_operations", select: `SELECT
      o.sender||'/'||o.operation_id::text AS id, o.project_id::text, o.operation_id::text,
      o.sender, o.status, o.message_id::text, o.notification_id::text, o.created_at,
      m.created_at AS message_created_at
    FROM public.natori_consultation_operations o JOIN authorized_case p ON o.project_id=p.id
    LEFT JOIN public.natori_consultation_messages m ON m.id=o.message_id AND m.project_id=p.id
      AND m.sender=o.sender AND m.operation_id=o.operation_id` },
];

const identity = { id: sourceId, project_id: sourceId };
const nullableId = sourceId.nullable();
const nullableTime = sourceTime.nullable();
const positiveInteger = z.number().int().positive().safe();
const quoteSchema = z.object({
  ...identity, user_id: sourceId, version: positiveInteger, amount: sourceMoney,
  expires_at: sourceTime, accepted_at: nullableTime, superseded_at: nullableTime,
  created_at: sourceTime, issued_at: nullableTime,
});
const draftSchema = z.object({ ...identity, user_id: sourceId, revision: positiveInteger, updated_at: sourceTime });
const linkSchema = z.object({
  ...identity, owner_id: sourceId, quote_id: sourceId, generation: positiveInteger, amount: sourceMoney,
  state: z.enum(["creating", "active", "stop_required", "deactivating", "inactive", "needs_review"]),
  deadline: sourceTime, deadline_revision: positiveInteger, created_at: sourceTime, updated_at: sourceTime,
  has_provider_link: z.boolean(), is_project_link: z.boolean(),
});
const paymentSchema = z.object({
  ...identity, quote_id: nullableId, amount: sourceMoney,
  status: z.enum(["received", "manual", "amount_mismatch", "quote_mismatch", "duplicate_payment", "needs_review"]),
  received_at: sourceTime, currency: z.string().min(1).nullable(), has_session: z.boolean(),
  is_original: z.boolean(), is_manual_candidate: z.boolean(), amount_unavailable: z.boolean(),
  has_refund_mapping: z.boolean(),
});
const inboxSchema = z.object({
  ...identity, owner_id: sourceId, status: z.enum(["processing", "needs_review"]),
  created_at: sourceTime, updated_at: sourceTime,
});
const refundSchema = z.object({
  ...identity, owner_id: sourceId, transaction_id: nullableId, amount: sourceMoney.nullable(),
  currency: z.string().min(1).nullable(),
  provider_status: z.enum(["pending", "requires_action", "succeeded", "failed", "canceled", "unknown"]),
  resolution: z.enum(["unmatched", "resolved", "needs_review"]), confirmed_at: nullableTime,
  created_at: sourceTime, updated_at: sourceTime, project_matches: z.boolean(),
});
// Unknown purposes remain parseable so they become an explicit unsupported
// domain, rather than being silently filtered out of the read.
const noticeSchema = z.object({
  ...identity, quote_id: nullableId, notification_key: sourceId, attempt_no: positiveInteger,
  purpose: sourceId, status: z.enum(["pending", "sending", "sent", "failed", "unknown"]),
  sent_at: nullableTime, created_at: sourceTime, updated_at: sourceTime,
  snapshot: z.record(z.string(), z.unknown()),
  release_id: nullableId, release_expires_at: nullableTime, release_accepted_at: nullableTime,
  message_id: nullableId, message_created_at: nullableTime, message_sender: z.enum(["staff", "client"]).nullable(),
  message_operation_id: nullableId, rough_id: nullableId, rough_ok_at: nullableTime,
});
const legacySchema = z.object({
  ...identity, quote_id: nullableId, kind: sourceId, amount: sourceMoney,
  status: z.enum(["pending", "sent", "failed", "state_error"]), sent_at: nullableTime,
  created_at: sourceTime, updated_at: sourceTime, attempt_id: nullableId,
  link_identity: nullableId.optional(), is_project_link:z.boolean().optional(),
});
const quoteOperationSchema = z.object({
  ...identity, quote_id: sourceId, notification_id: sourceId, created_at: sourceTime,
});
const linkOperationSchema = z.object({
  ...identity, attempt_id: sourceId, action: z.enum(["issue", "renotify", "extend", "reissue", "adopt"]),
  reconciliation: z.object({id: sourceId,kind: z.enum(["link_confirmed","stopped_confirmed"]),at:sourceTime}).nullish(),
  status: z.enum(["pending", "completed"]), proposed_deadline: nullableTime,
  expected_revision: positiveInteger.nullable(), notification_id: nullableId, created_at: sourceTime,
});
const stopSchema = z.object({
  ...identity, owner_id: sourceId, attempt_id: nullableId, deadline_revision: positiveInteger.nullable(),
  status: z.enum(["pending", "processing", "completed", "needs_review"]), created_at: sourceTime, updated_at: sourceTime,
});
const deliveryOperationSchema = z.object({
  ...identity, release_id: sourceId, notification_id: sourceId, created_at: sourceTime,
  original_expires_at: nullableTime, extension_expires_at: nullableTime, notification_key: nullableId,
});
const consultationOperationSchema = z.object({
  ...identity, operation_id: sourceId, sender: z.enum(["staff", "client"]),
  status: z.enum(["reserved", "verifying", "committed", "cancelled", "cleanup", "cleaned"]),
  message_id: nullableId, notification_id: nullableId, created_at: sourceTime, message_created_at: nullableTime,
});
type QuoteRow = z.infer<typeof quoteSchema>;
type LinkRow = z.infer<typeof linkSchema>;
type PaymentRow = z.infer<typeof paymentSchema>;
type NoticeRow = z.infer<typeof noticeSchema>;
type DeliveryOperationRow = z.infer<typeof deliveryOperationSchema>;
const unsupported = (): CaseObservation<never> => ({ state: "unavailable", reason: "unsupported" });
const iso = sourceTimestamp;
const sameTime = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b
    : sourceTime.safeParse(a).success && sourceTime.safeParse(b).success && sameSourceTime(a, b);
const atOrAfter = (value: string, earlier: string) => compareSourceTimes(value, earlier) >= 0;
const legacyNoticeDeadline = (sentAt: string): string => {
  const canonical = sourceTimestamp(sentAt);
  const wholeSecond = canonical.slice(0, 19);
  const sevenDaysLater = new Date(Date.parse(`${wholeSecond}Z`) + 7 * 86400000).toISOString();
  // Date arithmetic is only on whole seconds; retain the original fractional
  // second so two PostgreSQL deadlines do not collapse to one millisecond.
  return `${sevenDaysLater.slice(0, 19)}${canonical.slice(19)}`;
};
const validQuote = (ctx: CaseSourceContext, q: QuoteRow) =>
  q.user_id === ctx.project.user_id && sourceOccurred(ctx, q.created_at)
  && (q.issued_at === null || (sourceOccurred(ctx, q.issued_at) && atOrAfter(q.issued_at, q.created_at)))
  && (q.accepted_at === null || (sourceOccurred(ctx, q.accepted_at)
    && atOrAfter(q.accepted_at, q.issued_at ?? q.created_at)))
  && (q.superseded_at === null || (sourceOccurred(ctx, q.superseded_at)
    && atOrAfter(q.superseded_at, q.issued_at ?? q.created_at)));
const validLink = (ctx: CaseSourceContext, a: LinkRow) =>
  a.owner_id === ctx.project.user_id && sourceOccurred(ctx, a.created_at)
  && sourceOccurred(ctx, a.updated_at) && atOrAfter(a.updated_at, a.created_at);
const money = (amount: number) => ({ amount, currency: "JPY" });
const quoteTarget = (q: QuoteRow): CaseTarget => ({ kind: "quote", id: q.id, revision: String(q.version) });
const linkTarget = (a: LinkRow, deadline = a.deadline): CaseTarget =>
  ({ kind: "payment_link", id: a.id, revision: iso(deadline) });
const failure = (...sections: CaseSourceRows<unknown>[]): CaseObservation<never> | undefined => {
  const failed = sections.find(section => section.state !== "ready");
  return failed ? sourceFailure(failed) : undefined;
};
const ordered = <T extends { id: string }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function adaptQuote(
  ctx: CaseSourceContext, quotes: CaseSourceRows<QuoteRow>, drafts: CaseSourceRows<z.infer<typeof draftSchema>>,
): CaseSnapshot["quote"] {
  if (quotes.state !== "ready") return sourceFailure(quotes);
  if (quotes.rows.some(q => !validQuote(ctx, q))
    || new Set(quotes.rows.map(q => q.version)).size !== quotes.rows.length) return incompleteSource();
  if (!ctx.project.active_quote_id) {
    if (ctx.project.quote_accepted_at || ctx.project.quote_accepted_amount !== null
      || quotes.rows.some(q => q.superseded_at === null)) return incompleteSource();
    if (drafts.state !== "ready") return sourceFailure(drafts);
    if (drafts.rows.some(d => d.user_id !== ctx.project.user_id || !sourceOccurred(ctx, d.updated_at))) return incompleteSource();
    // A draft's revision is not a quote version, and it has no issued money fact.
    if (drafts.rows.length) return unsupported();
    return absentSource(ctx);
  }
  const q = quotes.rows.find(row => row.id === ctx.project.active_quote_id);
  if (!q || !sameTime(q.accepted_at, ctx.project.quote_accepted_at)
    || (q.accepted_at !== null && ctx.project.quote_accepted_amount !== q.amount)
    || (q.accepted_at === null && ctx.project.quote_accepted_amount !== null)) return incompleteSource();
  return readySource(ctx, {
    ...sourceFact(ctx, q.id, q.created_at, q), version: q.version,
    state: q.superseded_at ? "superseded" : "issued", money: money(q.amount), validUntil: q.expires_at,
    acceptance: q.accepted_at ? {
      quoteId: q.id, version: q.version, acceptedAt: q.accepted_at, money: money(q.amount),
    } : null,
  });
}

function adaptLink(ctx: CaseSourceContext, links: CaseSourceRows<LinkRow>, quotes: CaseSourceRows<QuoteRow>,legacy:CaseSourceRows<z.infer<typeof legacySchema>>): CaseSnapshot["link"] {
  if (links.state !== "ready") return sourceFailure(links);
  if (!links.rows.length) {
    if(legacy.state==="ready"&&quotes.state==="ready"&&ctx.project.has_legacy_payment_link){
      const q=quotes.rows.find(q=>q.id===ctx.project.active_quote_id&&q.user_id===ctx.project.user_id);
      const sent=legacy.rows.filter(l=>l.kind==="payment"&&l.status==="sent"&&l.sent_at&&l.link_identity&&l.is_project_link&&l.quote_id===q?.id&&l.amount===q.amount)
        .sort((a,b)=>compareSourceTimes(b.sent_at!,a.sent_at!));
      const latest=sent[0];
      if(q&&validQuote(ctx,q)&&q.accepted_at&&!q.superseded_at&&latest&&sourceOccurred(ctx,latest.sent_at!)&&atOrAfter(latest.sent_at!,q.accepted_at)&&atOrAfter(latest.sent_at!,latest.created_at)&&atOrAfter(latest.updated_at,latest.sent_at!))return readySource(ctx,{
        ...sourceFact(ctx,`current-link:${latest.link_identity}`,latest.sent_at!,latest,"legacy_projection"),quoteId:q.id,quoteVersion:q.version,
        generation:null,deadlineRevision:iso(legacyNoticeDeadline(latest.sent_at!)),money:money(q.amount),expiresAt:legacyNoticeDeadline(latest.sent_at!),
        state:ctx.project.payment_link_status==="void"?"stopped":ctx.project.payment_link_status==="sent"?"active":"unknown",providerState:"unverified",termsPolicy:"sent_plus_7_days",
      });
    }
    return ctx.project.has_legacy_payment_link || ctx.project.payment_link_status !== null
      ? unsupported() : absentSource(ctx);
  }
  if (quotes.state !== "ready") return sourceFailure(quotes);
  if (new Set(links.rows.map(a => a.generation)).size !== links.rows.length
    || links.rows.some(a => !validLink(ctx, a))) return incompleteSource();
  // This is the generation order defined by the existing command/read contract.
  const a = [...links.rows].sort((a, b) => b.generation - a.generation)[0];
  const q = quotes.rows.find(q => q.id === a.quote_id && q.user_id === ctx.project.user_id);
  if (!q || !validQuote(ctx, q) || q.amount !== a.amount || !q.accepted_at
    || (a.state === "active" && (!a.has_provider_link || !a.is_project_link))) return incompleteSource();
  const states: Record<LinkRow["state"], CasePaymentLinkFact["state"]> = {
    creating: "preparing", active: "active", stop_required: "stopping",
    deactivating: "stopping", inactive: "stopped", needs_review: "unknown",
  };
  return readySource(ctx, {
    ...sourceFact(ctx, a.id, a.created_at, a), quoteId: q.id, quoteVersion: q.version,
    generation: a.generation, deadlineRevision: iso(a.deadline), money: money(a.amount),
    expiresAt: a.deadline, state: states[a.state],
    // These are durable observations from finish/reconciliation, not a live call.
    providerState: a.state === "active" ? "active" : a.state === "inactive" ? "inactive" : "unverified",
  });
}

function adaptPayment(ctx: CaseSourceContext, payments: CaseSourceRows<PaymentRow>): CaseSnapshot["payment"] {
  if (payments.state !== "ready") return sourceFailure(payments);
  if (payments.rows.some(t => !sourceOccurred(ctx, t.received_at))) return incompleteSource();
  const p = ctx.project;
  const confirmedAt = p.payment_confirmed_at ?? p.paid_at;
  if (!confirmedAt) {
    return p.paid_amount !== null || payments.rows.some(t => t.status === "received" || t.status === "manual")
      ? incompleteSource() : absentSource(ctx);
  }
  if (!sourceOccurred(ctx, confirmedAt)
    || (p.payment_confirmed_at && p.paid_at && !sameTime(p.payment_confirmed_at, p.paid_at))) return incompleteSource();
  const candidates = payments.rows.filter(t => t.is_original || t.is_manual_candidate);
  if (candidates.length > 1) return incompleteSource();
  const t = candidates[0];
  if (t) {
    if ((t.is_original && (t.status !== "received" || !t.has_session))
      || (t.is_manual_candidate && (t.status !== "manual" || t.has_session))
      || t.amount_unavailable || !sameTime(t.received_at, confirmedAt)
      || (p.paid_amount !== null && p.paid_amount !== t.amount)
      || (t.currency !== null && t.currency.toUpperCase() !== "JPY")) return incompleteSource();
    return readySource(ctx, {
      ...sourceFact(ctx, t.id, t.received_at, t, t.status === "manual" ? "manual_record" : "ledger"),
      confirmedAt, money: money(t.amount), method: t.status === "manual" ? "manual" : "stripe",
    });
  }
  // Existing confirmed payment survives absent legacy transaction correlation.
  // Mutable project.amount is never substituted for the amount actually paid.
  return readySource(ctx, {
    ...sourceFact(ctx, p.id, confirmedAt, { confirmedAt, paidAmount: p.paid_amount }, "legacy_projection"),
    confirmedAt, money: p.paid_amount === null ? null : money(p.paid_amount), method: "unclassified",
  });
}

function adaptFinancialReview(
  ctx: CaseSourceContext, payments: CaseSourceRows<PaymentRow>,
  inbox: CaseSourceRows<z.infer<typeof inboxSchema>>, refunds: CaseSourceRows<z.infer<typeof refundSchema>>,
): CaseSnapshot["financialReview"] {
  const unavailable = failure(payments, inbox, refunds);
  if (unavailable) return unavailable;
  if (payments.state !== "ready" || inbox.state !== "ready" || refunds.state !== "ready") return incompleteSource();
  const facts: CaseFinancialReviewFact[] = [];
  for (const t of payments.rows) {
    if (!sourceOccurred(ctx, t.received_at)) return incompleteSource();
    if (t.status !== "received" && t.status !== "manual") facts.push({
      ...sourceFact(ctx, `payment:${t.id}`, t.received_at, t), kind: "payment_review",
    });
  }
  for (const e of inbox.rows) {
    if (e.owner_id !== ctx.project.user_id || !sourceOccurred(ctx, e.created_at)
      || !sourceOccurred(ctx, e.updated_at) || !atOrAfter(e.updated_at, e.created_at)) return incompleteSource();
    facts.push({ ...sourceFact(ctx, `inbox:${e.id}`, e.created_at, e),
      kind: e.status === "processing" ? "payment_processing" : "payment_review" });
  }
  const confirmedRefundTotals = new Map<string, number>();
  for (const r of refunds.rows) {
    if (r.owner_id !== ctx.project.user_id || !r.project_matches || !sourceOccurred(ctx, r.created_at)
      || !sourceOccurred(ctx, r.updated_at) || !atOrAfter(r.updated_at, r.created_at)
      || (r.confirmed_at && !sourceOccurred(ctx, r.confirmed_at))) return incompleteSource();
    if (r.resolution === "resolved") {
      const t = payments.rows.find(t => t.id === r.transaction_id);
      if (!t || t.status !== "received" || !t.is_original || !t.has_refund_mapping
        || !r.amount || r.amount > t.amount || !r.currency || !t.currency
        || r.currency.toUpperCase() !== t.currency.toUpperCase()) return incompleteSource();
      if (r.provider_status === "succeeded") {
        if (!r.confirmed_at) return incompleteSource();
        const total = (confirmedRefundTotals.get(t.id) ?? 0) + r.amount;
        if (!Number.isSafeInteger(total) || total > t.amount) return incompleteSource();
        confirmedRefundTotals.set(t.id, total);
        // This domain is unresolved attention, not a refund history ledger.
        continue;
      }
    }
    facts.push({ ...sourceFact(ctx, `refund:${r.id}`, r.created_at, r),
      kind: r.resolution === "resolved" && ["pending", "requires_action"].includes(r.provider_status)
        ? "refund_pending" : "refund_review" });
  }
  const hasPayment = ctx.project.payment_confirmed_at !== null || ctx.project.paid_at !== null
    || ctx.project.paid_amount !== null;
  if (hasPayment && !payments.rows.some(t => t.status === "received" && t.is_original && t.has_refund_mapping)) {
    // No fabricated refund ID for historical/manual rows lacking Stripe mapping.
    return unsupported();
  }
  return readySource(ctx, ordered(facts));
}

function deliveryNoticeDeadline(j: NoticeRow, ops: readonly DeliveryOperationRow[]): string | null {
  const related = ops.filter(o => o.notification_key === j.notification_key && o.release_id === j.release_id);
  const deadlines = [...new Set(related.map(o => o.extension_expires_at ?? o.original_expires_at)
    .filter((value): value is string => value !== null).map(iso))];
  // Encrypted payload.expiresAt controls payload retention (usually 24 hours),
  // not delivery access. Only the immutable operation identifies notice terms.
  // Retry attempts share its notification key. Never use current max expiry.
  return deadlines.length === 1 ? deadlines[0] : null;
}

function adaptNotifications(
  ctx: CaseSourceContext, notices: CaseSourceRows<NoticeRow>,
  legacy: CaseSourceRows<z.infer<typeof legacySchema>>, quotes: CaseSourceRows<QuoteRow>,
  links: CaseSourceRows<LinkRow>, deliveryOps: CaseSourceRows<DeliveryOperationRow>,
): CaseSnapshot["notifications"] {
  const unavailable = failure(notices, legacy);
  if (unavailable) return unavailable;
  if (notices.state !== "ready" || legacy.state !== "ready") return incompleteSource();
  const facts: CaseNotificationAttempt[] = [];
  for (const j of notices.rows) {
    // 受付フォームの受付メール（依頼者宛・ナトリ宛）は見積・支払い・納品のどの対象にも結びつかない。
    // 送信済みなら案件の状態に関わらないので読み飛ばす。これを「未対応」と読むと、新しい依頼では
    // メールの記録全体が読めない扱いになり、「見積を作る」が自分の番に出なくなる。
    // 送信前・失敗のものは今までどおり未対応として扱う。
    if ((j.purpose === "intake_client" || j.purpose === "intake_artist") && j.status === "sent") continue;
    if (!sourceOccurred(ctx, j.created_at) || !sourceOccurred(ctx, j.updated_at)
      || (j.status === "sent" ? !j.sent_at || !sourceOccurred(ctx, j.sent_at) : j.sent_at !== null)
      || !atOrAfter(j.updated_at, j.created_at)
      || (j.sent_at !== null && (!atOrAfter(j.sent_at, j.created_at) || !atOrAfter(j.updated_at, j.sent_at)))
      || j.attempt_no > 5) return incompleteSource();
    let target: CaseTarget;
    let purpose: CaseNotificationAttempt["purpose"];
    let operationId: string | null = null;
    if (j.purpose === "quote_issue_client" || j.purpose === "quote_accept_artist") {
      if (quotes.state !== "ready") return sourceFailure(quotes);
      const q = quotes.rows.find(q => q.id === j.quote_id && q.user_id === ctx.project.user_id);
      if (!q || !validQuote(ctx, q)) return incompleteSource();
      if (j.purpose === "quote_issue_client") {
        if (j.snapshot.version !== q.version) return incompleteSource();
        purpose = "quote_notice";
      } else {
        if (j.snapshot.amount !== q.amount || typeof j.snapshot.acceptedAt !== "string"
          || !q.accepted_at || !sameTime(j.snapshot.acceptedAt, q.accepted_at)) return incompleteSource();
        purpose = "staff_notice";
      }
      target = quoteTarget(q);
    } else if (j.purpose === "payment_link_client") {
      if (links.state !== "ready") return sourceFailure(links);
      if (quotes.state !== "ready") return sourceFailure(quotes);
      const a = links.rows.find(a => a.id === j.snapshot.attemptId && a.owner_id === ctx.project.user_id);
      const q = quotes.rows.find(q => q.id === j.quote_id && q.user_id === ctx.project.user_id);
      if (!a || !validLink(ctx, a) || a.quote_id !== j.quote_id || j.snapshot.generation !== a.generation
        || !q || !validQuote(ctx, q) || q.amount !== a.amount || !q.accepted_at
        || !sourceTime.safeParse(j.snapshot.deadline).success) return incompleteSource();
      target = linkTarget(a, j.snapshot.deadline as string);
      purpose = "payment_notice";
    } else if (j.purpose === "delivery_issue_client") {
      if (deliveryOps.state !== "ready") return sourceFailure(deliveryOps);
      if (!j.release_id || j.snapshot.releaseId !== j.release_id) return incompleteSource();
      const deadline = deliveryNoticeDeadline(j, deliveryOps.rows);
      if (!deadline) return incompleteSource();
      target = { kind: "delivery", id: j.release_id, revision: deadline };
      purpose = "delivery_notice";
    } else if (j.purpose === "delivery_accept_client" || j.purpose === "delivery_accept_artist") {
      if (!j.release_id) return unsupported(); // Old acceptance has no release FK.
      if (!j.release_accepted_at || typeof j.snapshot.acceptedAt !== "string"
        || !sourceOccurred(ctx, j.release_accepted_at)
        || !sameTime(j.release_accepted_at, j.snapshot.acceptedAt)) return incompleteSource();
      target = { kind: "delivery", id: j.release_id, revision: iso(j.release_accepted_at) };
      purpose = j.purpose === "delivery_accept_client" ? "receipt_notice" : "staff_notice";
    } else if (j.purpose === "rough_ok_artist") {
      if (!j.rough_id || !j.rough_ok_at || j.snapshot.roughId !== j.rough_id
        || !sourceOccurred(ctx, j.rough_ok_at)
        || typeof j.snapshot.clientOkAt !== "string" || !sameTime(j.rough_ok_at, j.snapshot.clientOkAt)) return incompleteSource();
      target = { kind: "rough", id: j.rough_id, revision: iso(j.rough_ok_at) };
      purpose = "staff_notice";
    } else if (j.purpose === "consultation_client" || j.purpose === "consultation_staff") {
      if (!j.message_id || !j.message_created_at || j.snapshot.messageId !== j.message_id
        || !sourceOccurred(ctx, j.message_created_at)
        || (j.purpose === "consultation_client" ? j.message_sender !== "staff" : j.message_sender !== "client")
        || (j.snapshot.operationId != null && j.snapshot.operationId !== j.message_operation_id)) return incompleteSource();
      target = { kind: "consultation", id: j.message_id, revision: iso(j.message_created_at) };
      purpose = j.purpose === "consultation_client" ? "consultation_notice" : "staff_notice";
      operationId = j.message_operation_id;
    } else return unsupported(); // Payment/refund/intake have no target kind in v1.
    facts.push({
      ...sourceFact(ctx, j.id, j.created_at, j), target, purpose,
      notificationKey: j.notification_key, attemptNo: j.attempt_no, operationId,
      status: j.status, sentAt: j.sent_at, resolvedByAttemptId: null,
    });
  }
  for (const l of legacy.rows) {
    if (!sourceOccurred(ctx, l.created_at) || !sourceOccurred(ctx, l.updated_at)
      || !atOrAfter(l.updated_at, l.created_at)
      || (l.sent_at !== null && !sourceOccurred(ctx, l.sent_at))
      || (l.sent_at !== null && (!atOrAfter(l.sent_at, l.created_at) || !atOrAfter(l.updated_at, l.sent_at)))
      || (["sent", "state_error"].includes(l.status) && !l.sent_at)) return incompleteSource();
    let target: CaseTarget;
    let purpose: CaseNotificationAttempt["purpose"];
    if (l.kind === "estimate") {
      if (quotes.state !== "ready") return sourceFailure(quotes);
      const q = quotes.rows.find(q => q.id === l.quote_id && q.user_id === ctx.project.user_id);
      if (!q || !validQuote(ctx, q) || q.amount !== l.amount) return incompleteSource();
      target = quoteTarget(q); purpose = "quote_notice";
    } else if (l.kind === "payment") {
      if (links.state !== "ready") return sourceFailure(links);
      const a = links.rows.find(a => a.id === l.attempt_id && a.owner_id === ctx.project.user_id);
      if(!a&&l.link_identity&&l.sent_at){
        if(quotes.state!=="ready")return sourceFailure(quotes);
        const q=quotes.rows.find(q=>q.id===l.quote_id&&q.user_id===ctx.project.user_id);
        if(!q||!validQuote(ctx,q)||q.amount!==l.amount||!q.accepted_at||!atOrAfter(l.sent_at,q.accepted_at))return incompleteSource();
        target={kind:"payment_link",id:`current-link:${l.link_identity}`,revision:iso(legacyNoticeDeadline(l.sent_at))};purpose="payment_notice";
      }else{
      if (!a || !l.sent_at) return unsupported();
      if (!validLink(ctx, a) || a.quote_id !== l.quote_id || a.amount !== l.amount) return incompleteSource();
      // This legacy notice's terms only; state_error must not extend live expiry.
      target = linkTarget(a, legacyNoticeDeadline(l.sent_at));
      purpose = "payment_notice";
      }
    } else return unsupported();
    facts.push({
      ...sourceFact(ctx, `legacy-mail:${l.id}`, l.created_at, l, "legacy_projection"), target, purpose,
      notificationKey: `legacy-mail:${l.id}`, attemptNo: 1, operationId: null,
      // The old transport's failure/pending record cannot prove non-acceptance.
      status: l.sent_at ? (l.status === "state_error" ? "state_error" : "sent") : "unknown",
      sentAt: l.sent_at, resolvedByAttemptId: null,
    });
  }
  return readySource(ctx, ordered(facts));
}

function adaptOperations(
  ctx: CaseSourceContext, quotes: CaseSourceRows<QuoteRow>, links: CaseSourceRows<LinkRow>,
  notices: CaseSourceRows<NoticeRow>, quoteOps: CaseSourceRows<z.infer<typeof quoteOperationSchema>>,
  linkOps: CaseSourceRows<z.infer<typeof linkOperationSchema>>, stops: CaseSourceRows<z.infer<typeof stopSchema>>,
  deliveryOps: CaseSourceRows<DeliveryOperationRow>, consultationOps: CaseSourceRows<z.infer<typeof consultationOperationSchema>>,
): CaseSnapshot["operations"] {
  const unavailable = failure(quoteOps, linkOps, stops, deliveryOps, consultationOps);
  if (unavailable) return unavailable;
  if (quoteOps.state !== "ready" || linkOps.state !== "ready" || stops.state !== "ready"
    || deliveryOps.state !== "ready" || consultationOps.state !== "ready") return incompleteSource();
  const facts: CaseOperationFact[] = [];
  for (const o of quoteOps.rows) {
    if (quotes.state !== "ready") return sourceFailure(quotes);
    if (notices.state !== "ready") return sourceFailure(notices);
    const q = quotes.rows.find(q => q.id === o.quote_id && q.user_id === ctx.project.user_id);
    const j = notices.rows.find(j => j.id === o.notification_id);
    if (!q || !validQuote(ctx, q) || !j || j.quote_id !== q.id || j.snapshot.version !== q.version
      || j.purpose !== "quote_issue_client" || !sourceOccurred(ctx, o.created_at)) return incompleteSource();
    facts.push({ ...sourceFact(ctx, `quote:${o.id}`, o.created_at, o), target: quoteTarget(q), state: "succeeded" });
  }
  for (const o of linkOps.rows) {
    if (links.state !== "ready") return sourceFailure(links);
    const a = links.rows.find(a => a.id === o.attempt_id && a.owner_id === ctx.project.user_id);
    if (!a || !validLink(ctx, a) || !sourceOccurred(ctx, o.created_at)) return incompleteSource();
    const sendsNotice = o.action === "issue" || o.action === "reissue" || o.action === "renotify";
    let deadline = o.action === "renotify" ? null : o.proposed_deadline;
    if (o.status === "completed" && sendsNotice) {
      if (!o.notification_id) return incompleteSource();
      if (notices.state !== "ready") return sourceFailure(notices);
      const j = notices.rows.find(j => j.id === o.notification_id && j.purpose === "payment_link_client"
        && j.quote_id === a.quote_id && j.snapshot.attemptId === a.id && j.snapshot.generation === a.generation);
      if (!j || !sourceTime.safeParse(j.snapshot.deadline).success) return incompleteSource();
      if (deadline !== null && !sameTime(deadline, j.snapshot.deadline as string)) return incompleteSource();
      deadline = j.snapshot.deadline as string;
    } else if (o.notification_id !== null || (o.action === "adopt" && o.status !== "completed")) {
      return incompleteSource();
    }
    if (!deadline && o.expected_revision === a.deadline_revision) deadline = a.deadline;
    if (!deadline) return unsupported();
    if (o.reconciliation) {
      if (o.status !== "pending" || o.notification_id !== null || !sourceOccurred(ctx,o.reconciliation.at)) return incompleteSource();
      facts.push({...sourceFact(ctx, `reconciliation:${o.reconciliation.id}`,o.reconciliation.at,o),target:linkTarget(a,deadline),state:"succeeded"});
      continue;
    }
    facts.push({ ...sourceFact(ctx, `link:${o.id}`, o.created_at, o),
      target: linkTarget(a, deadline), state: o.status === "completed" ? "succeeded" : "pending" });
  }
  for (const s of stops.rows) {
    if (s.owner_id !== ctx.project.user_id || !sourceOccurred(ctx, s.created_at)
      || !sourceOccurred(ctx, s.updated_at) || !atOrAfter(s.updated_at, s.created_at)) return incompleteSource();
    if (links.state !== "ready") return sourceFailure(links);
    const a = links.rows.find(a => a.id === s.attempt_id);
    // A completed stop is no outstanding effect. Legacy stops need no invented target.
    if (s.status === "completed") continue;
    if (!a || s.deadline_revision !== a.deadline_revision) return unsupported();
    if (!validLink(ctx, a)) return incompleteSource();
    facts.push({ ...sourceFact(ctx, `stop:${s.id}`, s.created_at, s), target: linkTarget(a),
      state: s.status === "needs_review" ? "unknown" : s.status });
  }
  for (const o of deliveryOps.rows) {
    if (!sourceOccurred(ctx, o.created_at) || !o.original_expires_at || !o.notification_key) return incompleteSource();
    if (notices.state !== "ready") return sourceFailure(notices);
    const j = notices.rows.find(j => j.id === o.notification_id && j.purpose === "delivery_issue_client"
      && j.release_id === o.release_id);
    if (!j) return incompleteSource();
    const deadline = deliveryNoticeDeadline(j, deliveryOps.rows);
    if (!deadline) return incompleteSource();
    facts.push({ ...sourceFact(ctx, `delivery:${o.id}`, o.created_at, o),
      target: { kind: "delivery", id: o.release_id, revision: deadline }, state: "succeeded" });
  }
  for (const o of consultationOps.rows) {
    if (!sourceOccurred(ctx, o.created_at)) return incompleteSource();
    if (o.status === "cleaned") continue;
    // Reserved/cancelled/cleanup rows can still hold uploads/credentials. No
    // message target exists yet; do not fabricate one or silently ignore them.
    if (o.status !== "committed") return unsupported();
    if (!o.message_id || !o.message_created_at || !sourceOccurred(ctx, o.message_created_at)
      || !o.notification_id) return incompleteSource();
    if (notices.state !== "ready") return sourceFailure(notices);
    const j = notices.rows.find(j => j.id === o.notification_id && j.message_id === o.message_id
      && j.message_operation_id === o.operation_id && j.message_sender === o.sender
      && j.snapshot.operationId === o.operation_id
      && j.purpose === (o.sender === "staff" ? "consultation_client" : "consultation_staff"));
    if (!j) return incompleteSource();
    facts.push({ ...sourceFact(ctx, `consultation:${o.id}`, o.created_at, o),
      target: { kind: "consultation", id: o.message_id, revision: iso(o.message_created_at) }, state: "succeeded" });
  }
  // Refusal tombstones have no target/effect and are not outstanding operations.
  return readySource(ctx, ordered(facts));
}

/** Pure adaptation only: no DB, provider, Storage, clock, decryption or writes. */
export function adaptCaseFinancial(ctx: CaseSourceContext):
  Pick<CaseSnapshot, "quote" | "link" | "payment" | "financialReview" | "notifications" | "operations"> {
  const quotes = sourceRows(ctx, "financial_quotes", quoteSchema);
  const drafts = sourceRows(ctx, "financial_drafts", draftSchema);
  const links = sourceRows(ctx, "financial_links", linkSchema);
  const payments = sourceRows(ctx, "financial_payments", paymentSchema);
  const inbox = sourceRows(ctx, "financial_inbox", inboxSchema);
  const refunds = sourceRows(ctx, "financial_refunds", refundSchema);
  const notices = sourceRows(ctx, "financial_notifications", noticeSchema);
  const legacy = sourceRows(ctx, "financial_legacy_notices", legacySchema);
  const quoteOps = sourceRows(ctx, "financial_quote_operations", quoteOperationSchema);
  const linkOps = sourceRows(ctx, "financial_link_operations", linkOperationSchema);
  const stops = sourceRows(ctx, "financial_link_stops", stopSchema);
  const deliveryOps = sourceRows(ctx, "financial_delivery_operations", deliveryOperationSchema);
  const consultationOps = sourceRows(ctx, "financial_consultation_operations", consultationOperationSchema);
  return {
    quote: adaptQuote(ctx, quotes, drafts),
    link: adaptLink(ctx, links, quotes,legacy),
    payment: adaptPayment(ctx, payments),
    financialReview: adaptFinancialReview(ctx, payments, inbox, refunds),
    notifications: adaptNotifications(ctx, notices, legacy, quotes, links, deliveryOps),
    operations: adaptOperations(ctx, quotes, links, notices, quoteOps, linkOps, stops, deliveryOps, consultationOps),
  };
}
