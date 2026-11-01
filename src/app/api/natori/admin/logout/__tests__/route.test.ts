import { describe, expect, it, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock("@/lib/supabaseServer", () => ({ supabaseServer: async () => ({ auth: { signOut } }) }));

import { POST } from "../route";

describe("POST /api/natori/admin/logout", () => {
  it("CSRF ヘッダーが無ければ 403", async () => {
    const response = await POST(new Request("https://example.com/api/natori/admin/logout", { method: "POST" }));
    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("共有鍵 Cookie を消し、Supabase のセッションも終える", async () => {
    const response = await POST(new Request("https://example.com/api/natori/admin/logout", { method: "POST", headers: { "x-requested-with": "me-ish" } }));
    expect(response.status).toBe(200);
    expect(signOut).toHaveBeenCalledTimes(1);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("natori_dashboard_key=;");
    expect(cookie.toLowerCase()).toContain("max-age=0");
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
