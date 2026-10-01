import { describe, expect, it } from "vitest";
import { assessLegacyPaymentLink, type LegacyPaymentLinkEvidence } from "../paymentLinkLegacyPolicy";

const evidence = (overrides: Partial<LegacyPaymentLinkEvidence> = {}): LegacyPaymentLinkEvidence => ({
  linkId: "plink_fixture", url: "https://buy.stripe.com/fixture", projectedStatus: "sent",
  providerLinkId: "plink_fixture", providerUrl: "https://buy.stripe.com/fixture", providerActive: true,
  paymentConfirmedAt: null, paymentReconciliation: "clear", closed: false, archived: false,
  successfulMail: [{ linkUrl: "https://buy.stripe.com/fixture", sentAt: "2026-09-01T10:00:00.000Z" }], ...overrides,
});
describe("legacy payment link dry-run reconciliation", () => {
  it("preserves the exact URL and last successful resend deadline, excluding other generations", () => {
    expect(assessLegacyPaymentLink(evidence({successfulMail: [
      {linkUrl: "https://buy.stripe.com/fixture", sentAt: "2026-09-01T10:00:00Z"},
      {linkUrl: "https://buy.stripe.com/fixture", sentAt: "2026-09-03T10:00:00Z"},
      {linkUrl: "https://buy.stripe.com/another", sentAt: "2026-09-30T10:00:00Z"},
    ]}))).toEqual({state: "active", linkId: "plink_fixture", url: "https://buy.stripe.com/fixture", deadline: "2026-09-10T10:00:00.000Z"});
  });
  it("does not reactivate a provider-inactive link even with a successful resend", () => {
    expect(assessLegacyPaymentLink(evidence({providerActive: false}))).toMatchObject({state: "inactive"});
  });
  it.each([{closed: true}, {archived: true}])("keeps terminal business state and requires an explicit external stop", terminal => {
    expect(assessLegacyPaymentLink(evidence(terminal))).toMatchObject({state: "stop_required"});
  });
  it("does not infer a deadline from creation time or missing mail", () => {
    expect(assessLegacyPaymentLink(evidence({successfulMail: []}))).toEqual({state: "needs_review", reason: "deadline_evidence_missing"});
  });
  it.each(["issuing", "void", "paid"])("does not silently heal conflicting %s state", projectedStatus => {
    expect(assessLegacyPaymentLink(evidence({projectedStatus})).state).toBe("needs_review");
  });
  it.each([{providerActive: null}, {providerLinkId: "different"}, {providerUrl: "https://buy.stripe.com/different"}])("requires exact provider identity evidence", mismatch => {
    expect(assessLegacyPaymentLink(evidence(mismatch))).toMatchObject({state: "needs_review", reason: "provider_identity_unverified"});
  });
  it.each([{paymentConfirmedAt: "2026-09-01T11:00:00Z"}, {paymentReconciliation: "received" as const}, {paymentReconciliation: "unknown" as const}])("never treats received or unresolved money as a new unpaid generation", money => {
    expect(assessLegacyPaymentLink(evidence(money)).state).toBe("needs_review");
  });
  it("does not discard a malformed matching mail timestamp", () => {
    expect(assessLegacyPaymentLink(evidence({successfulMail: [{linkUrl: "https://buy.stripe.com/fixture", sentAt: "invalid"}]}))).toMatchObject({state: "needs_review", reason: "deadline_evidence_invalid"});
  });
});
