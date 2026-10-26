import type {
  CaseNotificationAttempt,
  CaseNotificationSummary,
  CaseTarget,
} from "../types/caseReadModel";
import { isPaymentTimestamp } from "./clientPayment";

const noticePurpose: Record<CaseTarget["kind"], CaseNotificationAttempt["purpose"]> = {
  quote: "quote_notice",
  payment_link: "payment_notice",
  delivery: "delivery_notice",
  rough: "rough_notice",
  consultation: "consultation_notice",
};
const statuses = new Set(["pending", "sending", "sent", "failed", "unknown", "state_error"]);
// External/manual records cannot prove acceptance by the internal mail service.
const sources = new Set(["ledger", "legacy_projection"]);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const sameObject = (a: CaseTarget, b: CaseTarget) => a.kind === b.kind && a.id === b.id;
const sameTarget = (a: CaseTarget, b: CaseTarget) => sameObject(a, b) && a.revision === b.revision;
const targetKey = (target: CaseTarget) => JSON.stringify([target.kind, target.id, target.revision]);
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const ids = (values: Iterable<string>) => [...new Set(values)].sort(compareText);
const succeeded = (attempt: CaseNotificationAttempt) =>
  attempt.status === "sent" || attempt.status === "state_error";
const open = (attempt: CaseNotificationAttempt) =>
  attempt.status === "pending" || attempt.status === "sending" || attempt.status === "unknown";

export function isCaseNotificationTarget(value: unknown): value is CaseTarget {
  return record(value) && text(value.kind) && Object.hasOwn(noticePurpose, value.kind)
    && text(value.id) && text(value.revision);
}

function validAttempt(value: unknown, projectId: string): boolean {
  if (!record(value) || !text(value.id) || value.projectId !== projectId || !text(value.revision)
    || !isPaymentTimestamp(value.recordedAt) || !text(value.source) || !sources.has(value.source)
    || !isCaseNotificationTarget(value.target) || !text(value.notificationKey)
    || !Number.isSafeInteger(value.attemptNo) || (value.attemptNo as number) < 1
    || !(value.operationId === null || text(value.operationId))
    || !text(value.status) || !statuses.has(value.status)
    || !(value.resolvedByAttemptId === null || text(value.resolvedByAttemptId))) return false;
  const purposeAllowed = value.purpose === noticePurpose[value.target.kind]
    || value.purpose === "staff_notice"
    || (value.target.kind === "delivery" && value.purpose === "receipt_notice");
  if (!purposeAllowed) return false;
  return value.status === "sent" || value.status === "state_error"
    ? isPaymentTimestamp(value.sentAt)
    : value.sentAt === null;
}

/** A fixed property order makes identical join duplicates independent of object key order. */
function identity(attempt: CaseNotificationAttempt): string {
  return JSON.stringify([
    attempt.id, attempt.projectId, attempt.revision, attempt.recordedAt, attempt.source,
    targetKey(attempt.target), attempt.purpose, attempt.notificationKey, attempt.attemptNo,
    attempt.operationId, attempt.status, attempt.sentAt, attempt.resolvedByAttemptId,
  ]);
}

/**
 * Display evidence only. The caller supplies complete, consistently observed
 * input; this function performs no reads, retries, clock access or authorization.
 * A requested revision selects current successes, never discarding older unknowns.
 */
export function summarizeCaseNotifications(
  attempts: readonly CaseNotificationAttempt[],
  targets: readonly CaseTarget[],
  projectId: string,
): CaseNotificationSummary[] {
  const selected = [...new Map(targets.filter(isCaseNotificationTarget).map(target => [
    targetKey(target), { ...target },
  ])).values()].sort((a, b) => compareText(targetKey(a), targetKey(b)));
  const invalid = new Map<string, CaseTarget[]>();
  const unscopedInvalid = new Set<string>();
  const markInvalid = (value: unknown) => {
    const id = record(value) && text(value.id) ? value.id : "<missing-notification-id>";
    const target = record(value) && isCaseNotificationTarget(value.target) ? value.target : null;
    if (!target || !selected.some(item => sameObject(item, target))) unscopedInvalid.add(id);
    else invalid.set(id, [...(invalid.get(id) ?? []), target]);
  };

  const candidates = new Map<string, CaseNotificationAttempt>();
  const conflictingIds = new Set<string>();
  for (const attempt of attempts) {
    if (!validAttempt(attempt, projectId)) {
      markInvalid(attempt);
      if (record(attempt) && text(attempt.id)) conflictingIds.add(attempt.id);
      continue;
    }
    const prior = candidates.get(attempt.id);
    if (prior && identity(prior) !== identity(attempt)) {
      markInvalid(prior);
      markInvalid(attempt);
      conflictingIds.add(attempt.id);
    } else candidates.set(attempt.id, attempt);
  }
  for (const id of conflictingIds) {
    const attempt = candidates.get(id);
    if (attempt) markInvalid(attempt);
    candidates.delete(id);
  }

  const series = new Map<string, CaseNotificationAttempt[]>();
  for (const attempt of candidates.values()) {
    const list = series.get(attempt.notificationKey) ?? [];
    list.push(attempt);
    series.set(attempt.notificationKey, list);
  }
  // A logical notification freezes its target/purpose, and each attempt number
  // is unique. Conflicting evidence cannot establish a successful notice.
  for (const list of series.values()) {
    const first = list[0];
    if (list.some(item => !sameTarget(item.target, first.target) || item.purpose !== first.purpose)
      || new Set(list.map(item => item.attemptNo)).size !== list.length) {
      for (const attempt of list) {
        markInvalid(attempt);
        candidates.delete(attempt.id);
      }
    }
  }

  const resolved = new Set<string>();
  for (const attempt of candidates.values()) {
    if (attempt.resolvedByAttemptId === null) continue;
    const successor = candidates.get(attempt.resolvedByAttemptId);
    if (successor && !succeeded(attempt) && successor.notificationKey === attempt.notificationKey
      && successor.purpose === attempt.purpose && sameTarget(successor.target, attempt.target)
      && successor.attemptNo > attempt.attemptNo
      && (succeeded(successor) || successor.status === "failed")) {
      resolved.add(attempt.id);
    } else markInvalid(attempt);
  }

  const valid = [...candidates.values()];
  // Keep an earlier pending/unknown unless an explicit, valid resolution points
  // at a terminal successor. A different notice's later success proves nothing.
  for (const list of series.values()) {
    const unresolved = list.filter(item => candidates.has(item.id) && open(item) && !resolved.has(item.id));
    if (unresolved.length > 1) unresolved.forEach(markInvalid);
  }

  return selected.map(target => {
    const related = valid.filter(attempt => sameObject(attempt.target, target));
    const primaryNotices = related.filter(attempt => attempt.purpose === noticePurpose[target.kind]);
    const current = primaryNotices.filter(attempt => sameTarget(attempt.target, target));
    const heads = new Map<string, CaseNotificationAttempt>();
    for (const attempt of related) {
      const prior = heads.get(attempt.notificationKey);
      if (!prior || attempt.attemptNo > prior.attemptNo) heads.set(attempt.notificationKey, attempt);
    }
    const currentHeads = current.filter(attempt => heads.get(attempt.notificationKey)?.id === attempt.id);
    currentHeads.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)
      || compareText(a.notificationKey, b.notificationKey) || compareText(a.id, b.id));
    return {
      target,
      pastSuccessIds: ids(primaryNotices.filter(succeeded).map(attempt => attempt.id)),
      currentSuccessIds: ids(current.filter(succeeded).map(attempt => attempt.id)),
      latestAttemptId: currentHeads[0]?.id ?? null,
      unresolvedIds: ids(related.filter(attempt => open(attempt) && !resolved.has(attempt.id)).map(attempt => attempt.id)),
      failedIds: ids([...heads.values()].filter(attempt => attempt.status === "failed" && !resolved.has(attempt.id)).map(attempt => attempt.id)),
      // A later email does not prove that an earlier projection was repaired.
      projectionReviewIds: ids(related.filter(attempt => attempt.status === "state_error").map(attempt => attempt.id)),
      invalidEvidenceIds: ids([
        ...unscopedInvalid,
        ...[...invalid].filter(([, affected]) => affected.some(item => sameObject(item, target))).map(([id]) => id),
      ]),
    };
  });
}
