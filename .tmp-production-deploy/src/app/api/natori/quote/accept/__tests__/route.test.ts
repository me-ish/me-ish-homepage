// 見積もり承諾 API (POST /api/natori/quote/accept) のテスト。
// CSRF・入力検証と、service の結果 → HTTP ステータスの対応を固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitStore } from "@/lib/rateLimit";

vi.mock("server-only", () => ({}));

const { mockAccept } = vi.hoisted(() => ({ mockAccept: vi.fn() }));

vi.mock("@/features/natori/server/quoteAcceptService", () => ({
  acceptNatoriQuote: (...args: unknown[]) => mockAccept(...args),
}));

import { POST } from "../route";

const URL_ = "https://example.com/api/natori/quote/accept";
const CSRF = { "x-requested-with": "me-ish", "content-type": "application/json" };

function makeReq(body: unknown, headers: Record<string, string> = CSRF) {
  return new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStore();
  mockAccept.mockResolvedValue({ kind: "ok", quote: {} });
});

describe("POST /api/natori/quote/accept", () => {
  it("CSRF ヘッダーが無ければ 403", async () => {
    const res = await POST(makeReq({ token: "t".repeat(43) }, { "content-type": "application/json" }));
    expect(res.status).toBe(403);
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("token が無ければ 400", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("承諾成功は 200、既に承諾済みは already フラグつき 200", async () => {
    const okRes = await POST(makeReq({ token: "t".repeat(43) }));
    expect(okRes.status).toBe(200);
    expect((await okRes.json()).ok).toBe(true);

    mockAccept.mockResolvedValue({ kind: "already-accepted", quote: {} });
    const alreadyRes = await POST(makeReq({ token: "t".repeat(43) }));
    expect(alreadyRes.status).toBe(200);
    expect((await alreadyRes.json()).already).toBe(true);
  });

  it("無効トークンは 404、期限切れは 410、DBエラーは 500", async () => {
    mockAccept.mockResolvedValue({ kind: "not-found" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(404);

    mockAccept.mockResolvedValue({ kind: "expired" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(410);

    mockAccept.mockResolvedValue({ kind: "db-error" });
    expect((await POST(makeReq({ token: "x".repeat(43) }))).status).toBe(500);
  });
});
