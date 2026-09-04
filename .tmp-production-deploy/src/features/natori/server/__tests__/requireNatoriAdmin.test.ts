// requireNatoriAdmin のテスト。
// 認可が deny-by-default であること（env 未設定で全開放しない）と、
// 合言葉キー Cookie（HMAC トークン）・admin/staff ログインの各経路を固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NATORI_KEY_COOKIE } from "@/features/natori/constants/dashboardKey";
import { deriveNatoriDashboardCookieToken } from "@/features/natori/lib/dashboardKeyToken";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const { mockGetCookie, mockRedirect, mockIsAdminEmailAsync, mockGetUser } =
  vi.hoisted(() => ({
    mockGetCookie: vi.fn<(name: string) => { value: string } | undefined>(),
    mockRedirect: vi.fn((url: string) => {
      throw new Error(`redirect:${url}`);
    }),
    mockIsAdminEmailAsync: vi.fn<(email?: string | null) => Promise<boolean>>(),
    mockGetUser: vi.fn(),
  }));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: mockGetCookie }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/isAdmin", () => ({
  isAdminEmailAsync: mockIsAdminEmailAsync,
}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: () => ({ auth: { getUser: mockGetUser } }),
}));

import {
  canAccessNatoriManagement,
  canUseNatoriManagement,
  requireNatoriAccess,
} from "@/features/natori/server/requireNatoriAdmin";

/* ---------- Env / helper setup ---------- */

const ENV_KEYS = [
  "NATORI_DASHBOARD_KEY",
  "NATORI_REQUIRE_AUTH",
  "NATORI_STAFF_EMAILS",
  "NATORI_OWNER_EMAILS",
] as const;

const savedEnv: Record<string, string | undefined> = {};

function setLoggedInUser(email: string | null) {
  mockGetUser.mockResolvedValue({
    data: { user: email ? { email } : null },
  });
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  mockGetCookie.mockReturnValue(undefined);
  mockIsAdminEmailAsync.mockResolvedValue(false);
  setLoggedInUser(null);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.clearAllMocks();
});

/* ---------- Tests ---------- */

describe("canUseNatoriManagement", () => {
  it("両envとも未設定・未ログインなら拒否する（フェイルオープンしない）", async () => {
    await expect(canUseNatoriManagement()).resolves.toBe(false);
  });

  it("両envとも未設定でも admin メールのログインは通る", async () => {
    setLoggedInUser("admin@example.com");
    mockIsAdminEmailAsync.mockImplementation(
      async (email) => email === "admin@example.com"
    );
    await expect(canUseNatoriManagement()).resolves.toBe(true);
  });

  it("正しいキーの HMAC トークン Cookie なら通る", async () => {
    process.env.NATORI_DASHBOARD_KEY = "correct-key";
    const token = await deriveNatoriDashboardCookieToken("correct-key");
    mockGetCookie.mockImplementation((name) =>
      name === NATORI_KEY_COOKIE ? { value: token } : undefined
    );
    await expect(canUseNatoriManagement()).resolves.toBe(true);
  });

  it("誤ったキー由来のトークン Cookie は拒否する", async () => {
    process.env.NATORI_DASHBOARD_KEY = "correct-key";
    const token = await deriveNatoriDashboardCookieToken("wrong-key");
    mockGetCookie.mockImplementation((name) =>
      name === NATORI_KEY_COOKIE ? { value: token } : undefined
    );
    await expect(canUseNatoriManagement()).resolves.toBe(false);
  });

  it("旧形式（キー平文）の Cookie は拒否する", async () => {
    process.env.NATORI_DASHBOARD_KEY = "correct-key";
    mockGetCookie.mockImplementation((name) =>
      name === NATORI_KEY_COOKIE ? { value: "correct-key" } : undefined
    );
    await expect(canUseNatoriManagement()).resolves.toBe(false);
  });

  it("キー設定済みでも Cookie もログインも無ければ拒否する", async () => {
    process.env.NATORI_DASHBOARD_KEY = "correct-key";
    await expect(canUseNatoriManagement()).resolves.toBe(false);
  });

  it("NATORI_REQUIRE_AUTH=1: staff メールのログインは通り、非 staff は拒否する", async () => {
    process.env.NATORI_REQUIRE_AUTH = "1";
    process.env.NATORI_STAFF_EMAILS = "staff@example.com";

    setLoggedInUser("staff@example.com");
    await expect(canUseNatoriManagement()).resolves.toBe(true);

    setLoggedInUser("stranger@example.com");
    await expect(canUseNatoriManagement()).resolves.toBe(false);
  });

  it("NATORI_OWNER_EMAILS のログインも通る（大文字小文字を無視）", async () => {
    process.env.NATORI_OWNER_EMAILS = "Owner@Example.com";
    setLoggedInUser("owner@example.com");
    await expect(canUseNatoriManagement()).resolves.toBe(true);
  });

  it("キー設定済み + Cookie 無しでも admin ログインなら通る", async () => {
    process.env.NATORI_DASHBOARD_KEY = "correct-key";
    setLoggedInUser("admin@example.com");
    mockIsAdminEmailAsync.mockResolvedValue(true);
    await expect(canUseNatoriManagement()).resolves.toBe(true);
  });
});

describe("canAccessNatoriManagement", () => {
  it("email 無しは拒否する", async () => {
    await expect(canAccessNatoriManagement(null)).resolves.toBe(false);
    await expect(canAccessNatoriManagement("")).resolves.toBe(false);
  });
});

describe("requireNatoriAccess", () => {
  it("拒否時は admin-login へ redirect する", async () => {
    await expect(requireNatoriAccess("/natori/dashboard")).rejects.toThrow(
      /redirect:\/admin-login\?err=unauthorized/
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("/natori/dashboard"))
    );
  });

  it("許可時は redirect しない", async () => {
    process.env.NATORI_DASHBOARD_KEY = "correct-key";
    const token = await deriveNatoriDashboardCookieToken("correct-key");
    mockGetCookie.mockImplementation((name) =>
      name === NATORI_KEY_COOKIE ? { value: token } : undefined
    );
    await expect(requireNatoriAccess("/natori/dashboard")).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
