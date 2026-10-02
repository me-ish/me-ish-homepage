import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import type { NatoriProject } from "../../types/projects";
import { normalizeNatoriPaymentEvent, isExplicitOtherProductRefund } from "../paymentEvent";
import { buildNatoriResultsCsv, getNatoriResultFinancials, getNatoriRefundStatusText, summarizeNatoriResults } from "../results";

const projectId = "aaaabbbb-cccc-4ddd-8eee-ffffffffffff";
function refund(object: Record<string, unknown>, type = "refund.created"): Stripe.Event {
  return { type, id: "evt_fixture", created: 1790880000, livemode: false, data: { object } } as unknown as Stripe.Event;
}
function project(overrides: Partial<NatoriProject> = {}): NatoriProject {
  return { id: projectId, title: "Refund fixture", clientName: "Synthetic", amount: 12000, paidAmount: 12000,
    paidAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-01T00:00:00Z", status: "completed", dueDate: "2026-10-01",
    type: "illustration", nextAction: "Completed", tasks: [],
    refunds: { available: true, originalMapped: true, confirmedAmount: 0, pendingCount: 0, reviewCount: 0 }, ...overrides };
}

describe("signed refund normalization", () => {
  it("retains stable IDs and excludes customer/private payloads", () => {
    const normalized = normalizeNatoriPaymentEvent(refund({ id: "re_fixture", amount: 3000, currency: "JPY", status: "succeeded",
      payment_intent: { id: "pi_fixture", customer: { email: "private@fixture.invalid" } }, charge: "ch_fixture",
      metadata: { kind: "natori_commission", projectId, unrelated: "private-value" }, description: "private-description" }));
    expect(normalized.request).toEqual({ kind: "refund", projectId: null, eventCreated: 1790880000, snapshotIncomplete: false,
      refunds: [{ refundId: "re_fixture", projectId, paymentIntentId: "pi_fixture", chargeId: "ch_fixture", amount: 3000,
        currency: "jpy", providerStatus: "succeeded" }] });
    expect(JSON.stringify(normalized)).not.toContain("private");
  });
  it("preserves invalid amount as unresolved input instead of clamping it", () => {
    const normalized = normalizeNatoriPaymentEvent(refund({ id: "re_fixture", amount: 1.5, currency: "INVALID", status: "pending" }));
    expect(normalized.request).toMatchObject({ refunds: [{ amount: null, currency: null, projectId: null }] });
  });
  it("normalizes expanded and scalar charge/intent IDs equally", () => {
    const original = { id: "re_fixture", amount: 3000, currency: "jpy", status: "pending", charge: "ch_fixture", payment_intent: "pi_fixture" };
    expect(normalizeNatoriPaymentEvent(refund(original))).toEqual(normalizeNatoriPaymentEvent(refund({ ...original,
      charge: { id: "ch_fixture" }, payment_intent: { id: "pi_fixture" } })));
  });
  it("sorts charge snapshot IDs and records truncation instead of counting aggregate amount_refunded", () => {
    const normalized = normalizeNatoriPaymentEvent(refund({ id: "ch_fixture", payment_intent: "pi_fixture", amount_refunded: 9000,
      refunds: { has_more: true, data: [{ id: "re_b", amount: 3000, currency: "jpy", status: "succeeded" },
        { id: "re_a", amount: 3000, currency: "jpy", status: "succeeded" }] } }, "charge.refunded"));
    expect(normalized.request).toMatchObject({ snapshotIncomplete: true, refunds: [{ refundId: "re_a", amount: 3000 }, { refundId: "re_b", amount: 3000 }] });
    expect(JSON.stringify(normalized)).not.toContain("9000");
  });
  it("does not infer product ownership from absence of metadata", () => {
    expect(isExplicitOtherProductRefund(refund({ metadata: { kind: "aura" } }))).toBe(true);
    expect(isExplicitOtherProductRefund(refund({ charge: { metadata: { kind: "card" } } }))).toBe(true);
    expect(isExplicitOtherProductRefund(refund({ payment_intent: "pi_unknown" }))).toBe(false);
    expect(normalizeNatoriPaymentEvent(refund({ id: "re_unknown", metadata: { projectId } })).request).toMatchObject({ refunds: [{ projectId: null }] });
  });
});

describe("gross / confirmed refund / net results", () => {
  it("preserves original gross and business facts for partial and full refunds", () => {
    const original = project({ refunds: { available: true, originalMapped: true, confirmedAmount: 3000, pendingCount: 1, reviewCount: 2 } });
    const before = JSON.stringify(original);
    expect(getNatoriResultFinancials(original)).toEqual({ gross: 12000, refunded: 3000, net: 9000, state: "partial", pendingCount: 1, reviewCount: 2 });
    expect(getNatoriRefundStatusText(original)).toBe("一部返金 / 返金処理中 1件 / 返金要確認 2件");
    expect(getNatoriResultFinancials(project({ refunds: { available: true, originalMapped: true, confirmedAmount: 12000, pendingCount: 0, reviewCount: 0 } })).state).toBe("full");
    expect(JSON.stringify(original)).toBe(before);
  });
  it("keeps unknown gross and missing projection distinct from a confirmed zero refund", () => {
    expect(getNatoriResultFinancials(project({ amount: null, paidAmount: undefined })).net).toBeNull();
    expect(getNatoriResultFinancials(project({ refunds: undefined })).net).toBeNull();
    expect(getNatoriResultFinancials(project()).net).toBe(12000);
    expect(getNatoriResultFinancials(project({ refunds: null }))).toMatchObject({ gross: 12000, refunded: null, net: null, state: "unavailable" });
    expect(summarizeNatoriResults([project({ refunds: null })], new Date("2026-10-02"))).toMatchObject({ totalAmount: 12000, totalRefundedAmount: null, totalNetAmount: null });
  });
  it("retains confirmed refunds but keeps net unknown when a mapped original gross is missing", () => {
    const unknown = project({ id: "unknown", amount: null, paidAmount: undefined,
      refunds: { available: true, originalMapped: true, confirmedAmount: 3000, pendingCount: 0, reviewCount: 0 } });
    const known = project({ id: "known", refunds: { available: true, originalMapped: true, confirmedAmount: 2000, pendingCount: 0, reviewCount: 0 } });
    const before = JSON.stringify([unknown, known]);
    expect(getNatoriResultFinancials(unknown)).toMatchObject({ gross: null, refunded: 3000, net: null });
    expect(getNatoriRefundStatusText(unknown)).toBe("確定返金あり（元の入金額は未確認）");
    const summary = summarizeNatoriResults([unknown, known], new Date("2026-10-02"));
    expect(summary).toMatchObject({ totalAmount: 12000, totalRefundedAmount: 5000, totalNetAmount: null,
      thisYearRefundedAmount: 5000, thisYearNetAmount: null, undecidedAmountCount: 1 });
    expect(summary.monthly[0]).toMatchObject({ amount: 12000, refundedAmount: 5000, netAmount: null });
    expect(summary.byType[0]).toMatchObject({ amount: 12000, refundedAmount: 5000, netAmount: null });
    const rows = buildNatoriResultsCsv([unknown, known]).slice(1).trimEnd().split("\r\n").slice(1).map(line => line.split(","));
    expect(rows.find(row => row[6] === "3000")?.[7]).toBe("");
    expect(rows.find(row => row[6] === "2000")?.[7]).toBe("10000");
    expect(JSON.stringify([unknown, known])).toBe(before);
  });
  it("matches CSV totals while preserving gross column position and completed-result scope", () => {
    const projects = [project({ id: "partial", refunds: { available: true, originalMapped: true, confirmedAmount: 3000, pendingCount: 1, reviewCount: 0 } }),
      project({ id: "full", refunds: { available: true, originalMapped: true, confirmedAmount: 12000, pendingCount: 0, reviewCount: 0 } }),
      project({ id: "active", status: "rough", refunds: { available: true, originalMapped: true, confirmedAmount: 12000, pendingCount: 0, reviewCount: 0 } })];
    const summary = summarizeNatoriResults(projects, new Date("2026-10-02"));
    const lines = buildNatoriResultsCsv(projects).slice(1).trimEnd().split("\r\n");
    const rows = lines.slice(1).map(line => line.split(","));
    expect(summary).toMatchObject({ totalCount: 2, totalAmount: 24000, totalRefundedAmount: 15000, totalNetAmount: 9000,
      refundPendingCount: 1, thisYearRefundedAmount: 15000, thisYearNetAmount: 9000 });
    expect(summary.monthly[0]).toMatchObject({ amount: 24000, refundedAmount: 15000, netAmount: 9000 });
    expect(summary.byType[0]).toMatchObject({ amount: 24000, refundedAmount: 15000, netAmount: 9000 });
    expect(rows.reduce((sum, row) => sum + Number(row[4]), 0)).toBe(summary.totalAmount);
    expect(rows.reduce((sum, row) => sum + Number(row[6]), 0)).toBe(summary.totalRefundedAmount);
    expect(rows.reduce((sum, row) => sum + Number(row[7]), 0)).toBe(summary.totalNetAmount);
    expect(lines[0]).toContain("確定返金額(円),純入金額(円)");
  });
  it("leaves legacy unverified refund/net CSV cells blank and aggregate unknown", () => {
    const legacy = project({ refunds: { available: true, originalMapped: false, confirmedAmount: null, pendingCount: 0, reviewCount: 1 } });
    expect(getNatoriResultFinancials(legacy)).toMatchObject({ gross: 12000, refunded: null, net: null, state: "unverified", reviewCount: 1 });
    expect(getNatoriRefundStatusText(legacy)).toContain("過去の返金履歴未確認");
    const row = buildNatoriResultsCsv([legacy]).slice(1).split("\r\n")[1].split(",");
    expect(row[4]).toBe("12000");
    expect(row[6]).toBe("");
    expect(row[7]).toBe("");
    expect(row[8]).toContain("未確認");
    const summary = summarizeNatoriResults([legacy, project()], new Date("2026-10-02"));
    expect(summary).toMatchObject({ totalAmount: 24000, totalRefundedAmount: null, totalNetAmount: null, refundReviewCount: 1 });
    expect(summary.byType[0]).toMatchObject({ amount: 24000, refundedAmount: null, netAmount: null });
    expect(summary.monthly[0]).toMatchObject({ amount: 24000, refundedAmount: null, netAmount: null });
  });
});
