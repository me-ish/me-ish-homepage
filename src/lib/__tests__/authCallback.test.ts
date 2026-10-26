import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: m.exchange } }),
}));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => {
  m.exchange.mockReset();
  m.exchange.mockResolvedValue({ error: null });
});
describe("OAuth callback safety (provider exchange mocked)", () => {
  it.each([
    "/natori/dashboard/cases?case=fixture",
    "https://acceptance.example.invalid/natori/dashboard/cases",
  ])("accepts same-origin %s", async (next) => {
    const r = await GET(
      new Request(
        "https://acceptance.example.invalid/auth/callback?code=synthetic&next=" +
          encodeURIComponent(next),
      ),
    );
    expect(new URL(r.headers.get("location")!).pathname).toBe(
      "/natori/dashboard/cases",
    );
    expect(m.exchange).toHaveBeenCalledExactlyOnceWith("synthetic");
  });
  it.each([
    "//evil.invalid",
    "/\\evil.invalid",
    "https://acceptance.example.invalid.evil.invalid/x",
    "https://evil.invalid",
    "/%5cevil.invalid",
    "/\nevil.invalid",
    "javascript:alert(1)",
  ])("rejects normalized external/control redirect %s", async (next) => {
    const r = await GET(
      new Request(
        "https://acceptance.example.invalid/auth/callback?next=" +
          encodeURIComponent(next),
      ),
    );
    expect(r.headers.get("location")).toBe(
      "https://acceptance.example.invalid/",
    );
    expect(m.exchange).not.toHaveBeenCalled();
  });
  it("failed PKCE exchange does not continue into protected page", async () => {
    m.exchange.mockResolvedValue({ error: { message: "synthetic" } });
    const r = await GET(
      new Request(
        "https://acceptance.example.invalid/auth/callback?code=synthetic&next=/natori/dashboard/cases",
      ),
    );
    expect(r.headers.get("location")).toBe(
      "https://acceptance.example.invalid/admin-login?err=oauth",
    );
  });
  it("provider error and absent code do not exchange or invent a session", async () => {
    await GET(
      new Request(
        "https://acceptance.example.invalid/auth/callback?error=access_denied",
      ),
    );
    await GET(new Request("https://acceptance.example.invalid/auth/callback"));
    expect(m.exchange).not.toHaveBeenCalled();
  });
});
