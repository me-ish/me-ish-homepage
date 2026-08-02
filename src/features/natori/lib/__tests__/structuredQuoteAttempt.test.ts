import { describe, expect, it } from "vitest";
import {
  createStructuredQuoteOperationAttempt,
  validateStructuredQuoteDeliveryAttempt,
} from "@/features/natori/lib/structuredQuoteAttempt";

const UUIDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

describe("structured quote operation attempt", () => {
  it("creates one stable operation envelope with token, expiry and idempotency key", () => {
    let index = 0;
    const attempt = createStructuredQuoteOperationAttempt(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      {
        now: new Date("2026-08-02T00:00:00.000Z"),
        randomUUID: () => UUIDS[index++]!,
      },
    );

    expect(attempt).toEqual({
      idempotencyKey:
        "quote:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:33333333-3333-4333-8333-333333333333",
      acceptToken:
        "1111111111114111811111111111111122222222222242228222222222222222",
      issuedAt: "2026-08-02T00:00:00.000Z",
      expiresAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("accepts the same fixed delivery attempt on repeated validation", () => {
    const value = {
      acceptToken:
        "1111111111114111811111111111111122222222222242228222222222222222",
      expiresAt: "2026-09-01T00:00:00.000Z",
    };
    const now = Date.parse("2026-08-02T00:00:00.000Z");

    expect(validateStructuredQuoteDeliveryAttempt(value, now)).toEqual({
      success: true,
      data: value,
    });
    expect(validateStructuredQuoteDeliveryAttempt(value, now)).toEqual({
      success: true,
      data: value,
    });
  });

  it("rejects malformed tokens and unreasonable expiry windows", () => {
    const now = Date.parse("2026-08-02T00:00:00.000Z");

    expect(
      validateStructuredQuoteDeliveryAttempt(
        { acceptToken: "short", expiresAt: "2026-09-01T00:00:00.000Z" },
        now,
      ),
    ).toEqual({ success: false });

    expect(
      validateStructuredQuoteDeliveryAttempt(
        {
          acceptToken: "a".repeat(64),
          expiresAt: "2026-10-15T00:00:00.000Z",
        },
        now,
      ),
    ).toEqual({ success: false });
  });
});
