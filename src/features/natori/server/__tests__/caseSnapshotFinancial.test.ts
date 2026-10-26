import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { adaptCaseFinancial, FINANCIAL_RELATIONS } from "../caseSnapshotFinancial";
import { sourceProjectSchema, type CaseSourceContext } from "../caseSnapshotSource";
import { summarizeCaseNotifications } from "../../lib/caseNotificationFacts";
import type { CaseObservation } from "../../types/caseReadModel";

const created = "2026-10-01T00:00:00Z";
const accepted = "2026-10-02T00:00:00Z";
const paid = "2026-10-03T00:00:00Z";
const asOf = "2026-10-20T00:00:00Z";
const deadline = "2026-10-25T00:00:00Z";
const extended = "2026-11-01T00:00:00Z";
const id = { project_id: "project-fixture" };
const row = <T extends object>(value: T, patch: Partial<T> = {}): T => ({ ...value, ...patch });
const context = (
  sections: Record<string, unknown[]> = {}, project: Record<string, unknown> = {},
): CaseSourceContext => ({
  project: sourceProjectSchema.parse({
    id: id.project_id, user_id: "owner-fixture", status: "quoted", type: "icon", amount: 40000,
    active_quote_id: null, quote_accepted_at: null, quote_accepted_amount: null,
    payment_confirmed_at: null, paid_amount: null, paid_at: null, completed_at: null,
    delivery_accepted_at: null, delivered_mail_at: null, has_legacy_payment_link: false,
    payment_link_status: null, deleted_at: null, created_at: created, updated_at: created,
    ...project,
  }),
  snapshotId: "snapshot-fixture", observedAt: asOf,
  sections: Object.fromEntries(FINANCIAL_RELATIONS.map(relation => {
    const rows = sections[relation.name] ?? [];
    return [relation.name, { rows, total: rows.length }];
  })),
});
function value<T>(observation: CaseObservation<T>): T {
  expect(observation.state).toBe("ready");
  if (observation.state !== "ready") throw new Error("Expected ready");
  return observation.value;
}
const quote = {
  ...id, id: "quote-fixture", user_id: "owner-fixture", version: 2, amount: 40000,
  expires_at: deadline, accepted_at: accepted as string | null, superseded_at: null as string | null,
  created_at: created, issued_at: created as string | null,
};
const activeQuote = { active_quote_id: quote.id, quote_accepted_at: accepted, quote_accepted_amount: 40000 };
const link = {
  ...id, id: "link-fixture", owner_id: "owner-fixture", quote_id: quote.id, generation: 2,
  amount: 40000, state: "active", deadline, deadline_revision: 2, created_at: created, updated_at: accepted,
  has_provider_link: true, is_project_link: true,
};
const payment = {
  ...id, id: "payment-fixture", quote_id: quote.id, amount: 40000, status: "received",
  received_at: paid, currency: "jpy" as string | null, has_session: true, is_original: true,
  is_manual_candidate: false, amount_unavailable: false, has_refund_mapping: true,
};
const paidProject = { payment_confirmed_at: paid, paid_at: paid, paid_amount: 40000 };
const refund = {
  ...id, id: "refund-fixture", owner_id: "owner-fixture", transaction_id: payment.id as string | null,
  amount: 10000 as number | null, currency: "jpy" as string | null, provider_status: "succeeded",
  resolution: "resolved", confirmed_at: paid as string | null, created_at: paid, updated_at: paid,
  project_matches: true,
};
const notice = {
  ...id, id: "notice-fixture", quote_id: quote.id as string | null, notification_key: "opaque-series",
  attempt_no: 1, purpose: "quote_issue_client", status: "sent", sent_at: accepted as string | null,
  created_at: created, updated_at: accepted, snapshot: { version: 2 } as Record<string, unknown>,
  payload_expires_at: null as string | null, release_id: null as string | null,
  release_expires_at: null as string | null, release_accepted_at: null as string | null,
  message_id: null as string | null, message_created_at: null as string | null,
  message_sender: null as string | null, message_operation_id: null as string | null,
  rough_id: null as string | null, rough_ok_at: null as string | null,
};
const deliveryNotice = row(notice, {
  purpose: "delivery_issue_client", quote_id: null, release_id: "release-fixture",
  release_expires_at: deadline, payload_expires_at: deadline, snapshot: { releaseId: "release-fixture" },
});
const deliveryOp = {
  ...id, id: "delivery-op-fixture", release_id: "release-fixture", notification_id: notice.id,
  created_at: created, original_expires_at: deadline, extension_expires_at: null as string | null,
  notification_key: notice.notification_key,
};
const legacy = {
  ...id, id: "17", quote_id: quote.id as string | null, kind: "estimate", amount: 40000,
  status: "sent", sent_at: accepted as string | null, created_at: created, updated_at: accepted,
  attempt_id: null as string | null,
};

describe("financial source boundaries", () => {
  it("distinguishes complete absence from not requested or incomplete rows", () => {
    const ctx = context();
    const result = adaptCaseFinancial(ctx);
    expect(result.quote.state).toBe("absent");
    expect(result.link.state).toBe("absent");
    expect(result.payment.state).toBe("absent");
    expect(value(result.financialReview)).toEqual([]);
    expect(value(result.notifications)).toEqual([]);
    expect(value(result.operations)).toEqual([]);
    const { financial_quotes: omitted, ...rest } = ctx.sections;
    void omitted;
    expect(adaptCaseFinancial({ ...ctx, sections: rest }).quote.state).toBe("not_requested");
    expect(adaptCaseFinancial({ ...ctx, sections: { ...ctx.sections,
      financial_payments: { rows: [], total: 1 } } }).payment).toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("rejects foreign, duplicated, and truncated evidence without inventing an absence", () => {
    for (const rows of [
      [row(quote, { project_id: "other-project" })],
      [quote, quote],
    ]) {
      expect(adaptCaseFinancial(context({ financial_quotes: rows }, activeQuote)).quote.state).toBe("unavailable");
    }
    const ctx = context();
    expect(adaptCaseFinancial({ ...ctx, sections: { ...ctx.sections,
      financial_refunds: { rows: [], total: 201 } } }).financialReview.state).toBe("unavailable");
  });

  it("fails the affected domain on malformed money, date or status", () => {
    for (const patch of [
      { amount: Number.MAX_SAFE_INTEGER + 1 }, { received_at: "not-a-date" }, { status: "future-status" },
    ]) {
      expect(adaptCaseFinancial(context({ financial_payments: [{ ...payment, ...patch }] }, paidProject)).payment.state)
        .toBe("unavailable");
    }
  });

  it("uses fixed owner joins and projects no provider IDs, addresses, bodies or complete payloads", () => {
    for (const relation of FINANCIAL_RELATIONS) {
      expect(relation.select).toMatch(/JOIN authorized_case p ON/);
      expect(relation.select).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|FOR UPDATE)\b/i);
      const selected = relation.select.split(/\bFROM public\./)[0];
      expect(selected).not.toMatch(/(?:\.\*|\bto_email\b|\bbody_snapshot\b|\bprovider_id\b|\btoken_hash\b|\bciphertext\b)/);
      expect(selected).not.toMatch(/\b(?:j\.payload|j\.snapshot)\s*(?:,|$)/);
    }
    expect(FINANCIAL_RELATIONS.find(r => r.name === "financial_notifications")?.select)
      .toContain("md5(j.notification_key)");
    expect(FINANCIAL_RELATIONS.find(r => r.name === "financial_inbox")?.select)
      .toContain("refund_snapshot_incomplete");
  });
});

describe("quote and link normalization", () => {
  it("selects active_quote_id, not the newest quote or draft revision", () => {
    const other = row(quote, { id: "quote-newer", version: 3, superseded_at: accepted });
    const result = adaptCaseFinancial(context({ financial_quotes: [other, quote] }, activeQuote));
    expect(value(result.quote).id).toBe(quote.id);
    expect(value(result.quote).version).toBe(2);
  });

  it("preserves expired accepted quote facts and uses immutable quoted amount", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [row(quote, { expires_at: "2026-10-05T00:00:00Z" })],
    }, { ...activeQuote, amount: 99999 }));
    expect(value(result.quote).acceptance?.money.amount).toBe(40000);
    expect(value(result.quote).acceptance?.acceptedAt).toBe(accepted);
  });

  it("does not silently repair acceptance projection conflicts", () => {
    const result = adaptCaseFinancial(context({ financial_quotes: [quote] }, {
      ...activeQuote, quote_accepted_amount: 30000,
    }));
    expect(result.quote).toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("rejects backwards quote and link chronology", () => {
    for (const patch of [
      { issued_at: "2026-09-30T00:00:00Z" },
      { accepted_at: "2026-09-30T00:00:00Z" },
      { superseded_at: "2026-09-30T00:00:00Z" },
    ]) {
      expect(adaptCaseFinancial(context({
        financial_quotes: [{ ...quote, ...patch }],
      }, activeQuote)).quote.state).toBe("unavailable");
    }
    expect(adaptCaseFinancial(context({
      financial_quotes: [quote],
      financial_links: [row(link, { updated_at: "2026-09-30T00:00:00Z" })],
    }, activeQuote)).link.state).toBe("unavailable");
  });

  it("does not collapse PostgreSQL microseconds in acceptance equality or deadline identity", () => {
    expect(adaptCaseFinancial(context({
      financial_quotes: [row(quote, { accepted_at: "2026-10-02T00:00:00.000001Z" })],
    }, { ...activeQuote, quote_accepted_at: "2026-10-02T00:00:00.000002Z" })).quote.state).toBe("unavailable");
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote],
      financial_links: [row(link, { deadline: "2026-10-25T09:00:00.123456+09:00" })],
    }, activeQuote));
    expect(value(result.link).deadlineRevision).toBe("2026-10-25T00:00:00.123456Z");
  });

  it("leaves an estimate draft unsupported instead of inventing its quote version or money", () => {
    const result = adaptCaseFinancial(context({ financial_drafts: [{
      ...id, id: id.project_id, user_id: "owner-fixture", revision: 9, updated_at: created,
    }] }));
    expect(result.quote).toEqual({ state: "unavailable", reason: "unsupported" });
  });

  it("retains the legacy link boundary instead of presenting it as unissued", () => {
    expect(adaptCaseFinancial(context({}, { has_legacy_payment_link: true })).link)
      .toEqual({ state: "unavailable", reason: "unsupported" });
    expect(adaptCaseFinancial(context({}, { payment_link_status: "creating" })).link)
      .toEqual({ state: "unavailable", reason: "unsupported" });
  });

  it("selects the actual latest generation and canonical deadline identity", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote],
      financial_links: [row(link, { id: "older-link", generation: 1, state: "inactive" }), link],
    }, activeQuote));
    expect(value(result.link)).toMatchObject({
      id: link.id, generation: 2, deadlineRevision: "2026-10-25T00:00:00.000Z",
      state: "active", providerState: "active", quoteId: quote.id,
    });
  });

  it("rejects a link with foreign ownership, conflicting money or a mismatched project projection", () => {
    for (const patch of [{ owner_id: "other-owner" }, { amount: 1 }, { is_project_link: false }]) {
      expect(adaptCaseFinancial(context({
        financial_quotes: [quote], financial_links: [{ ...link, ...patch }],
      }, activeQuote)).link.state).toBe("unavailable");
    }
  });

  it("keeps inactive, stopping and review observations distinct", () => {
    for (const [raw, state, providerState] of [
      ["inactive", "stopped", "inactive"], ["stop_required", "stopping", "unverified"],
      ["needs_review", "unknown", "unverified"],
    ]) {
      const result = adaptCaseFinancial(context({
        financial_quotes: [quote], financial_links: [row(link, { state: raw })],
      }, activeQuote));
      expect(value(result.link)).toMatchObject({ state, providerState });
    }
  });
});

describe("payment and unresolved financial attention", () => {
  it("keeps canonical paid evidence alongside an unrelated payment review", () => {
    const result = adaptCaseFinancial(context({
      financial_payments: [payment, row(payment, {
        id: "mismatch", status: "amount_mismatch", is_original: false, has_refund_mapping: false,
      })],
    }, paidProject));
    expect(value(result.payment)).toMatchObject({ id: payment.id, method: "stripe", money: { amount: 40000 } });
    expect(value(result.financialReview)).toMatchObject([{ id: "payment:mismatch", kind: "payment_review" }]);
  });

  it("preserves a confirmed legacy payment without deriving money from project.amount", () => {
    const result = adaptCaseFinancial(context({}, { ...paidProject, paid_amount: null, amount: 90000 }));
    expect(value(result.payment)).toMatchObject({
      source: "legacy_projection", method: "unclassified", confirmedAt: paid, money: null,
    });
    expect(result.financialReview).toEqual({ state: "unavailable", reason: "unsupported" });
  });

  it("does not infer historical origin from a matching manual transaction", () => {
    const result = adaptCaseFinancial(context({ financial_payments: [row(payment, {
      status: "manual", has_session: false, is_original: false, is_manual_candidate: true,
      has_refund_mapping: false, currency: null,
    })] }, paidProject));
    expect(value(result.payment)).toMatchObject({ method: "manual", source: "manual_record" });
    expect(result.financialReview.state).toBe("unavailable");
  });

  it("rejects multiple canonical candidates and project timestamp conflicts", () => {
    expect(adaptCaseFinancial(context({
      financial_payments: [payment, row(payment, { id: "second-candidate" })],
    }, paidProject)).payment.state).toBe("unavailable");
    expect(adaptCaseFinancial(context({ financial_payments: [payment] }, {
      ...paidProject, paid_at: accepted,
    })).payment.state).toBe("unavailable");
  });

  it("does not turn PAY-05 amount_unavailable's placeholder zero into a confirmed zero payment", () => {
    const result = adaptCaseFinancial(context({ financial_payments: [row(payment, {
      amount: 0, status: "needs_review", is_original: false, amount_unavailable: true, has_refund_mapping: false,
    })] }));
    expect(result.payment.state).toBe("absent");
    expect(value(result.financialReview)[0].kind).toBe("payment_review");
  });

  it("excludes a fully correlated confirmed refund from outstanding attention", () => {
    const result = adaptCaseFinancial(context({
      financial_payments: [payment], financial_refunds: [refund],
    }, paidProject));
    expect(value(result.financialReview)).toEqual([]);
    expect(value(result.payment).confirmedAt).toBe(paid);
  });

  it("does not mistake a retained confirmed_at for the current refund status", () => {
    for (const [provider_status, kind] of [["failed", "refund_review"], ["requires_action", "refund_pending"]]) {
      const result = adaptCaseFinancial(context({
        financial_payments: [payment], financial_refunds: [row(refund, { provider_status })],
      }, paidProject));
      expect(value(result.financialReview)[0].kind).toBe(kind);
    }
  });

  it("quarantines contradictory refund totals or missing resolved transaction evidence", () => {
    for (const refunds of [
      [row(refund, { amount: 30000 }), row(refund, { id: "refund-second", amount: 20000 })],
      [row(refund, { transaction_id: "unread-payment" })],
      [row(refund, { confirmed_at: null })],
    ]) {
      expect(adaptCaseFinancial(context({ financial_payments: [payment], financial_refunds: refunds }, paidProject))
        .financialReview.state).toBe("unavailable");
    }
  });

  it("keeps every selected unresolved inbox item independently", () => {
    const result = adaptCaseFinancial(context({ financial_inbox: [
      { ...id, id: "opaque-inbox", owner_id: "owner-fixture", status: "processing", created_at: created, updated_at: paid },
      { ...id, id: "opaque-review", owner_id: "owner-fixture", status: "needs_review", created_at: created, updated_at: paid },
    ] }));
    expect(value(result.financialReview).map(f => f.kind)).toEqual(["payment_processing", "payment_review"]);
  });
});

describe("notification identity and provider evidence", () => {
  it("keeps an earlier success despite the latest attempt failing", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_notifications: [
        notice, row(notice, { id: "failed-resend", notification_key: "different-series", status: "failed",
          sent_at: null, created_at: paid, updated_at: paid }),
      ],
    }, activeQuote));
    const facts = value(result.notifications);
    const [summary] = summarizeCaseNotifications(facts, [{ kind: "quote", id: quote.id, revision: "2" }], id.project_id);
    expect(summary.currentSuccessIds).toEqual([notice.id]);
    expect(summary.latestAttemptId).toBe("failed-resend");
  });

  it("never invents a successor resolution for an unknown notice", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_notifications: [
        { ...notice, status: "unknown", sent_at: null, resolvedByAttemptId: "success" },
        row(notice, { id: "success", notification_key: "unrelated-series", created_at: paid, sent_at: paid, updated_at: paid }),
      ],
    }));
    const facts = value(result.notifications);
    expect(facts.every(j => j.resolvedByAttemptId === null)).toBe(true);
    expect(summarizeCaseNotifications(facts, [{ kind: "quote", id: quote.id, revision: "2" }], id.project_id)[0].unresolvedIds)
      .toEqual([notice.id]);
  });

  it("rejects quote version mismatch, foreign quote FK and sent without a timestamp", () => {
    for (const patch of [{ snapshot: { version: 1 } }, { quote_id: "foreign-quote" }, { sent_at: null }]) {
      expect(adaptCaseFinancial(context({
        financial_quotes: [quote], financial_notifications: [{ ...notice, ...patch }],
      })).notifications.state).toBe("unavailable");
    }
  });

  it("treats malformed snapshot times as incomplete without throwing", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_notifications: [row(notice, {
        purpose: "quote_accept_artist", snapshot: { amount: 40000, acceptedAt: "not-a-time" },
      })],
    }));
    expect(result.notifications).toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("uses a payment notice's immutable deadline instead of the link's current deadline", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_links: [row(link, { deadline: extended })],
      financial_notifications: [row(notice, {
        purpose: "payment_link_client", snapshot: { attemptId: link.id, generation: 2, deadline },
      })],
    }, activeQuote));
    const facts = value(result.notifications);
    const [summary] = summarizeCaseNotifications(facts, [{
      kind: "payment_link", id: link.id, revision: new Date(extended).toISOString(),
    }], id.project_id);
    expect(summary.pastSuccessIds).toEqual([notice.id]);
    expect(summary.currentSuccessIds).toEqual([]);
  });

  it("preserves delivery original and extension notices as separate expiry conditions", () => {
    const second = row(deliveryNotice, {
      id: "extended-notice", notification_key: "extended-series", payload_expires_at: extended,
    });
    const result = adaptCaseFinancial(context({
      financial_notifications: [deliveryNotice, second], financial_delivery_operations: [
        deliveryOp, { ...deliveryOp, id: "extension-op", notification_id: second.id,
          notification_key: second.notification_key, extension_expires_at: extended },
      ],
    }));
    const facts = value(result.notifications);
    const [summary] = summarizeCaseNotifications(facts, [{
      kind: "delivery", id: "release-fixture", revision: new Date(extended).toISOString(),
    }], id.project_id);
    expect(summary.pastSuccessIds).toEqual(["extended-notice", notice.id]);
    expect(summary.currentSuccessIds).toEqual(["extended-notice"]);
  });

  it("uses only the immutable operation even when payload retention metadata is absent", () => {
    const ctx = context({
      financial_notifications: [row(deliveryNotice, { payload_expires_at: null })],
      financial_delivery_operations: [deliveryOp],
    });
    expect(value(adaptCaseFinancial(ctx).notifications)[0].target.revision).toBe(new Date(deadline).toISOString());
    expect(adaptCaseFinancial(context({ financial_notifications: [deliveryNotice] })).notifications.state).toBe("unavailable");
  });

  it("does not confuse the encrypted payload's 24-hour retention with delivery expiry", () => {
    const result = adaptCaseFinancial(context({
      financial_notifications: [row(deliveryNotice, { payload_expires_at: "2026-10-02T00:00:00Z" })],
      financial_delivery_operations: [deliveryOp],
    }));
    expect(value(result.notifications)[0].target.revision).toBe("2026-10-25T00:00:00.000Z");
    expect(value(result.operations)[0].target.revision).toBe("2026-10-25T00:00:00.000Z");
    expect(FINANCIAL_RELATIONS.find(r => r.name === "financial_notifications")?.select).not.toContain("j.payload");
  });

  it("rejects ambiguous delivery operation conditions for a notification series", () => {
    const result = adaptCaseFinancial(context({
      financial_notifications: [deliveryNotice], financial_delivery_operations: [
        deliveryOp, { ...deliveryOp, id: "conflicting-operation", extension_expires_at: extended },
      ],
    }));
    expect(result.notifications).toEqual({ state: "unavailable", reason: "incomplete" });
    expect(result.operations).toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("does not call a receipt mail a successful delivery notice", () => {
    const result = adaptCaseFinancial(context({ financial_notifications: [row(notice, {
      quote_id: null, purpose: "delivery_accept_client", release_id: "release-fixture",
      release_accepted_at: accepted, snapshot: { acceptedAt: accepted },
    })] }));
    const facts = value(result.notifications);
    expect(facts[0].purpose).toBe("receipt_notice");
    expect(summarizeCaseNotifications(facts, [{
      kind: "delivery", id: "release-fixture", revision: new Date(deadline).toISOString(),
    }], id.project_id)[0].currentSuccessIds).toEqual([]);
  });

  it("does not call a staff rough-OK notification a rough submission notice", () => {
    const result = adaptCaseFinancial(context({ financial_notifications: [row(notice, {
      purpose: "rough_ok_artist", quote_id: null, rough_id: "rough-fixture", rough_ok_at: accepted,
      snapshot: { roughId: "rough-fixture", clientOkAt: accepted },
    })] }));
    expect(value(result.notifications)[0]).toMatchObject({
      purpose: "staff_notice", target: { kind: "rough", id: "rough-fixture", revision: new Date(accepted).toISOString() },
    });
  });

  it("exposes unsupported purpose boundaries without losing the separate payment domain", () => {
    for (const purpose of ["payment_received_client", "refund_confirmed_artist", "intake_client", "future-purpose"]) {
      const result = adaptCaseFinancial(context({
        financial_payments: [payment], financial_notifications: [row(notice, { purpose })],
      }, paidProject));
      expect(result.notifications).toEqual({ state: "unavailable", reason: "unsupported" });
      expect(value(result.payment).confirmedAt).toBe(paid);
    }
  });

  it("preserves legacy state_error success and its unresolved projection review", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_legacy_notices: [row(legacy, { status: "state_error" })],
    }));
    const [summary] = summarizeCaseNotifications(value(result.notifications), [{
      kind: "quote", id: quote.id, revision: "2",
    }], id.project_id);
    expect(summary.currentSuccessIds).toEqual(["legacy-mail:17"]);
    expect(summary.projectionReviewIds).toEqual(["legacy-mail:17"]);
  });

  it("keeps legacy failures unknown and never extends a live deadline from state_error", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_links: [link],
      financial_legacy_notices: [row(legacy, { kind: "payment", attempt_id: link.id, status: "state_error" })],
    }, activeQuote));
    expect(value(result.link).expiresAt).toBe(deadline);
    expect(value(result.notifications)[0].status).toBe("state_error");
    const failed = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_legacy_notices: [row(legacy, { status: "failed", sent_at: null })],
    }));
    expect(value(failed.notifications)[0]).toMatchObject({ status: "unknown", sentAt: null });
  });

  it("preserves fractional seconds when deriving the legacy notice's seven-day terms", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_links: [link],
      financial_legacy_notices: [row(legacy, {
        kind: "payment", attempt_id: link.id, status: "state_error",
        sent_at: "2026-10-02T00:00:00.123456Z", updated_at: "2026-10-02T00:00:00.123457Z",
      })],
    }, activeQuote));
    expect(value(result.notifications)[0].target.revision).toBe("2026-10-09T00:00:00.123456Z");
    expect(value(result.link).deadlineRevision).toBe("2026-10-25T00:00:00.000Z");
  });
});

describe("operation completion is separate from mail acceptance", () => {
  it("uses committed quote issue receipts even when their mail is pending", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote],
      financial_notifications: [row(notice, { status: "pending", sent_at: null })],
      financial_quote_operations: [{
        ...id, id: "quote-op", quote_id: quote.id, notification_id: notice.id, created_at: created,
      }],
    }, activeQuote));
    expect(value(result.operations)[0].state).toBe("succeeded");
    expect(value(result.notifications)[0].status).toBe("pending");
  });

  it("does not infer a pending link operation completed from a later mail", () => {
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_links: [link],
      financial_link_operations: [{
        ...id, id: "link-op", attempt_id: link.id, action: "issue", status: "pending",
        proposed_deadline: deadline, expected_revision: 2, notification_id: null, created_at: created,
      }],
    }, activeQuote));
    expect(value(result.operations)[0].state).toBe("pending");
  });

  it.each(["issue", "reissue", "renotify"])("requires a matching notice for completed %s", (action) => {
    const op = {
      ...id, id: "link-op", attempt_id: link.id, action, status: "completed",
      proposed_deadline: deadline, expected_revision: 2, notification_id: notice.id as string | null, created_at: created,
    };
    const mail = row(notice, {
      purpose: "payment_link_client", snapshot: { attemptId: link.id, generation: 2, deadline },
    });
    const valid = adaptCaseFinancial(context({
      financial_links: [link], financial_notifications: [mail], financial_link_operations: [op],
    }));
    expect(value(valid.operations)[0].state).toBe("succeeded");
    const badCases = [
      [row(op, { notification_id: null }), mail],
      [op, row(mail, { snapshot: { attemptId: "another-attempt", generation: 2, deadline } })],
    ] as const;
    for (const [candidate, candidateMail] of badCases) {
      const result = adaptCaseFinancial(context({
        financial_links: [link], financial_notifications: [candidateMail], financial_link_operations: [candidate],
      }));
      expect(result.operations).toEqual({ state: "unavailable", reason: "incomplete" });
    }
    if (action !== "renotify") {
      expect(adaptCaseFinancial(context({
        financial_links: [link], financial_link_operations: [op],
        financial_notifications: [row(mail, { snapshot: { attemptId: link.id, generation: 2, deadline: extended } })],
      })).operations).toEqual({ state: "unavailable", reason: "incomplete" });
    }
  });

  it("uses the renotify snapshot deadline even when proposed_deadline is absent or different", () => {
    for (const proposed_deadline of [null, extended]) {
      const result = adaptCaseFinancial(context({
        financial_links: [row(link, { deadline: extended })],
        financial_notifications: [row(notice, {
          purpose: "payment_link_client", snapshot: { attemptId: link.id, generation: 2, deadline },
        })],
        financial_link_operations: [{
          ...id, id: "renotify-op", attempt_id: link.id, action: "renotify", status: "completed",
          proposed_deadline, expected_revision: 1, notification_id: notice.id, created_at: created,
        }],
      }));
      expect(value(result.operations)[0].target.revision).toBe(new Date(deadline).toISOString());
    }
  });

  it("allows completed extend/adopt receipts without a notice", () => {
    for (const action of ["extend", "adopt"]) {
      const result = adaptCaseFinancial(context({
        financial_links: [link], financial_link_operations: [{
          ...id, id: "link-op", attempt_id: link.id, action, status: "completed",
          proposed_deadline: deadline, expected_revision: 2, notification_id: null, created_at: created,
        }],
      }));
      expect(value(result.operations)[0].state).toBe("succeeded");
    }
  });

  it("retains unresolved stops but does not manufacture targets for old stops", () => {
    const stop = {
      ...id, id: "stop-fixture", owner_id: "owner-fixture", attempt_id: link.id as string | null,
      deadline_revision: 2, status: "needs_review", created_at: created, updated_at: accepted,
    };
    const result = adaptCaseFinancial(context({
      financial_quotes: [quote], financial_links: [link], financial_link_stops: [stop],
    }));
    expect(value(result.operations)[0].state).toBe("unknown");
    expect(adaptCaseFinancial(context({ financial_link_stops: [row(stop, { attempt_id: null })] })).operations.state)
      .toBe("unavailable");
  });

  it("keeps pre-message consultation operations unsupported and excludes completed cleanup", () => {
    const op = {
      ...id, id: "staff/consultation-op", operation_id: "consultation-op", sender: "staff", status: "reserved",
      message_id: null, notification_id: null, created_at: created, message_created_at: null,
    };
    expect(adaptCaseFinancial(context({ financial_consultation_operations: [op] })).operations)
      .toEqual({ state: "unavailable", reason: "unsupported" });
    expect(value(adaptCaseFinancial(context({
      financial_consultation_operations: [row(op, { status: "cleaned" })],
    })).operations)).toEqual([]);
  });

  it("does not mutate input, depend on source row order or consult a clock", () => {
    const ctx = context({
      financial_quotes: [quote], financial_notifications: [
        notice, row(notice, { id: "next", notification_key: "next-series", created_at: paid, sent_at: paid, updated_at: paid }),
      ],
    }, activeQuote);
    const before = structuredClone(ctx);
    const now = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("No clock reads"); });
    try {
      const first = adaptCaseFinancial(ctx);
      const second = adaptCaseFinancial(context({
        financial_quotes: [quote], financial_notifications: [
          row(notice, { id: "next", notification_key: "next-series", created_at: paid, sent_at: paid, updated_at: paid }), notice,
        ],
      }, activeQuote));
      expect(first).toEqual(second);
      expect(ctx).toEqual(before);
    } finally { now.mockRestore(); }
  });
});

describe('current payment notice evidence',()=>{
 const notice=(id:string,at:string)=>({...legacy,id,kind:'payment',link_identity:'opaque-link',is_project_link:true,sent_at:at,created_at:at,updated_at:at});
 it('derives latest successful terms without claiming current Stripe state',()=>{const result=adaptCaseFinancial(context({financial_quotes:[quote],financial_legacy_notices:[notice('a','2026-10-18T00:00:00Z'),notice('b','2026-10-19T00:00:00Z')]},{...activeQuote,has_legacy_payment_link:true,payment_link_status:'sent'}));expect(value(result.link)).toMatchObject({source:'legacy_projection',generation:null,providerState:'unverified',termsPolicy:'sent_plus_7_days',expiresAt:'2026-10-26T00:00:00.000Z'});expect(value(result.notifications)).toHaveLength(2);});
 it('does not use a different quote or pre-acceptance notice as current terms',()=>{for(const patch of [{quote_id:'other'},{sent_at:'2026-10-01T12:00:00Z',created_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-01T12:00:00Z'}]){const result=adaptCaseFinancial(context({financial_quotes:[quote],financial_legacy_notices:[{...notice('a','2026-10-18T00:00:00Z'),...patch}]},{...activeQuote,has_legacy_payment_link:true,payment_link_status:'sent'}));expect(result.link.state).not.toBe('ready');}});
});
