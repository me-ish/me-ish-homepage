// src/lib/__tests__/helpers/mockSupabase.ts
// Shared Supabase query-builder chain mock for API route tests.

import { vi } from "vitest";

type ChainResult = {
  data: unknown;
  error: unknown;
  count?: number;
};

/**
 * Creates a chainable mock that mimics the Supabase PostgREST builder.
 * Every method returns `this` (the proxy), except terminal methods
 * (`single`, `maybeSingle`) which return the configured result.
 *
 * Usage:
 *   const chain = createMockChain({ data: [row], error: null });
 *   mockFrom.mockReturnValue(chain);
 */
export function createMockChain(result: ChainResult) {
  const terminal = vi.fn().mockResolvedValue(result);

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") return undefined; // prevent auto-await
      if (prop === "single" || prop === "maybeSingle") return terminal;
      // For `.select()`, `.eq()`, `.update()`, etc. → return the proxy itself
      return vi.fn().mockReturnValue(proxy);
    },
  };

  const proxy: Record<string, unknown> = new Proxy({}, handler);

  // Also make the proxy itself thenable for non-`.single()` terminal usage:
  // e.g. `const { data, error } = await supabase.from('x').select('*').eq(...)`
  // We need a special "await" path:
  const awaitableHandler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make it thenable — resolve to result
        return (resolve: (v: ChainResult) => void) => resolve(result);
      }
      if (prop === "single" || prop === "maybeSingle") return terminal;
      return vi.fn().mockReturnValue(awaitableProxy);
    },
  };

  const awaitableProxy: Record<string, unknown> = new Proxy({}, awaitableHandler);

  return awaitableProxy;
}

/**
 * Helper to create a mock Supabase client with `from()` and `auth`.
 */
export function createMockSupabaseClient(opts?: {
  user?: { id: string; email?: string } | null;
  fromChain?: ReturnType<typeof createMockChain>;
}) {
  const user = opts?.user ?? null;
  const chain = opts?.fromChain ?? createMockChain({ data: null, error: null });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "not_authenticated" },
      }),
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    from: vi.fn().mockReturnValue(chain),
  };
}
