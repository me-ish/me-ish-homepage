import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { NatoriProject } from "../../types/projects";

vi.mock("server-only", () => ({}));
const { rpc, admin, dispatch } = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: admin }));
vi.mock("../trustedNatoriOwner", () => ({ resolveTrustedNatoriOwnerId: () => ({ kind: "ok", ownerId: "owner-fixture" }) }));
vi.mock("../acceptanceNotifications", () => ({ dispatchAcceptanceNotifications: dispatch }));

import { loadNatoriRefundSummaries } from "../refundSummaryService";
import { receiveNatoriPaymentEvent, refundLedgerEnabled, refundLedgerReadEnabled } from "../paymentEventService";
import { buildNatoriResultsCsv, getNatoriResultFinancials } from "../../lib/results";

const projectId = "aaaabbbb-cccc-4ddd-8eee-ffffffffffff";
const quoteId = "11112222-3333-4444-8555-666677778888";
const event = { id: "evt_synthetic", type: "checkout.session.completed", livemode: false,
  data: { object: { id: "cs_synthetic", payment_status: "paid", amount_total: 12000, currency: "jpy",
    payment_intent: { id: "pi_synthetic", latest_charge: "ch_synthetic" }, metadata: { projectId, quoteId } } } } as unknown as Stripe.Event;
const summary = { available: true as const, originalMapped: true, confirmedAmount: 12000, pendingCount: 1, reviewCount: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NATORI_REFUND_LEDGER_ENABLED", "0");
  vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED", "0");
  vi.stubEnv("NATORI_STRIPE_MODE", "test");
  admin.mockReturnValue({ rpc });
  dispatch.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("refund writer / projection rollback", () => {
  it("does not query the ledger or manufacture zero refunds with both gates off", async () => {
    expect(refundLedgerEnabled()).toBe(false);
    expect(refundLedgerReadEnabled()).toBe(false);
    expect(await loadNatoriRefundSummaries("owner-fixture", [projectId])).toBeUndefined();
    expect(admin).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    const project = { amount: 12000, paidAmount: 12000, refunds: undefined } as NatoriProject;
    expect(getNatoriResultFinancials(project)).toMatchObject({ refunded: null, net: null, state: "unavailable" });
  });

  it("keeps confirmed full refunds and CSV financial facts visible with only the read gate on", async () => {
    vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED", "1");
    rpc.mockResolvedValue({ data: [{ project_id: projectId, summary }], error: null });
    const map = await loadNatoriRefundSummaries("owner-fixture", [projectId]);
    expect(refundLedgerEnabled()).toBe(false);
    expect(refundLedgerReadEnabled()).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_refund_summaries_v1", { p_owner_id: "owner-fixture", p_project_ids: [projectId] });
    const project: NatoriProject = { id: projectId, title: "Synthetic", clientName: "Synthetic", amount: 12000, paidAmount: 12000,
      paidAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-01T00:00:00Z", status: "completed", dueDate: "2026-10-01",
      type: "illustration", nextAction: "Completed", tasks: [], refunds: map?.get(projectId) };
    const before = JSON.stringify(project);
    expect(getNatoriResultFinancials(project)).toMatchObject({ gross: 12000, refunded: 12000, net: 0, state: "full", pendingCount: 1 });
    expect(buildNatoriResultsCsv([project]).split("\r\n")[1].split(",").slice(4, 8)).toEqual(["12000", "対応完了", "12000", "0"]);
    expect(JSON.stringify(project)).toBe(before);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("enables reading with the existing writer flag without requiring a new setting", async () => {
    vi.stubEnv("NATORI_REFUND_LEDGER_ENABLED", "1");
    rpc.mockResolvedValue({ data: [{ project_id: projectId, summary }], error: null });
    expect(refundLedgerReadEnabled()).toBe(true);
    expect((await loadNatoriRefundSummaries("owner-fixture", [projectId]))?.get(projectId)).toEqual(summary);
  });

  it("uses the exact legacy checkout request and completion v1 while read-only rollback remains enabled", async () => {
    vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED", "1");
    rpc.mockResolvedValueOnce({ data: [{ result: "claimed", generation: 2, notification_ids: [] }], error: null })
      .mockResolvedValueOnce({ data: [{ result: "completed", notification_ids: [] }], error: null });
    expect(await receiveNatoriPaymentEvent(event)).toEqual({ status: 200, result: "completed" });
    expect(rpc.mock.calls[0][1].p_request).toEqual({ sessionId: "cs_synthetic", projectId, quoteId,
      paymentStatus: "paid", currency: "jpy", amount: 12000, paymentIntentId: "pi_synthetic" });
    expect(rpc.mock.calls[1][0]).toBe("natori_stripe_event_complete_v1");
  });

  it("enriches the checkout charge and uses completion v2 only when the writer is enabled", async () => {
    vi.stubEnv("NATORI_REFUND_LEDGER_ENABLED", "1");
    rpc.mockResolvedValueOnce({ data: [{ result: "claimed", generation: 2, notification_ids: [] }], error: null })
      .mockResolvedValueOnce({ data: [{ result: "completed", notification_ids: [] }], error: null });
    expect(await receiveNatoriPaymentEvent(event)).toEqual({ status: 200, result: "completed" });
    expect(rpc.mock.calls[0][1].p_request).toMatchObject({ paymentIntentId: "pi_synthetic", chargeId: "ch_synthetic" });
    expect(rpc.mock.calls[1][0]).toBe("natori_stripe_event_complete_v2");
  });
});
