import { describe, expect, it, vi } from "vitest";
import { readUpstashConfig, UpstashRateLimitStore } from "@/lib/rateLimitUpstash";
import type { RateLimitStore } from "@/lib/rateLimit";

const fallback = (): RateLimitStore & { calls: number } => {
  const store = { calls: 0, async hit() { store.calls += 1; return { allowed: true as const }; } };
  return store;
};

describe("readUpstashConfig", () => {
  it("両方の変数が https で揃ったときだけ設定を返す", () => {
    expect(readUpstashConfig({})).toBeNull();
    expect(readUpstashConfig({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "" })).toBeNull();
    expect(readUpstashConfig({ UPSTASH_REDIS_REST_URL: "http://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" })).toBeNull();
    expect(readUpstashConfig({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io/", UPSTASH_REDIS_REST_TOKEN: "t" }))
      .toEqual({ url: "https://x.upstash.io", token: "t" });
  });
});

describe("UpstashRateLimitStore", () => {
  const config = { url: "https://x.upstash.io", token: "secret" };
  it("INCR の結果が上限以下なら許可し、超えたら窓の残り時間を返す", async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as unknown[][];
      expect(body[0][0]).toBe("INCR");
      expect(body[1]).toEqual(["PEXPIRE", body[0][1], "10000", "NX"]);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
      return new Response(JSON.stringify([{ result: 3 }, { result: 1 }]), { status: 200 });
    });
    const store = new UpstashRateLimitStore(config, fallback(), fetchImpl as unknown as typeof fetch);
    expect(await store.hit("k", 3, 10_000)).toEqual({ allowed: true });
    const over = vi.fn(async () => new Response(JSON.stringify([{ result: 4 }, { result: 0 }]), { status: 200 }));
    const limited = await new UpstashRateLimitStore(config, fallback(), over as unknown as typeof fetch).hit("k", 3, 10_000);
    expect(limited.allowed).toBe(false);
    if (!limited.allowed) expect(limited.retryAfterMs).toBeGreaterThan(0);
  });

  it("Upstash が応答しないときは in-memory の判定に委ねる", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = fallback();
    const failing = vi.fn(async () => new Response("", { status: 503 }));
    expect(await new UpstashRateLimitStore(config, down, failing as unknown as typeof fetch).hit("k", 3, 10_000)).toEqual({ allowed: true });
    expect(down.calls).toBe(1);
    const malformed = vi.fn(async () => new Response(JSON.stringify([{ error: "x" }]), { status: 200 }));
    await new UpstashRateLimitStore(config, down, malformed as unknown as typeof fetch).hit("k", 3, 10_000);
    expect(down.calls).toBe(2);
    spy.mockRestore();
  });
});
