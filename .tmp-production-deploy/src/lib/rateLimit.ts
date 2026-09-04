// src/lib/rateLimit.ts
// IP/キー単位のスライディングウィンドウ・レート制限。
//
// ストアは差し替え可能なインターフェース（RateLimitStore）にしてあり、既定は
// in-memory 実装。**in-memory の限界に注意**:
//   - serverless / 複数インスタンス環境ではインスタンスごとに独立したカウントに
//     なり、実効上限は「limit × インスタンス数」まで緩む。
//   - コールドスタート（デプロイ・スケールイン）でカウントはリセットされる。
// 厳密な制限が必要になったら setRateLimitStore() で外部ストア実装
// （例: Upstash Redis の固定ウィンドウ + INCR/EXPIRE）に差し替えること。
// 呼び出し側のシグネチャは async で統一済みなので差し替えで壊れない。
import { NextResponse } from "next/server";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/** レート制限ストアの差し替え用インターフェース */
export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/* ---------- 既定の in-memory 実装 ---------- */

type Entry = { timestamps: number[] };

class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, Entry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private ensureCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        // Remove entries with no recent timestamps (oldest window = 10 min)
        if (
          entry.timestamps.length === 0 ||
          entry.timestamps[entry.timestamps.length - 1] < now - 600_000
        ) {
          this.store.delete(key);
        }
      }
    }, 60_000);
    // Allow process to exit without waiting for this timer
    if (
      this.cleanupTimer &&
      typeof this.cleanupTimer === "object" &&
      "unref" in this.cleanupTimer
    ) {
      this.cleanupTimer.unref();
    }
  }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    this.ensureCleanup();
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Prune expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= limit) {
      const oldest = entry.timestamps[0];
      const retryAfterMs = oldest + windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
    }

    entry.timestamps.push(now);
    return { allowed: true };
  }

  reset() {
    this.store.clear();
  }
}

const defaultStore = new InMemoryRateLimitStore();
let activeStore: RateLimitStore = defaultStore;

/** ストアを差し替える（例: Upstash Redis 実装）。テストでのモック差し込みにも使う */
export function setRateLimitStore(store: RateLimitStore | null) {
  activeStore = store ?? defaultStore;
}

/**
 * Check rate limit for a given key.
 * @param key   Unique identifier (e.g. "contact:<ip>")
 * @param opts  limit: max requests, windowMs: sliding window in ms
 */
export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  return activeStore.hit(key, opts.limit, opts.windowMs);
}

/**
 * Extract client IP from request headers.
 *
 * 注意: x-forwarded-for は末端のクライアントが自由に付けられるヘッダーであり、
 * この実装は「プラットフォーム（Vercel 等）が edge で XFF を終端・上書きして
 * いる」前提でのみ安全。ヘッダーが素通しされる環境（自前 Node で直接受ける等）
 * では偽装によるレート制限回避が可能になるため、その場合はソケットの remote
 * address か、信頼できるプロキシ段数を明示した解決に置き換えること。
 */
export function getIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

/**
 * Return a 429 Too Many Requests response.
 */
export function rateLimitExceeded(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return new NextResponse(
    JSON.stringify({ ok: false, error: "rate_limit_exceeded" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}

/** Reset the default in-memory store and restore it as active (for testing) */
export function _resetRateLimitStore() {
  defaultStore.reset();
  activeStore = defaultStore;
}
