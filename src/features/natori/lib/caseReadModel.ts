import type {
  CaseAction, CaseActionId, CaseAttention, CaseBlockReason, CaseDomain, CaseFact,
  CaseMoney, CaseObservation, CaseReadModel, CaseSnapshot, CaseTarget,
} from "../types/caseReadModel";
import { isCaseNotificationTarget, summarizeCaseNotifications } from "./caseNotificationFacts";
import { isPaymentTimestamp } from "./clientPayment";

export const CASE_DOMAINS = [
  "project", "quote", "link", "payment", "financialReview", "notifications",
  "operations", "production", "roughs", "delivery", "receipt", "consultation",
] as const satisfies readonly CaseDomain[];

function known<T>(observation: CaseObservation<T>): T | undefined {
  return observation.state === "ready" ? observation.value
    : observation.state === "unavailable" ? observation.lastKnown?.value : undefined;
}

function current(observation: CaseObservation<unknown>): observation is Extract<CaseObservation<unknown>, { state: "ready" | "absent" }> {
  return observation.state === "ready" || observation.state === "absent";
}

function validTime(value: string): boolean {
  return isPaymentTimestamp(value);
}

function moneyValid(value: CaseMoney): boolean {
  return Number.isSafeInteger(value.amount) && value.amount >= 0 && /^[A-Z]{3}$/.test(value.currency);
}

function sameMoney(a: CaseMoney, b: CaseMoney): boolean {
  return moneyValid(a) && moneyValid(b) && a.amount === b.amount && a.currency === b.currency;
}

/** Stable set ordering also makes equal-priority attention independent of fetch order. */
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort(compare).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => compare(a, b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * No I/O, clock, repair, authorization, mutation or persistence. This model must
 * not be used as a public DTO or as permission for a command. It deliberately
 * leaves future DB snapshot acquisition and external evidence outside the API.
 */
export function deriveCaseReadModel(input: CaseSnapshot): CaseReadModel {
  const issues: CaseReadModel["issues"][number][] = [];
  const facts: Pick<CaseSnapshot, CaseDomain | "externalEvidence"> = {
    project: input.project, quote: input.quote, link: input.link, payment: input.payment,
    financialReview: input.financialReview, notifications: input.notifications, operations: input.operations,
    production: input.production, roughs: input.roughs, delivery: input.delivery, receipt: input.receipt,
    consultation: input.consultation, externalEvidence: input.externalEvidence,
  };
  const issue = (domain: CaseDomain, code: string, targetId = input.projectId) =>
    issues.push({ domain, code, targetId });
  const clockValid = validTime(input.asOf);
  const recorded = (value: string) => clockValid && validTime(value) && Date.parse(value) <= Date.parse(input.asOf);
  if (!clockValid) issue("project", "invalid_as_of");

  // A wrong association is not a fact of this case. A mixed/stale read remains
  // visible as last-known evidence, but cannot authorize preparation actions.
  for (const domain of CASE_DOMAINS) {
    const observation = input[domain] as CaseObservation<CaseFact | readonly CaseFact[]>;
    const value = known(observation);
    const records = value === undefined ? [] : Array.isArray(value) ? value : [value as CaseFact];
    const observedAt = observation.state === "ready" ? observation.observedAt
      : observation.state === "unavailable" ? observation.lastKnown?.observedAt : undefined;
    const badIdentity = records.some(item => item.projectId !== input.projectId || !item.id || !item.revision
      || !recorded(item.recordedAt) || !observedAt || !validTime(observedAt)
      || Date.parse(item.recordedAt) > Date.parse(observedAt));
    const duplicate = new Set(records.map(item => item.id)).size !== records.length;
    if (badIdentity || duplicate || (domain === "project" && records.some(item => item.id !== input.projectId))) {
      issue(domain, badIdentity ? "invalid_fact_identity" : "duplicate_fact_identity");
      Object.assign(facts, { [domain]: { state: "unavailable", reason: "incomplete" } });
    } else if (current(observation) && (
      observation.snapshotId !== input.snapshotId || !input.snapshotId
      || !observation.revision || !validTime(observation.observedAt)
      || !clockValid || Date.parse(observation.observedAt) > Date.parse(input.asOf)
    )) {
      issue(domain, "inconsistent_snapshot");
      Object.assign(facts, { [domain]: {
        state: "unavailable", reason: "incomplete",
        ...(observation.state === "ready" ? { lastKnown: {
          value: observation.value, revision: observation.revision, observedAt: observation.observedAt,
        } } : {}),
      } });
    }
  }

  const project = known(facts.project);
  const quote = known(facts.quote);
  const link = known(facts.link);
  const payment = known(facts.payment);
  const delivery = known(facts.delivery);
  const receipt = known(facts.receipt);
  const production = known(facts.production);
  const financial = known(facts.financialReview) ?? [];
  const operations = known(facts.operations) ?? [];
  const roughs = known(facts.roughs) ?? [];
  const consultation = known(facts.consultation);
  const occurred = (domain: CaseDomain, value: string) => {
    const observation = facts[domain];
    const checkedAt = observation.state === "ready" ? observation.observedAt
      : observation.state === "unavailable" ? observation.lastKnown?.observedAt : undefined;
    return recorded(value) && checkedAt !== undefined && validTime(checkedAt)
      && Date.parse(value) <= Date.parse(checkedAt);
  };
  const quoteSourceValid = quote?.source === "ledger" || quote?.source === "legacy_projection";
  const deliverySourceValid = delivery?.source === "ledger" || (delivery?.kind === "legacy" && delivery.source === "legacy_projection");

  const eligibility: CaseReadModel["eligibility"] =
    !project ? "unknown" : project.archivedAt ? "archived"
      : project.rawStatus === "closed" ? "closed" : project.origin === "historical" ? "historical"
        : project.rawStatus === "completed" ? "completed" : "active";
  let agreement: CaseReadModel["agreement"] = !quote
    ? facts.quote.state === "absent" && project?.origin === "internal" ? "absent" : "unknown"
    : quote.acceptance ? "accepted" : "unaccepted";
  if (quote && (!moneyValid(quote.money) || !Number.isSafeInteger(quote.version) || quote.version < 1
    || (quote.validUntil !== null && !validTime(quote.validUntil)))) {
    issue("quote", "invalid_quote", quote.id);
    agreement = "needs_review";
  }
  if (quote && !quoteSourceValid) {
    issue("quote", "quote_source_requires_review", quote.id);
    agreement = "needs_review";
  }
  if (quote?.acceptance && (
    quote.state !== "issued" || quote.acceptance.quoteId !== quote.id
    || quote.acceptance.version !== quote.version || !occurred("quote", quote.acceptance.acceptedAt)
    || !sameMoney(quote.money, quote.acceptance.money)
  )) {
    issue("quote", "acceptance_target_mismatch", quote.id);
    agreement = "needs_review";
  }
  if (quote?.state === "superseded") {
    issue("quote", "current_quote_superseded", quote.id);
    agreement = "needs_review";
  }
  if (quote?.acceptance && project?.administrativeAmount
    && !sameMoney(quote.acceptance.money, project.administrativeAmount)) {
    issue("project", "administrative_agreement_amount_mismatch");
  }
  if (project?.administrativeAmount && !moneyValid(project.administrativeAmount)) {
    issue("project", "invalid_administrative_amount");
  }
  if (payment && (!occurred("payment", payment.confirmedAt) || (payment.money !== null && !moneyValid(payment.money)))) {
    issue("payment", "invalid_payment", payment.id);
  }
  if (payment && payment.money === null) issue("payment", "payment_amount_unconfirmed", payment.id);
  if (payment && (payment.source === "historical_registration" || payment.method === "historical")
    && project?.origin !== "historical") {
    issue("payment", "historical_payment_origin_mismatch", payment.id);
  }
  if (payment?.money && quote?.acceptance && !sameMoney(payment.money, quote.acceptance.money)) {
    issue("payment", "payment_agreement_amount_mismatch", payment.id);
  }
  if (payment?.money && project?.administrativeAmount && !sameMoney(payment.money, project.administrativeAmount)) {
    issue("payment", "payment_administrative_amount_mismatch", payment.id);
  }

  let linkValidity: CaseReadModel["linkValidity"] = link ? "needs_review"
    : facts.link.state === "absent" ? "absent" : "unknown";
  if (link) {
    const sameQuote = !!quote && agreement === "accepted" && link.quoteId === quote.id
      && link.quoteVersion === quote.version && !!link.money && sameMoney(link.money, quote.money);
    const currentTerms=link.source==="legacy_projection"&&link.termsPolicy==="sent_plus_7_days"&&link.generation===null&&!!link.deadlineRevision;
    const identified = currentTerms||(link.source === "ledger" && Number.isSafeInteger(link.generation)
      && (link.generation ?? 0) > 0 && !!link.deadlineRevision);
    const deadlineKnown = link.expiresAt !== null && validTime(link.expiresAt);
    if (![facts.project, facts.quote, facts.link, facts.payment].every(observation => current(observation))) {
      linkValidity = "unknown";
    } else if (!sameQuote || !identified || !deadlineKnown) {
      issue("link", "link_evidence_requires_review", link.id);
    } else if (link.state === "stopped" && link.providerState === "inactive") {
      linkValidity = "inactive";
    } else if (clockValid && Date.parse(link.expiresAt!) <= Date.parse(input.asOf)) {
      linkValidity = "expired"; // Expiry is NOT proof that the provider stopped.
    } else if(currentTerms&&link.state==="active"&&eligibility==="active"&&!payment){
      linkValidity="recorded"; // No claim that Stripe is currently active.
    } else if (link.state === "active" && link.providerState === "active" && eligibility === "active" && !payment) {
      linkValidity = "active";
    }
  }
  if (delivery && (!delivery.expiryRevision || (delivery.expiresAt !== null && !validTime(delivery.expiresAt)))) {
    issue("delivery", "invalid_delivery_expiry", delivery.id);
  }
  if (delivery && !deliverySourceValid) issue("delivery", "delivery_source_requires_review", delivery.id);
  if (receipt && (!occurred("receipt", receipt.acceptedAt) || !receipt.deliveryId)) {
    issue("receipt", "invalid_receipt", receipt.id);
  }
  if (receipt && (receipt.source === "historical_registration" || receipt.source === "manual_record")) {
    issue("receipt", "receipt_source_requires_review", receipt.id);
  }
  if (receipt && delivery && receipt.deliveryId !== delivery.id) {
    issue("receipt", "receipt_delivery_mismatch", receipt.id);
  }
  if (production && new Set(production.tasks.map(task => task.id)).size !== production.tasks.length) {
    issue("production", "duplicate_task_identity", production.id);
  }
  if (production && (production.source === "legacy_projection" || production.source === "historical_registration")) {
    issue("production", "production_source_requires_review", production.id);
  }
  for (const op of operations) {
    if (!isCaseNotificationTarget(op.target)) issue("operations", "invalid_operation_target", op.id);
  }
  for (const rough of roughs) {
    if ((rough.clientOkAt !== null && !occurred("roughs", rough.clientOkAt))
      || (rough.acknowledgedAt !== null && (!rough.clientOkAt || !occurred("roughs", rough.acknowledgedAt)
        || Date.parse(rough.acknowledgedAt) < Date.parse(rough.clientOkAt)))) {
      issue("roughs", "invalid_rough_acknowledgement", rough.id);
    }
  }

  const targets: CaseTarget[] = [];
  if (quote) targets.push({ kind: "quote", id: quote.id, revision: String(quote.version) });
  if (link) targets.push({ kind: "payment_link", id: link.id, revision: link.deadlineRevision });
  if (delivery) targets.push({ kind: "delivery", id: delivery.id, revision: delivery.expiryRevision });
  for (const rough of roughs) targets.push({ kind: "rough", id: rough.id, revision: rough.revision });
  if (consultation) targets.push({ kind: "consultation", id: consultation.id, revision: consultation.revision });
  const attempts = known(facts.notifications) ?? [];
  // Include superseded targets as their own series: old unresolved effects still
  // require review and must not disappear when the current target changes.
  for (const attempt of attempts) {
    if (!isCaseNotificationTarget(attempt.target)) {
      issue("notifications", "invalid_notification_target", attempt.id);
      continue;
    }
    if (!targets.some(t => t.kind === attempt.target.kind && t.id === attempt.target.id)) targets.push(attempt.target);
  }
  const timelyAttempts = attempts.filter(attempt => {
    if (attempt.sentAt !== null && !occurred("notifications", attempt.sentAt)) {
      issue("notifications", "invalid_notification_sent_at", attempt.id);
      return false;
    }
    return true;
  });
  const notifications = summarizeCaseNotifications(timelyAttempts, targets, input.projectId);
  // A usable link proves availability, not that its current terms were shared.
  // Preserve validated legacy send records too; staff/manual notes, an older
  // generation/deadline or stale last-known notices cannot establish this wait.
  const paymentNoticeConfirmed = facts.notifications.state === "ready" && !!link && notifications.some(summary =>
    summary.target.kind === "payment_link" && summary.target.id === link.id
    && summary.target.revision === link.deadlineRevision && summary.currentSuccessIds.length > 0);
  const deliveryNoticeConfirmed=facts.delivery.state==="ready"&&facts.notifications.state==="ready"&&!!delivery&&notifications.some(summary=>
    summary.target.kind==="delivery"&&summary.target.id===delivery.id&&summary.target.revision===delivery.expiryRevision&&summary.currentSuccessIds.length>0);
  for (const summary of notifications) {
    for (const id of summary.invalidEvidenceIds) issue("notifications", "invalid_notification_evidence", id);
  }

  const attention: CaseAttention[] = [];
  const add = (
    domain: CaseAttention["domain"], targetId: string, reason: string,
    waitingOn: CaseAttention["waitingOn"], priority: CaseAttention["priority"], action: CaseActionId,
  ) => attention.push({ key: `${domain}:${targetId}:${reason}`, domain, targetId, reason, waitingOn, priority, action });

  for (const domain of CASE_DOMAINS) {
    if (!current(facts[domain])) add(domain, input.projectId, facts[domain].state, "staff", 0, "refresh_facts");
  }
  for (const item of issues) add(item.domain, item.targetId, item.code, "staff", 0, "review_evidence");
  if (project && ["external", "legacy"].includes(project.origin)) {
    add("externalEvidence", input.projectId, project.origin === "external" ? "external_evidence_unsupported" : "legacy_evidence_required",
      "staff", 1, "review_evidence");
  }
  for (const op of operations.filter(item => item.state !== "succeeded")) {
    add("operations", op.id, `operation_${op.state}`, op.state === "pending" || op.state === "processing" ? "system" : "staff",
      0, "check_operation");
  }
  for (const item of financial) {
    add("financialReview", item.id, item.kind,
      item.kind === "payment_processing" || item.kind === "refund_pending" ? "system" : "staff", 0, "review_evidence");
  }
  // Old-path links are never checked with Stripe, so after payment this would show on
  // every case and could not be cleared; the payment section shows a note instead.
  const legacyPaidLink = !!payment && link?.source === "legacy_projection" && link.providerState === "unverified";
  if (link && !legacyPaidLink && (["preparing", "stopping", "failed", "unknown"].includes(link.state)
    || (payment && link.providerState !== "inactive"))) {
    add("link", link.id, payment ? "paid_link_stop_unconfirmed" : `link_operation_${link.state}`,
      link.state === "preparing" || link.state === "stopping" ? "system" : "staff", 0, "review_evidence");
  }
  for (const summary of notifications) {
    for (const id of summary.unresolvedIds) {
      const attempt = attempts.find(item => item.id === id);
      add("notifications", id, `notification_${attempt?.status ?? "unknown"}`,
        attempt?.status === "pending" || attempt?.status === "sending" ? "system" : "staff", 0, "review_notification");
    }
    for (const id of summary.failedIds) add("notifications", id, "notification_failed", "staff", 0, "review_notification");
    for (const id of summary.projectionReviewIds) add("notifications", id, "notification_projection_review", "staff", 0, "review_notification");
  }

  const inactive: CaseBlockReason[] = eligibility === "active" && current(facts.project) ? []
    : eligibility === "historical" ? ["historical_record"] : eligibility === "unknown" || !current(facts.project)
      ? ["facts_not_current"] : ["inactive_case"];
  const origin: CaseBlockReason[] = project?.origin === "external" ? ["external_evidence_unsupported"]
    : project?.origin === "legacy" || project?.origin === "unknown" ? ["legacy_evidence_required"] : [];
  const unresolvedOps = operations.some(op => op.state !== "succeeded");
  const unresolvedNotices = notifications.some(n => n.unresolvedIds.length || n.failedIds.length
    || n.projectionReviewIds.length || n.invalidEvidenceIds.length);
  const prerequisites = (domains: readonly CaseDomain[]): CaseBlockReason[] => [
    ...(!clockValid || domains.some(domain => !current(facts[domain])) ? ["facts_not_current" as const] : []),
    ...(issues.some(item => domains.includes(item.domain)) ? ["inconsistent_facts" as const] : []),
  ];
  const businessBase = (domains: readonly CaseDomain[]): CaseBlockReason[] => [
    ...inactive, ...origin, ...prerequisites(["project", ...domains]),
  ];
  const effects: CaseBlockReason[] = [
    ...(unresolvedOps ? ["unresolved_operation" as const] : []),
    ...(financial.length ? ["financial_review" as const] : []),
  ];
  const catalog = new Map<CaseActionId, CaseAction>();
  const action = (id: CaseActionId, blockedBy: CaseBlockReason[] = [], write = false) => {
    const reasons = [...new Set(blockedBy)];
    catalog.set(id, { id, available: reasons.length === 0, blockedBy: reasons,
      execution: write ? "requires_command_revalidation" : "read_only" });
  };
  action("view_case");
  action("view_consultation");
  action("refresh_facts");
  action("review_evidence");
  action("check_operation");
  action("review_notification");
  action("view_payment");
  action("view_delivery");
  action("review_rough");
  action("prepare_quote", [
    ...businessBase(["quote", "payment", "link", "delivery", "receipt", "operations", "financialReview", "notifications"]), ...effects,
    ...(quote && quote.state !== "draft" ? ["agreement_required" as const] : []),
    ...(payment ? ["payment_recorded" as const] : []),
    ...(link ? ["link_already_exists" as const] : []),
    ...(delivery ? ["delivery_already_exists" as const] : []),
    ...(receipt ? ["receipt_recorded" as const] : []),
    ...(unresolvedNotices ? ["notification_attention" as const] : []),
  ], true);
  action("prepare_payment_notice", [
    ...businessBase(["quote", "link", "payment", "financialReview", "notifications", "operations", "delivery", "receipt"]), ...effects,
    ...(!quote ? ["quote_required" as const] : []),
    ...(agreement !== "accepted" ? ["agreement_required" as const] : []),
    ...(payment ? ["payment_recorded" as const] : []),
    ...(link ? ["link_already_exists" as const] : []),
    ...(delivery ? ["delivery_already_exists" as const] : []),
    ...(receipt ? ["receipt_recorded" as const] : []),
    ...(unresolvedNotices || notifications.some(n => n.target.kind === "payment_link" && n.pastSuccessIds.length)
      ? ["notification_attention" as const] : []),
    ...(project?.type === "undecided" ? ["type_required" as const] : []),
  ], true);
  // Opening production is safe navigation; it grants no task mutation or release.
  action("open_production", [
    ...inactive, ...prerequisites(["project", "payment"]), ...(!payment ? ["payment_required" as const] : []),
  ]);
  action("prepare_delivery", [
    ...businessBase(["payment", "production", "delivery", "receipt", "operations", "financialReview", "notifications"]), ...effects,
    ...(!payment ? ["payment_required" as const] : []),
    ...(!production ? ["production_required" as const] : []),
    ...(production?.stage !== "delivery" || project?.rawStatus !== "delivery_prep" ? ["delivery_stage_required" as const] : []),
    ...(production?.files !== "ready" ? ["files_not_verified" as const] : []),
    ...(delivery ? ["delivery_already_exists" as const] : []),
    ...(receipt ? ["receipt_recorded" as const] : []),
    ...(unresolvedNotices ? ["notification_attention" as const] : []),
    ...(project?.type === "undecided" ? ["type_required" as const] : []),
  ], true);
  action("extend_delivery", [
    ...businessBase(["payment", "delivery", "receipt", "operations", "financialReview", "notifications"]), ...effects,
    ...(!payment ? ["payment_required" as const] : []),
    ...(!delivery ? ["delivery_required" as const] : []),
    ...(delivery?.kind !== "release" || delivery.manifest !== "verified" ? ["legacy_evidence_required" as const] : []),
    ...(project?.rawStatus !== "delivered" ? ["delivery_stage_required" as const] : []),
    ...(receipt ? ["receipt_recorded" as const] : []),
    ...(unresolvedNotices ? ["notification_attention" as const] : []),
  ], true);

  const offered = (id: CaseActionId) => catalog.get(id)?.available === true;
  if (consultation?.responseRequired) add("consultation", consultation.id, "response_required", "staff", 2, "view_consultation");
  for (const rough of roughs) {
    if(rough.revisionPending)add("roughs",rough.id,"rough_revision_pending","staff",2,"review_rough");
    if (rough.clientOkAt && !rough.acknowledgedAt) add("roughs", rough.id, "rough_ok_unacknowledged", "staff", 2, "review_rough");
    else if (!rough.clientOkAt && !rough.supersededBy && !rough.revisionPending && eligibility === "active") add("roughs", rough.id, "rough_response_pending", "client", 4, "review_rough");
  }
  if (eligibility === "active") {
    if (offered("prepare_quote")) add("quote", quote?.id ?? input.projectId, quote ? "quote_draft" : "quote_needed", "staff", 1, "prepare_quote");
    if (offered("prepare_payment_notice")) add("payment", input.projectId, "payment_notice_needed", "staff", 1, "prepare_payment_notice");
    if (quote?.state === "issued" && !quote.acceptance && !payment) {
      const expired = quote.validUntil !== null && validTime(quote.validUntil) && Date.parse(quote.validUntil) <= Date.parse(input.asOf);
      add("quote", quote.id, expired ? "quote_expired" : "quote_acceptance_pending", expired ? "staff" : "client",
        expired ? 1 : 4, expired ? "review_evidence" : "view_case");
    }
    if (link && !payment) {
      if (linkValidity === "active"||linkValidity==="recorded") add("link", link.id, paymentNoticeConfirmed ? "payment_pending" : "payment_notice_unconfirmed",
        paymentNoticeConfirmed ? "client" : "staff", paymentNoticeConfirmed ? 4 : 1, "view_payment");
      else add("link", link.id, `link_${linkValidity}`, "staff", 0, "review_evidence");
    }
    if (payment && !delivery && !receipt && offered("open_production")) {
      add("production", production?.id ?? input.projectId, "production_attention", "staff", 3,
        offered("prepare_delivery") ? "prepare_delivery" : "open_production");
    }
    if (delivery && !receipt) {
      const expired = delivery.expiresAt !== null && validTime(delivery.expiresAt) && Date.parse(delivery.expiresAt) <= Date.parse(input.asOf);
      const unconfirmed=delivery.noticeRequired&&!deliveryNoticeConfirmed;
      add("delivery", delivery.id, expired ? "delivery_access_expired" : unconfirmed?"delivery_notice_unconfirmed":"receipt_pending", expired||unconfirmed ? "staff" : "client",
        expired||unconfirmed ? 1 : 4, expired && offered("extend_delivery") ? "extend_delivery" : "view_delivery");
    }
    // A saved target without current success is not an unsent new operation.
    for (const target of targets.filter(t => t.kind === "quote" || t.kind === "payment_link" || t.kind === "delivery")) {
      const summary = notifications.find(n => n.target.kind === target.kind && n.target.id === target.id);
      const relevant = (target.kind === "quote" && quote?.id === target.id && quote.state === "issued" && !quote.acceptance && !payment)
        || (target.kind === "payment_link" && link?.id === target.id && !payment)
        || (target.kind === "delivery" && delivery?.id === target.id && !receipt);
      if (relevant && summary && !summary.currentSuccessIds.length && current(facts.notifications)
        && !(target.kind === "payment_link" && linkValidity === "active")
        && !(target.kind==="delivery"&&delivery?.noticeRequired&&!deliveryNoticeConfirmed)) {
        add("notifications", target.id, "current_notice_unconfirmed", "staff", 1, "review_notification");
      }
    }
  }

  // Raw progress status/task completion never creates payment, delivery or receipt.
  // Known immutable facts survive notification failure and unavailable re-reads.
  const receiptValid = receipt && occurred("receipt", receipt.acceptedAt) && !!receipt.deliveryId
    && receipt.source !== "historical_registration" && receipt.source !== "manual_record";
  const paymentValid = payment && occurred("payment", payment.confirmedAt) && (payment.money === null || moneyValid(payment.money))
    && payment.source !== "historical_registration" && payment.method !== "historical";
  const stage: CaseReadModel["stage"] = project?.origin === "historical" ? "historical_record"
    : receiptValid ? "received" : delivery && deliverySourceValid ? "delivery_issued" : paymentValid ? "paid"
      : linkValidity === "active" ? "payment_available" : linkValidity==="recorded"&&paymentNoticeConfirmed?"payment_notified":agreement === "accepted" ? "quote_accepted"
        : quoteSourceValid && quote?.state === "issued" ? "quote_issued" : quoteSourceValid && quote?.state === "draft" ? "quote_draft"
          : project?.rawStatus === "completed" ? "existing_completion"
            : project && facts.quote.state === "absent" && project.origin === "internal" ? "consultation" : "unknown";
  const sorted = attention.sort((a, b) => a.priority - b.priority || compare(a.key, b.key));
  const unique = sorted.filter((item, index) => index === 0 || !sorted.slice(0, index).some(prior => prior.key === item.key));
  const primary = unique.find(item => offered(item.action))?.action ?? "view_case";
  return {
    projectId: input.projectId, snapshotId: input.snapshotId, checkedAt: input.asOf,
    fingerprint: `case-v1:${canonical({ projectId: input.projectId, snapshotId: input.snapshotId,
      asOf: input.asOf, facts })}`,
    eligibility, stage, agreement, linkValidity, facts, notifications,
    attention: unique, primary, actions: [...catalog.values()], issues,
  };
}
