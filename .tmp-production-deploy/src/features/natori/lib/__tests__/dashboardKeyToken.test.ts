// dashboardKeyToken のテスト。
// Cookie トークン導出の決定性（middleware と server で同じ値になること）と
// 定数時間比較の判定を固定する。
import { describe, expect, it } from "vitest";
import {
  constantTimeEquals,
  deriveNatoriDashboardCookieToken,
} from "@/features/natori/lib/dashboardKeyToken";

describe("deriveNatoriDashboardCookieToken", () => {
  it("同じキーからは常に同じトークンを導出する", async () => {
    const a = await deriveNatoriDashboardCookieToken("my-secret-key");
    const b = await deriveNatoriDashboardCookieToken("my-secret-key");
    expect(a).toBe(b);
  });

  it("トークンは 64 文字の hex で、キー平文を含まない", async () => {
    const token = await deriveNatoriDashboardCookieToken("my-secret-key");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toContain("my-secret-key");
  });

  it("異なるキーからは異なるトークンになる", async () => {
    const a = await deriveNatoriDashboardCookieToken("key-a");
    const b = await deriveNatoriDashboardCookieToken("key-b");
    expect(a).not.toBe(b);
  });
});

describe("constantTimeEquals", () => {
  it("一致 / 不一致 / 長さ違いを正しく判定する", () => {
    expect(constantTimeEquals("abc123", "abc123")).toBe(true);
    expect(constantTimeEquals("abc123", "abc124")).toBe(false);
    expect(constantTimeEquals("abc123", "abc12")).toBe(false);
    expect(constantTimeEquals("", "")).toBe(true);
  });
});
