import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitStore } from "@/lib/rateLimit";

vi.mock("server-only", () => ({}));

const { mockAccept } = vi.hoisted(() => ({ mockAccept: vi.fn() }));

vi.mock("@/features/natori/server/deliveryService", () => ({
  acceptNatoriDelivery: (...args: unknown[]) => mockAccept(...args),
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
});

describe("POST /api/natori/delivery/accept", () => {
  it("rejects a request without the CSRF header", async () => {
    const response = await POST(
      makeReq({ token: "t".repeat(43) }, { "content-type": "application/json" }),
    );

    expect(response.status).toBe(403);
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("requires a token", async () => {
    const response = await POST(makeReq({}));

    expect(response.status).toBe(400);
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("returns success for the first acceptance and an idempotent retry", async () => {
    const accepted = await POST(makeReq({ token: "t".repeat(43) }));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ ok: true });

    mockAccept.mockResolvedValueOnce({ kind: "already-accepted" });
    const retry = await POST(makeReq({ token: "t".repeat(43) }));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ ok: true, already: true });
  });

  it("preserves the public error contract", async () => {
    mockAccept.mockResolvedValueOnce({ kind: "not-found" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(404);

    mockAccept.mockResolvedValueOnce({ kind: "expired" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(410);

    mockAccept.mockResolvedValueOnce({ kind: "db-error" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(500);
  });
});
