// src/lib/rateLimitUpstash.ts
// Upstash Redis（REST）を使うレート制限ストア。固定ウィンドウの INCR + PEXPIRE。
//
// serverless では関数インスタンスごとにメモリが分かれるため、in-memory の上限は
// 「limit × インスタンス数」まで緩む。UPSTASH_REDIS_REST_URL と
// UPSTASH_REDIS_REST_TOKEN が設定されている環境だけ、このストアに切り替わる
// （rateLimit.ts 側で判定）。SDK は使わず fetch だけで呼ぶ。
//
// 失敗時（ネットワーク断・5xx）は fail-open にせず、in-memory の判定に委ねる
// （呼び出し側が fallback を渡す）。レート制限は防波堤であって認可ではないので、
// 外部ストアが落ちた瞬間に全受付を止めない。
import type { RateLimitResult, RateLimitStore } from "./rateLimit";

type UpstashConfig = { url: string; token: string };

export function readUpstashConfig(env: Record<string, string | undefined> = process.env): UpstashConfig | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/u, ""), token };
}

/** Redis のキー。英数字以外は壊れないよう encodeURIComponent しておく。 */
function redisKey(key: string, windowMs: number): string {
  // 固定ウィンドウ: 同じ窓の中では同じキーになる
  const bucket = Math.floor(Date.now() / windowMs);
  return `rl:${encodeURIComponent(key)}:${bucket}`;
}

export class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly config: UpstashConfig,
    private readonly fallback: RateLimitStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const name = redisKey(key, windowMs);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const response = await this.fetchImpl(`${this.config.url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", name], ["PEXPIRE", name, String(windowMs), "NX"]]),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!response.ok) throw new Error(`upstash_${response.status}`);
      const data = (await response.json()) as Array<{ result?: unknown; error?: unknown }>;
      const count = data?.[0]?.result;
      if (typeof count !== "number" || !Number.isFinite(count)) throw new Error("upstash_malformed");
      if (count > limit) {
        const elapsed = Date.now() % windowMs;
        return { allowed: false, retryAfterMs: Math.max(windowMs - elapsed, 1) };
      }
      return { allowed: true };
    } catch (error) {
      console.error("[rate-limit] upstash unavailable, using in-memory", error instanceof Error ? error.message : "unknown");
      return this.fallback.hit(key, limit, windowMs);
    }
  }
}
