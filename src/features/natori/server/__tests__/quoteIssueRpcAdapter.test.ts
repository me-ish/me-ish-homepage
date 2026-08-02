import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}));

import {
  issueNatoriQuoteViaRpc,
  readIssueNatoriQuoteRpcResult,
  validateIssueNatoriQuoteRpcInput,
} from "@/features/natori/server/quoteIssueRpcAdapter";

const PROJECT_ID = "60000000-0000-4000-8000-000000000001";
const OWNER_ID = "60000000-0000-4000-8000-000000000002";
const PRESET_ID = "60000000-0000-4000-8000-000000000003";
const QUOTE_ID = "60000000-0000-4000-8000-000000000004";

function validInput() {
  return {
    ownerId: OWNER_ID,
    projectId: PROJECT_ID,
    title: "一枚絵制作",
    clientName: "依頼者",
    toEmail: "client@example.com",
    subject: "正式見積のご案内",
    bodySnapshot: "正式見積の本文です。",
    tokenHash: "a".repeat(64),
    expiresAt: "2099-08-02T00:00:00.000Z",
    idempotencyKey: `quote:${PROJECT_ID}:attempt-1`,
    requestSnapshot: null,
    pricingSnapshot: {
      schemaVersion: 1 as const,
      mappingVersion: "natori-pricing-mapping-v1",
      pricingConfigVersion: 1,
      pricingPresetId: PRESET_ID,
      pricingPresetNameSnapshot: "標準料金",
      projectTypeSnapshot: "illustration" as const,
      items: [
        {
          id: "base:illustration",
          presetItemId: "illustration",
          kind: "base" as const,
          labelSnapshot: "一枚絵",
          quantity: 1,
          unitAmount: 10000,
          amount: 10000,
          automatic: true,
          sourceFields: ["project.type"],
          ruleId: "base:illustration",
          note: null,
        },
      ],
      reviewItems: [],
      reviewResolutions: [],
      subtotalBeforePercentage: 10000,
      total: 10000,
      currency: "JPY" as const,
      issuedAt: "2026-08-02T00:00:00.000Z",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateIssueNatoriQuoteRpcInput", () => {
  it("accepts a complete issue request", () => {
    expect(validateIssueNatoriQuoteRpcInput(validInput())).toEqual({
      success: true,
      data: validInput(),
    });
  });

  it.each([
    ["missing owner", (input: ReturnType<typeof validInput>) => ({ ...input, ownerId: "" }), "quote_identity_invalid"],
    ["missing token", (input: ReturnType<typeof validInput>) => ({ ...input, tokenHash: "" }), "quote_token_invalid"],
    ["expired timestamp", (input: ReturnType<typeof validInput>) => ({ ...input, expiresAt: "2020-01-01T00:00:00.000Z" }), "quote_expiry_invalid"],
    ["bad total", (input: ReturnType<typeof validInput>) => ({ ...input, pricingSnapshot: { ...input.pricingSnapshot, total: 12000 } }), "total_mismatch"],
  ])("rejects %s", (_label, mutate, reason) => {
    expect(validateIssueNatoriQuoteRpcInput(mutate(validInput()))).toEqual({
      success: false,
      reason,
    });
  });
});

describe("readIssueNatoriQuoteRpcResult", () => {
  it("accepts exactly one strict success row", () => {
    expect(
      readIssueNatoriQuoteRpcResult([
        { quote_id: QUOTE_ID, version: 2, reused: true },
      ]),
    ).toEqual({ quoteId: QUOTE_ID, version: 2, reused: true });
  });

  it.each([
    null,
    [],
    [{ quote_id: "not-a-uuid", version: 1, reused: false }],
    [{ quote_id: QUOTE_ID, version: 0, reused: false }],
    [{ quote_id: QUOTE_ID, version: 1, reused: false, extra: true }],
  ])("rejects malformed RPC data %#", (data) => {
    expect(readIssueNatoriQuoteRpcResult(data)).toBeNull();
  });
});

describe("issueNatoriQuoteViaRpc", () => {
  it("calls natori_issue_quote_v1 with the exact immutable envelope", async () => {
    mockRpc.mockResolvedValue({
      data: [{ quote_id: QUOTE_ID, version: 1, reused: false }],
      error: null,
    });
    const input = validInput();

    await expect(issueNatoriQuoteViaRpc(input)).resolves.toEqual({
      kind: "issued",
      quoteId: QUOTE_ID,
      version: 1,
    });
    expect(mockRpc).toHaveBeenCalledWith("natori_issue_quote_v1", {
      p_user_id: OWNER_ID,
      p_project_id: PROJECT_ID,
      p_title: input.title,
      p_client_name: input.clientName,
      p_to_email: input.toEmail,
      p_amount: 10000,
      p_subject: input.subject,
      p_body_snapshot: input.bodySnapshot,
      p_token_hash: input.tokenHash,
      p_expires_at: input.expiresAt,
      p_request_snapshot: null,
      p_pricing_snapshot: input.pricingSnapshot,
      p_idempotency_key: input.idempotencyKey,
    });
  });

  it("returns reused for an idempotent replay", async () => {
    mockRpc.mockResolvedValue({
      data: [{ quote_id: QUOTE_ID, version: 3, reused: true }],
      error: null,
    });
    await expect(issueNatoriQuoteViaRpc(validInput())).resolves.toEqual({
      kind: "reused",
      quoteId: QUOTE_ID,
      version: 3,
    });
  });

  it("maps known database guards to rejected", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "request_snapshot_mismatch" },
      status: 400,
    });
    await expect(issueNatoriQuoteViaRpc(validInput())).resolves.toEqual({
      kind: "rejected",
      reason: "request_snapshot_mismatch",
    });
  });

  it("treats malformed success data and transport failures as db-error", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ version: 1 }], error: null });
    await expect(issueNatoriQuoteViaRpc(validInput())).resolves.toEqual({
      kind: "db-error",
    });

    mockRpc.mockRejectedValueOnce(new Error("network failure"));
    await expect(issueNatoriQuoteViaRpc(validInput())).resolves.toEqual({
      kind: "db-error",
    });
  });

  it("does not call the database for an invalid local payload", async () => {
    const input = validInput();
    input.idempotencyKey = "short";
    await expect(issueNatoriQuoteViaRpc(input)).resolves.toEqual({
      kind: "rejected",
      reason: "idempotency_key_invalid",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
