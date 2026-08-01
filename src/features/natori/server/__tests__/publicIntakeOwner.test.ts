// 公開受付 owner 解決の境界テスト。
// session も既存 DB 探索も使わず、明示設定された owner だけを返すことを固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockSupabaseAdmin, mockCreateServerClient } = vi.hoisted(() => ({
  mockSupabaseAdmin: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateServerClient }));

import { resolvePublicIntakeOwnerId } from "@/features/natori/server/publicIntakeOwner";
import { isPublicStructuredIntakeEnabled } from "@/features/natori/server/publicIntakeRollout";

const OWNER_ID = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolvePublicIntakeOwnerId", () => {
  it("NATORI_OWNER_USER_ID が設定されていればその値を返す", () => {
    vi.stubEnv("NATORI_OWNER_USER_ID", OWNER_ID);
    expect(resolvePublicIntakeOwnerId()).toEqual({ kind: "ok", ownerId: OWNER_ID });
  });

  it("大文字・前後空白は正規化する", () => {
    vi.stubEnv("NATORI_OWNER_USER_ID", `  ${OWNER_ID.toUpperCase()}  `);
    expect(resolvePublicIntakeOwnerId()).toEqual({ kind: "ok", ownerId: OWNER_ID });
  });

  it("未設定なら unconfigured を返す（既存 owner へ fallback しない）", () => {
    vi.stubEnv("NATORI_OWNER_USER_ID", "");
    expect(resolvePublicIntakeOwnerId()).toEqual({ kind: "unconfigured" });
  });

  it("UUID でない値は invalid を返す", () => {
    vi.stubEnv("NATORI_OWNER_USER_ID", "natori-owner");
    expect(resolvePublicIntakeOwnerId()).toEqual({ kind: "invalid" });
  });

  it("session client も admin client も一切呼ばない", () => {
    vi.stubEnv("NATORI_OWNER_USER_ID", OWNER_ID);
    resolvePublicIntakeOwnerId();
    vi.stubEnv("NATORI_OWNER_USER_ID", "");
    resolvePublicIntakeOwnerId();
    expect(mockCreateServerClient).not.toHaveBeenCalled();
    expect(mockSupabaseAdmin).not.toHaveBeenCalled();
  });
});

describe("isPublicStructuredIntakeEnabled", () => {
  it("未設定なら無効（Production 既定）", () => {
    vi.stubEnv("NATORI_PUBLIC_INTAKE_V2", "");
    expect(isPublicStructuredIntakeEnabled()).toBe(false);
  });

  it('"1" のときだけ有効', () => {
    vi.stubEnv("NATORI_PUBLIC_INTAKE_V2", "1");
    expect(isPublicStructuredIntakeEnabled()).toBe(true);
    vi.stubEnv("NATORI_PUBLIC_INTAKE_V2", "true");
    expect(isPublicStructuredIntakeEnabled()).toBe(false);
    vi.stubEnv("NATORI_PUBLIC_INTAKE_V2", "0");
    expect(isPublicStructuredIntakeEnabled()).toBe(false);
  });
});
