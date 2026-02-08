// src/lib/rateLimit.ts
// In-memory sliding window rate limiter (no external deps)
import { NextResponse } from "next/server";

type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();

// Auto-cleanup every 60s
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove entries with no recent timestamps (oldest window = 10 min)
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - 600_000) {
        store.delete(key);
      }
    }
  }, 60_000);
  // Allow process to exit without waiting for this timer
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Check rate limit for a given key.
 * @param key   Unique identifier (e.g. "contact:<ip>")
 * @param opts  limit: max requests, windowMs: sliding window in ms
 */
export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= opts.limit) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + opts.windowMs - now;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}

/**
 * Extract client IP from request headers.
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

/** Reset the store (for testing) */
export function _resetRateLimitStore() {
  store.clear();
}
