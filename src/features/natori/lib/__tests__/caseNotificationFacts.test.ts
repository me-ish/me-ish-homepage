import { describe, expect, it } from "vitest";
import type { CaseNotificationAttempt, CaseTarget } from "../../types/caseReadModel";
import { summarizeCaseNotifications } from "../caseNotificationFacts";

const projectId = "project-a";
const target: CaseTarget = { kind: "payment_link", id: "link-a", revision: "deadline-2" };
const attempt = (overrides: Partial<CaseNotificationAttempt> = {}): CaseNotificationAttempt => ({
  id: "notice-a", projectId, revision: "1", recordedAt: "2026-10-20T01:00:00Z", source: "ledger",
  target, purpose: "payment_notice", notificationKey: "payment-link/link-a/operation-a", attemptNo: 1,
  operationId: "operation-a", status: "pending", sentAt: null, resolvedByAttemptId: null, ...overrides,
});
const sent = (overrides: Partial<CaseNotificationAttempt> = {}) => attempt({
  status: "sent", sentAt: "2026-10-20T01:01:00Z", ...overrides,
});
const summary = (attempts: readonly CaseNotificationAttempt[], selected: CaseTarget = target) =>
  summarizeCaseNotifications(attempts, [selected], projectId)[0];

describe("case notification evidence", () => {
  it("separates old deadline success, current success and the latest failed renotification", () => {
    const old = sent({ id: "old", target: { ...target, revision: "deadline-1" }, notificationKey: "old-key" });
    const current = sent({ id: "current", notificationKey: "current-key", recordedAt: "2026-10-20T02:00:00Z" });
    const failed = attempt({ id: "failed", notificationKey: "renotify-key", recordedAt: "2026-10-20T03:00:00Z", status: "failed" });
    expect(summary([old, current, failed])).toMatchObject({
      pastSuccessIds: ["current", "old"], currentSuccessIds: ["current"],
      latestAttemptId: "failed", failedIds: ["failed"], unresolvedIds: [], invalidEvidenceIds: [],
    });
    expect(summary([old])).toMatchObject({
      pastSuccessIds: ["old"], currentSuccessIds: [], latestAttemptId: null,
    });
  });

  it("follows the same notification key's successor instead of keeping a recovered failure active", () => {
    const failed = attempt({ id: "failed", status: "failed" });
    const retry = sent({ id: "retry", attemptNo: 2, recordedAt: "2026-10-20T02:00:00Z" });
    expect(summary([retry, failed])).toMatchObject({
      currentSuccessIds: ["retry"], latestAttemptId: "retry", failedIds: [], invalidEvidenceIds: [],
    });
  });

  it("keeps an earlier unknown after a different notice succeeds, including an older deadline", () => {
    const unknown = attempt({
      id: "unknown", target: { ...target, revision: "deadline-1" }, status: "unknown", notificationKey: "unknown-key",
    });
    const success = sent({ id: "success", notificationKey: "new-key" });
    expect(summary([unknown, success])).toMatchObject({
      currentSuccessIds: ["success"], unresolvedIds: ["unknown"], invalidEvidenceIds: [],
    });
  });

  it("requires explicit same-key terminal successor evidence to resolve an unknown", () => {
    const unknown = attempt({ id: "unknown", status: "unknown" });
    const successor = sent({ id: "successor", attemptNo: 2, recordedAt: "2026-10-20T02:00:00Z" });
    expect(summary([unknown, successor]).unresolvedIds).toEqual(["unknown"]);
    expect(summary([{ ...unknown, resolvedByAttemptId: "successor" }, successor])).toMatchObject({
      unresolvedIds: [], currentSuccessIds: ["successor"], invalidEvidenceIds: [],
    });
  });

  it.each([
    { notificationKey: "another-key" },
    { projectId: "another-project" },
    { target: { ...target, revision: "another-revision" } },
    { target: { ...target, id: "another-link" } },
    { purpose: "staff_notice" as const },
    { attemptNo: 1 },
    { status: "pending" as const, sentAt: null },
  ])("does not resolve unknown with an incompatible successor %j", changed => {
    const unknown = attempt({ id: "unknown", status: "unknown", resolvedByAttemptId: "successor" });
    const successor = sent({ id: "successor", attemptNo: 2, ...changed });
    const result = summary([unknown, successor]);
    expect(result.invalidEvidenceIds.length).toBeGreaterThan(0);
    // Conflicting frozen-series identities are quarantined; otherwise the
    // unknown remains visible. Neither outcome permits treating it as resolved.
    expect(result.unresolvedIds.includes("unknown") || result.invalidEvidenceIds.includes("unknown")).toBe(true);
  });

  it("rejects missing, self-referential and cyclic resolution evidence", () => {
    for (const resolvedByAttemptId of ["missing", "unknown"]) {
      expect(summary([attempt({ id: "unknown", status: "unknown", resolvedByAttemptId })])).toMatchObject({
        unresolvedIds: ["unknown"], invalidEvidenceIds: ["unknown"],
      });
    }
    const one = attempt({ id: "one", status: "unknown", resolvedByAttemptId: "two" });
    const two = attempt({ id: "two", attemptNo: 2, status: "unknown", resolvedByAttemptId: "one" });
    expect(summary([one, two])).toMatchObject({
      unresolvedIds: ["one", "two"], invalidEvidenceIds: ["one", "two"],
    });
  });

  it("keeps state_error plus sentAt as accepted and a separate projection review", () => {
    const stateError = sent({ id: "state-error", source: "legacy_projection", status: "state_error" });
    const later = sent({ id: "later", notificationKey: "later-key", recordedAt: "2026-10-20T02:00:00Z" });
    expect(summary([stateError, later])).toMatchObject({
      pastSuccessIds: ["later", "state-error"], currentSuccessIds: ["later", "state-error"],
      projectionReviewIds: ["state-error"], failedIds: [],
    });
  });

  it("does not substitute staff or receipt notices for client delivery notice success", () => {
    const delivery: CaseTarget = { kind: "delivery", id: "release-a", revision: "expiry-1" };
    const staff = sent({ id: "staff", target: delivery, purpose: "staff_notice", notificationKey: "staff" });
    const receipt = sent({ id: "receipt", target: delivery, purpose: "receipt_notice", notificationKey: "receipt" });
    const notice = sent({ id: "notice", target: delivery, purpose: "delivery_notice", notificationKey: "delivery" });
    expect(summary([staff, receipt], delivery)).toMatchObject({
      pastSuccessIds: [], currentSuccessIds: [], latestAttemptId: null,
    });
    expect(summary([staff, receipt, notice], delivery)).toMatchObject({
      pastSuccessIds: ["notice"], currentSuccessIds: ["notice"], latestAttemptId: "notice",
    });
  });

  it("keeps attention for non-primary purposes without claiming that the client notice failed", () => {
    const delivery: CaseTarget = { kind: "delivery", id: "release-a", revision: "expiry-1" };
    const staff = attempt({ id: "staff", target: delivery, purpose: "staff_notice", status: "unknown", notificationKey: "staff" });
    const receipt = attempt({ id: "receipt", target: delivery, purpose: "receipt_notice", status: "failed", notificationKey: "receipt" });
    const notice = sent({ id: "notice", target: delivery, purpose: "delivery_notice", notificationKey: "delivery" });
    expect(summary([staff, receipt, notice], delivery)).toMatchObject({
      currentSuccessIds: ["notice"], latestAttemptId: "notice", unresolvedIds: ["staff"], failedIds: ["receipt"],
    });
  });

  it("does not let a different project's success establish notice success", () => {
    expect(summary([sent({ projectId: "other" })])).toMatchObject({
      currentSuccessIds: [], pastSuccessIds: [], latestAttemptId: null, invalidEvidenceIds: ["notice-a"],
    });
  });

  it.each(["manual_record", "historical_registration"] as const)(
    "does not convert %s evidence into internal mail acceptance", source => {
      expect(summary([sent({ source })])).toMatchObject({
        currentSuccessIds: [], pastSuccessIds: [], latestAttemptId: null, invalidEvidenceIds: ["notice-a"],
      });
    },
  );

  it.each([
    { status: "sent" as const, sentAt: null },
    { status: "state_error" as const, sentAt: null },
    { status: "failed" as const, sentAt: "2026-10-20T01:00:00Z" },
    { status: "sent" as const, sentAt: "2026-02-30T01:00:00Z" },
    { recordedAt: "invalid" },
    { attemptNo: 0 },
    { attemptNo: 1.5 },
    { notificationKey: "" },
    { purpose: "quote_notice" as const },
  ])("quarantines contradictory or malformed evidence %j", changed => {
    expect(summary([attempt(changed)])).toMatchObject({
      currentSuccessIds: [], pastSuccessIds: [], latestAttemptId: null, invalidEvidenceIds: ["notice-a"],
    });
  });

  it("deduplicates identical join rows but rejects conflicting IDs and attempt numbers", () => {
    const notice = sent();
    expect(summary([notice, { ...notice, target: { ...target } }])).toMatchObject({
      currentSuccessIds: ["notice-a"], invalidEvidenceIds: [],
    });
    expect(summary([notice, { ...notice, status: "failed", sentAt: null }])).toMatchObject({
      currentSuccessIds: [], invalidEvidenceIds: ["notice-a"],
    });
    expect(summary([notice, sent({ id: "duplicate-number" })])).toMatchObject({
      currentSuccessIds: [], invalidEvidenceIds: ["duplicate-number", "notice-a"],
    });
  });

  it("does not infer an old object's success for a new object", () => {
    const old = sent({ target: { ...target, id: "old-link" } });
    expect(summary([old])).toMatchObject({
      currentSuccessIds: [], pastSuccessIds: [], latestAttemptId: null,
    });
  });

  it("is independent of input order and does not mutate its inputs", () => {
    const rows = [
      sent({ id: "one", notificationKey: "key-a" }),
      attempt({ id: "two", notificationKey: "key-b", status: "failed" }),
    ];
    rows.forEach(row => { Object.freeze(row.target); Object.freeze(row); });
    Object.freeze(rows);
    const selected = Object.freeze([Object.freeze({ ...target }), Object.freeze({ ...target, id: "other" })]);
    const first = summarizeCaseNotifications(rows, selected, projectId);
    expect(summarizeCaseNotifications([...rows].reverse(), [...selected].reverse(), projectId)).toEqual(first);
    expect(first.find(item => item.target.id === target.id)?.latestAttemptId).toBe("one");
  });
});
