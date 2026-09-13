import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitStore } from "@/lib/rateLimit";

vi.mock("server-only", () => ({}));

const { mockAccept, mockCompletionMail } = vi.hoisted(() => ({
  mockAccept: vi.fn(),
  mockCompletionMail: vi.fn(),
}));

vi.mock("@/features/natori/server/deliveryService", () => ({
  acceptNatoriDelivery: (...args: unknown[]) => mockAccept(...args),
}));

vi.mock("@/features/natori/server/deliveryCompletionMailService", () => ({
  sendNatoriDeliveryCompletionMail: (...args: unknown[]) => mockCompletionMail(...args),
}));

import { POST } from "../route";

const URL_ = "https://example.com/api/natori/delivery/accept";
const CSRF = { "x-requested-with": "me-ish", "content-type": "application/json" };

function makeReq(body: unknown, headers: Record<string, string> = CSRF) {
  return new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStore();
  mockAccept.mockResolvedValue({ kind: "ok" });
  mockCompletionMail.mockResolvedValue(true);
});

describe("POST /api/natori/delivery/accept", () => {
  it("rejects a request without the CSRF header", async () => {
    const response = await POST(
      makeReq({ token: "t".repeat(43) }, { "content-type": "application/json" }),
    );

    expect(response.status).toBe(403);
    expect(mockAccept).not.toHaveBeenCalled();
    expect(mockCompletionMail).not.toHaveBeenCalled();
  });

  it("requires a token", async () => {
    const response = await POST(makeReq({}));

    expect(response.status).toBe(400);
    expect(mockAccept).not.toHaveBeenCalled();
    expect(mockCompletionMail).not.toHaveBeenCalled();
  });

  it("sends the completion mail only for the first acceptance", async () => {
    const token = "t".repeat(43);
    const accepted = await POST(makeReq({ token }));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ ok: true });
    expect(mockCompletionMail).toHaveBeenCalledTimes(1);
    expect(mockCompletionMail).toHaveBeenCalledWith(token);

    mockAccept.mockResolvedValueOnce({ kind: "already-accepted" });
    const retry = await POST(makeReq({ token }));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ ok: true, already: true });
    expect(mockCompletionMail).toHaveBeenCalledTimes(1);
  });

  it("keeps delivery acceptance successful even if the completion mail fails", async () => {
    mockCompletionMail.mockResolvedValueOnce(false);
    const response = await POST(makeReq({ token: "t".repeat(43) }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("preserves the public error contract", async () => {
    mockAccept.mockResolvedValueOnce({ kind: "not-found" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(404);

    mockAccept.mockResolvedValueOnce({ kind: "expired" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(410);

    mockAccept.mockResolvedValueOnce({ kind: "db-error" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(500);
    expect(mockCompletionMail).not.toHaveBeenCalled();
  });
});
