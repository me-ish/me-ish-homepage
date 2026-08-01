import { describe, expect, it } from "vitest";
import { validateNatoriQuoteIssuePayloadV1 } from "@/features/natori/lib/quoteSnapshot";

function validPayload() {
  return {
    projectId: "60000000-0000-4000-8000-000000000001",
    toEmail: "client@example.com",
    subject: "正式見積のご案内",
    bodySnapshot: "正式見積の本文です。",
    idempotencyKey: "quote:60000000-0000-4000-8000-000000000001:attempt-1",
    requestSnapshot: null,
    pricingSnapshot: {
      schemaVersion: 1,
      mappingVersion: "natori-pricing-mapping-v1",
      pricingConfigVersion: 1,
      pricingPresetId: "60000000-0000-4000-8000-000000000002",
      pricingPresetNameSnapshot: "標準料金",
      projectTypeSnapshot: "illustration",
      items: [
        {
          id: "base:illustration",
          presetItemId: "illustration",
          kind: "base",
          labelSnapshot: "一枚絵",
          quantity: 1,
          unitAmount: 10000,
          amount: 10000,
          automatic: true,
          sourceFields: ["project.type"],
          ruleId: "base:illustration",
          note: null,
        },
        {
          id: "manual:adjustment",
          presetItemId: null,
          kind: "manual",
          labelSnapshot: "個別調整",
          quantity: 2,
          unitAmount: 1000,
          amount: 2000,
          automatic: false,
          sourceFields: ["admin.manual"],
          ruleId: null,
          note: "管理者確認済み",
        },
      ],
      reviewResolutions: [
        {
          code: "publication_policy_requires_review",
          ruleId: "publication:delayed",
          resolution: "accepted",
          note: "公開予定日を確認済み",
          resolvedAt: "2026-08-02T00:00:00.000Z",
        },
      ],
      subtotalBeforePercentage: 12000,
      total: 12000,
      currency: "JPY",
      issuedAt: "2026-08-02T00:00:00.000Z",
    },
  };
}

describe("validateNatoriQuoteIssuePayloadV1", () => {
  it("accepts a valid legacy quote snapshot", () => {
    const result = validateNatoriQuoteIssuePayloadV1(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricingSnapshot.total).toBe(12000);
      expect(result.data.requestSnapshot).toBeNull();
    }
  });

  it("rejects an item whose amount differs from unitAmount times quantity", () => {
    const payload = validPayload();
    payload.pricingSnapshot.items[1].amount = 2500;
    payload.pricingSnapshot.total = 12500;

    const result = validateNatoriQuoteIssuePayloadV1(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.code)).toContain("item_amount_mismatch");
    }
  });

  it("rejects a total that differs from the item sum", () => {
    const payload = validPayload();
    payload.pricingSnapshot.total = 13000;

    const result = validateNatoriQuoteIssuePayloadV1(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.code)).toContain("total_mismatch");
    }
  });

  it("rejects undecided project type", () => {
    const payload = validPayload();
    payload.pricingSnapshot.projectTypeSnapshot = "undecided";

    const result = validateNatoriQuoteIssuePayloadV1(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.code)).toContain("project_type_invalid");
    }
  });

  it("rejects malformed idempotency keys", () => {
    const payload = validPayload();
    payload.idempotencyKey = "short";

    const result = validateNatoriQuoteIssuePayloadV1(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.code)).toContain("idempotency_key_invalid");
    }
  });

  it("rejects malformed structured request snapshots", () => {
    const payload = validPayload();
    payload.requestSnapshot = { schemaVersion: 1 } as never;

    const result = validateNatoriQuoteIssuePayloadV1(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.code)).toContain("request_snapshot_invalid");
    }
  });
});
