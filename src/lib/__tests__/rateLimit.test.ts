// src/lib/__tests__/rateLimit.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  getIpFromRequest,
  _resetRateLimitStore,
} from "@/lib/rateLimit";

beforeEach(() => {
  _resetRateLimitStore();
  vi.restoreAllMocks();
});

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k1", { limit: 3, windowMs: 10_000 })).toEqual({
        allowed: true,
      });
    }
  });

  it("rejects when limit exceeded", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("k2", { limit: 3, windowMs: 10_000 });
    }
    const result = checkRateLimit("k2", { limit: 3, windowMs: 10_000 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("allows again after window expires", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 3; i++) {
      checkRateLimit("k3", { limit: 3, windowMs: 1_000 });
    }
    expect(checkRateLimit("k3", { limit: 3, windowMs: 1_000 }).allowed).toBe(
      false
    );

    // Advance time past window
    vi.spyOn(Date, "now").mockReturnValue(now + 1_001);
    expect(checkRateLimit("k3", { limit: 3, windowMs: 1_000 }).allowed).toBe(
      true
    );
  });

  it("keys are independent", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("a", { limit: 3, windowMs: 10_000 });
    }
    expect(checkRateLimit("a", { limit: 3, windowMs: 10_000 }).allowed).toBe(
      false
    );
    expect(checkRateLimit("b", { limit: 3, windowMs: 10_000 }).allowed).toBe(
      true
    );
  });
});

describe("getIpFromRequest", () => {
  it("extracts from x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getIpFromRequest(req)).toBe("1.2.3.4");
  });

  it("extracts from x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getIpFromRequest(req)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no headers", () => {
    const req = new Request("http://localhost");
    expect(getIpFromRequest(req)).toBe("unknown");
  });
});
