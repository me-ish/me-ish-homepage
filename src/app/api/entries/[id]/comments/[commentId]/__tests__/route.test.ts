// Tests for DELETE /api/entries/[id]/comments/[commentId]
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/* ---------- Mocks ---------- */

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

vi.mock("@/lib/auth/csrf", () => ({
  checkCsrf: (req: Request) => {
    if (req.headers.get("x-requested-with") !== "me-ish") {
      const { NextResponse } = require("next/server");
      return NextResponse.json({ ok: false, error: "csrf_rejected" }, { status: 403 });
    }
    return null;
  },
}));

import { DELETE } from "../route";

/* ---------- Helpers ---------- */

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest("https://example.com/api/entries/1/comments/c1", {
    method: "DELETE",
    headers: { "x-requested-with": "me-ish", ...headers },
  });
}

function makeParams(id = "1", commentId = "c1") {
  return { params: Promise.resolve({ id, commentId }) };
}

function chainReturning(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const chain = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return undefined;
        if (prop === "single" || prop === "maybeSingle") return single;
        return vi.fn().mockReturnValue(chain);
      },
    },
  );
  return chain;
}

/* ---------- Tests ---------- */

describe("DELETE /api/entries/[id]/comments/[commentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 without CSRF header", async () => {
    const req = new NextRequest("https://example.com/api/entries/1/comments/c1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when comment is not found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockFrom.mockReturnValue(
      chainReturning({ data: null, error: { message: "not found" } }),
    );

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is neither comment owner nor entry owner", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-outsider" } },
    });

    // First from() call: comment lookup
    const commentChain = chainReturning({
      data: { user_id: "user-a", entry_id: 1, deleted_at: null },
      error: null,
    });
    // Second from() call: entry lookup
    const entryChain = chainReturning({
      data: { user_id: "user-b" },
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? commentChain : entryChain;
    });

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Permission denied");
  });

  it("returns 200 when comment owner deletes", async () => {
    const userId = "user-a";
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const commentChain = chainReturning({
      data: { user_id: userId, entry_id: 1, deleted_at: null },
      error: null,
    });
    const entryChain = chainReturning({
      data: { user_id: "entry-owner" },
      error: null,
    });
    // update chain (3rd call)
    const updateResult = { data: null, error: null };
    const updateChain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(updateResult);
          return vi.fn().mockReturnValue(updateChain);
        },
      },
    );

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return commentChain;
      if (callCount === 2) return entryChain;
      return updateChain;
    });

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 400 when comment is already deleted", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
    });

    mockFrom.mockReturnValue(
      chainReturning({
        data: { user_id: "user-a", entry_id: 1, deleted_at: "2025-01-01" },
        error: null,
      }),
    );

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Comment already deleted");
  });
});
