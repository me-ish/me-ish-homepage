// Tests for POST /api/aura/draft
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ---------- Mocks ---------- */

vi.mock("@/lib/auth/csrf", () => ({
  checkCsrf: (req: Request) => {
    if (req.headers.get("x-requested-with") !== "me-ish") {
      const { NextResponse } = require("next/server");
      return NextResponse.json({ ok: false, error: "csrf_rejected" }, { status: 403 });
    }
    return null;
  },
}));

const mockInsertDraft = vi.fn();
vi.mock("@/lib/aura/aura.db", () => ({
  insertDraft: (...args: unknown[]) => mockInsertDraft(...args),
}));

vi.mock("@/lib/aura/requireAuraAccess", () => ({
  buildAuraSessionCookie: vi.fn().mockReturnValue("aura_session=test; Path=/; HttpOnly"),
}));

import { POST } from "../route";

/* ---------- Helpers ---------- */

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/aura/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-requested-with": "me-ish",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/* ---------- Tests ---------- */

describe("POST /api/aura/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 without CSRF header", async () => {
    const req = new Request("https://example.com/api/aura/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("email_required");
  });

  it("returns 400 when email is not a string", async () => {
    const res = await POST(makeReq({ email: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with requestId on success", async () => {
    mockInsertDraft.mockResolvedValue({ id: "draft-123" });

    const res = await POST(makeReq({ email: "test@example.com", name: "Test" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.requestId).toBe("draft-123");
  });

  it("sets session cookie on success", async () => {
    mockInsertDraft.mockResolvedValue({ id: "draft-456" });

    const res = await POST(makeReq({ email: "test@example.com" }));
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("aura_session");
  });

  it("returns 500 when insertDraft throws", async () => {
    mockInsertDraft.mockRejectedValue(new Error("db_error"));

    const res = await POST(makeReq({ email: "test@example.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
