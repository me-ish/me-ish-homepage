// dashboardKeyToken のテスト。
// Cookie トークン導出の決定性（middleware と server で同じ値になること）と
// 定数時間比較の判定を固定する。
import { describe, expect, it } from "vitest";
import {
  constantTimeEquals,
  deriveNatoriDashboardCookieToken,
  deriveNatoriDashboardKeyProof,
  verifyNatoriDashboardCookieToken,
} from "@/features/natori/lib/dashboardKeyToken";

describe("deriveNatoriDashboardCookieToken", () => {
  it("同じキー・同じ発行時刻からは常に同じトークンを導出する", async () => {
    const a = await deriveNatoriDashboardCookieToken("my-secret-key", 1_800_000_000_000);
    const b = await deriveNatoriDashboardCookieToken("my-secret-key", 1_800_000_000_000);
    expect(a).toBe(b);
  });

  it("トークンは <発行時刻>.<64文字のhex> で、キー平文を含まない", async () => {
    const token = await deriveNatoriDashboardCookieToken("my-secret-key");
    expect(token).toMatch(/^\d{10}\.[0-9a-f]{64}$/);
    expect(token).not.toContain("my-secret-key");
  });

  it("異なるキーからは異なるトークンになる", async () => {
    const a = await deriveNatoriDashboardCookieToken("key-a", 1_800_000_000_000);
    const b = await deriveNatoriDashboardCookieToken("key-b", 1_800_000_000_000);
    expect(a).not.toBe(b);
  });
});

describe("verifyNatoriDashboardCookieToken（SEC-03: 8時間の期限をサーバーで守る）", () => {
  const ISSUED = 1_800_000_000_000;
  const HOUR = 60 * 60 * 1000;
  const issue = () => deriveNatoriDashboardCookieToken("correct-key", ISSUED);

  it("発行直後と8時間ちょうどまでは通る", async () => {
    const token = await issue();
    await expect(verifyNatoriDashboardCookieToken("correct-key", token, ISSUED)).resolves.toBe(true);
    await expect(verifyNatoriDashboardCookieToken("correct-key", token, ISSUED + 8 * HOUR)).resolves.toBe(true);
  });

  it("8時間を超えたものは通らない（1年後も）", async () => {
    const token = await issue();
    await expect(verifyNatoriDashboardCookieToken("correct-key", token, ISSUED + 8 * HOUR + 1000)).resolves.toBe(false);
    await expect(verifyNatoriDashboardCookieToken("correct-key", token, ISSUED + 365 * 24 * HOUR)).resolves.toBe(false);
  });

  it("未来の発行時刻は、時計のずれの許容(60秒)を超えると通らない", async () => {
    const token = await issue();
    await expect(verifyNatoriDashboardCookieToken("correct-key", token, ISSUED - 30_000)).resolves.toBe(true);
    await expect(verifyNatoriDashboardCookieToken("correct-key", token, ISSUED - 120_000)).resolves.toBe(false);
  });

  it("別キー・改ざんした発行時刻・旧形式(固定64hex)・形式違いは通らない", async () => {
    const token = await issue();
    await expect(verifyNatoriDashboardCookieToken("other-key", token, ISSUED)).resolves.toBe(false);
    const forged = `${Number(token.split(".")[0]) + 3600}.${token.split(".")[1]}`;
    await expect(verifyNatoriDashboardCookieToken("correct-key", forged, ISSUED + 3600_000)).resolves.toBe(false);
    const legacy = await deriveNatoriDashboardKeyProof("correct-key");
    await expect(verifyNatoriDashboardCookieToken("correct-key", legacy, ISSUED)).resolves.toBe(false);
    await expect(verifyNatoriDashboardCookieToken("correct-key", "", ISSUED)).resolves.toBe(false);
    await expect(verifyNatoriDashboardCookieToken("correct-key", "invalid", ISSUED)).resolves.toBe(false);
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
