// Tests for POST /api/account/delete
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/* ---------- Mocks ---------- */

const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminDeleteUser = vi.fn();

// Mock next/headers cookies()
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({
    toString: () => "",
  }),
}));

// Mock @supabase/supabase-js createClient (used for cookie-based auth)
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

// Mock supabaseAdmin
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn().mockReturnValue({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => mockAdminDeleteUser(...args),
      },
    },
  }),
}));

import { POST, GET } from "../route";

/* ---------- Helpers ---------- */

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest("https://example.com/api/account/delete", {
    method: "POST",
    headers: { "x-requested-with": "me-ish", ...headers },
  });
}

function chainReturning(result: { data: unknown; error: unknown }) {
  const chain = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
        if (prop === "single" || prop === "maybeSingle") {
          return vi.fn().mockResolvedValue(result);
        }
        return vi.fn().mockReturnValue(chain);
      },
    },
  );
  return chain;
}

/* ---------- Tests ---------- */

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("returns 403 without x-requested-with header", async () => {
    const req = new NextRequest("https://example.com/api/account/delete", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "not_authenticated" },
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 400 when user has pending payouts", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@test.com" } },
      error: null,
    });

    // sales check returns pending sales
    mockAdminFrom.mockReturnValue(
      chainReturning({ data: [{ id: "sale-1" }], error: null }),
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("未精算");
  });

  it("returns 200 on successful account deletion", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@test.com" } },
      error: null,
    });

    // All admin.from() calls succeed with empty results
    mockAdminFrom.mockReturnValue(
      chainReturning({ data: [], error: null }),
    );
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when auth delete fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@test.com" } },
      error: null,
    });

    mockAdminFrom.mockReturnValue(
      chainReturning({ data: [], error: null }),
    );
    mockAdminDeleteUser.mockResolvedValue({
      error: { message: "delete_failed" },
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/account/delete", () => {
  it("returns 405 Method Not Allowed", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
