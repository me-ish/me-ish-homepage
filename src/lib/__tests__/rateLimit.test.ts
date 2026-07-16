// src/lib/__tests__/rateLimit.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  getIpFromRequest,
  setRateLimitStore,
  _resetRateLimitStore,
  type RateLimitStore,
} from "@/lib/rateLimit";

beforeEach(() => {
  _resetRateLimitStore();
  vi.restoreAllMocks();
});

describe("checkRateLimit", () => {
  it("allows requests within limit", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(checkRateLimit("k1", { limit: 3, windowMs: 10_000 })).resolves.toEqual({
        allowed: true,
      });
    }
  });

  it("rejects when limit exceeded", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("k2", { limit: 3, windowMs: 10_000 });
    }
    const result = await checkRateLimit("k2", { limit: 3, windowMs: 10_000 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("allows again after window expires", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 3; i++) {
      await checkRateLimit("k3", { limit: 3, windowMs: 1_000 });
    }
    expect((await checkRateLimit("k3", { limit: 3, windowMs: 1_000 })).allowed).toBe(
      false
    );

    // Advance time past window
    vi.spyOn(Date, "now").mockReturnValue(now + 1_001);
    expect((await checkRateLimit("k3", { limit: 3, windowMs: 1_000 })).allowed).toBe(
      true
    );
  });

  it("keys are independent", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("a", { limit: 3, windowMs: 10_000 });
    }
    expect((await checkRateLimit("a", { limit: 3, windowMs: 10_000 })).allowed).toBe(
      false
    );
    expect((await checkRateLimit("b", { limit: 3, windowMs: 10_000 })).allowed).toBe(
      true
    );
  });
});

describe("setRateLimitStore", () => {
  it("外部ストア実装（例: Upstash Redis）へ差し替えられる", async () => {
    const hits: Array<[string, number, number]> = [];
    const customStore: RateLimitStore = {
      async hit(key, limit, windowMs) {
        hits.push([key, limit, windowMs]);
        return { allowed: false, retryAfterMs: 1234 };
      },
    };
    setRateLimitStore(customStore);

    const result = await checkRateLimit("custom", { limit: 5, windowMs: 60_000 });
    expect(result).toEqual({ allowed: false, retryAfterMs: 1234 });
    expect(hits).toEqual([["custom", 5, 60_000]]);

    // 既定の in-memory に戻す
    setRateLimitStore(null);
    expect((await checkRateLimit("custom", { limit: 5, windowMs: 60_000 })).allowed).toBe(
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
