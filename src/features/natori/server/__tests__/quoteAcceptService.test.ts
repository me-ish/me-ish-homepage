// 版付き見積もりのトークン照合・期限・原子的承諾を固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

vi.mock("server-only", () => ({}));

const { mockAdminFrom, mockRpc, mockNotice } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockNotice: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}));

vi.mock("@/features/natori/server/orderMailService", () => ({
  sendNatoriNoticeMail: (...args: unknown[]) => mockNotice(...args),
}));

import {
  acceptNatoriQuote,
  getNatoriQuoteByToken,
} from "@/features/natori/server/quoteAcceptService";

const TOKEN = "abcDEF123_-".repeat(4);
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

type Result = { data: unknown; error: unknown };

function chainResult(result: Result, calls: string[] = []) {
  const chain: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (resolve: (value: Result) => void) => resolve(result);
        if (prop === "maybeSingle") return vi.fn().mockResolvedValue(result);
        return (...args: unknown[]) => {
          calls.push(`${String(prop)}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
          return chain;
        };
      },
    }
  );
  return chain;
}

function quoteTable(row: unknown) {
  const calls: string[] = [];
  const api = { select: vi.fn(() => chainResult({ data: row, error: null }, calls)) };
  mockAdminFrom.mockImplementation((table: string) => {
    if (table !== "natori_quotes") throw new Error(`unexpected table: ${table}`);
    return api;
  });
  return { calls };
}

function makeQuoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-1",
    project_id: "proj-1",
    title: "立ち絵一式",
    client_name: "テスト太郎",
    amount: 12000,
    accepted_at: null,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    superseded_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNotice.mockResolvedValue(true);
  mockRpc.mockResolvedValue({
    data: [{ result: "ok", quote_id: "quote-1", project_id: "proj-1", accepted_at: "2026-07-01T00:00:00Z" }],
    error: null,
  });
  mockAdminFrom.mockImplementation((table: string) => {
    throw new Error(`unexpected table access: ${table}`);
  });
});

describe("getNatoriQuoteByToken", () => {
  it("発行時の見積もりスナップショットを返す", async () => {
    const { calls } = quoteTable(makeQuoteRow());
    await expect(getNatoriQuoteByToken(TOKEN)).resolves.toEqual({
      kind: "ok",
      quote: {
        projectId: "proj-1",
        title: "立ち絵一式",
        clientName: "テスト太郎",
        amount: 12000,
        acceptedAt: null,
      },
    });
    expect(calls).toContain(`eq("token_hash","${TOKEN_HASH}")`);
  });

  it("形式外トークンはDBを引かず、該当なし・失効・旧版も表示しない", async () => {
    await expect(getNatoriQuoteByToken("<script>短い")).resolves.toEqual({ kind: "not-found" });
    expect(mockAdminFrom).not.toHaveBeenCalled();

    quoteTable(null);
    await expect(getNatoriQuoteByToken(TOKEN)).resolves.toEqual({ kind: "not-found" });
    quoteTable(makeQuoteRow({ expires_at: new Date(Date.now() - 1000).toISOString() }));
    await expect(getNatoriQuoteByToken(TOKEN)).resolves.toEqual({ kind: "expired" });
    quoteTable(makeQuoteRow({ superseded_at: new Date().toISOString() }));
    await expect(getNatoriQuoteByToken(TOKEN)).resolves.toEqual({ kind: "not-found" });
  });

  it("承諾済みなら期限後も承諾内容を表示する", async () => {
    quoteTable(makeQuoteRow({
      accepted_at: "2026-07-01T00:00:00Z",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    }));
    const result = await getNatoriQuoteByToken(TOKEN);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.quote.acceptedAt).toBe("2026-07-01T00:00:00Z");
  });
});

describe("acceptNatoriQuote", () => {
  it("DB関数で原子的に承諾し、成立した1回だけ通知する", async () => {
    quoteTable(makeQuoteRow());
    const result = await acceptNatoriQuote(TOKEN);
    expect(result).toMatchObject({ kind: "ok", quote: { acceptedAt: "2026-07-01T00:00:00Z" } });
    expect(mockRpc).toHaveBeenCalledWith("natori_accept_quote", { p_token_hash: TOKEN_HASH });
    expect(mockNotice).toHaveBeenCalledTimes(1);
  });

  it("事前承諾済みと競合時のalready-acceptedでは通知しない", async () => {
    quoteTable(makeQuoteRow({ accepted_at: "2026-07-01T00:00:00Z" }));
    await expect(acceptNatoriQuote(TOKEN)).resolves.toMatchObject({ kind: "already-accepted" });
    expect(mockRpc).not.toHaveBeenCalled();

    vi.clearAllMocks();
    quoteTable(makeQuoteRow());
    mockRpc.mockResolvedValue({
      data: [{ result: "already-accepted", accepted_at: "2026-07-01T00:00:00Z" }],
      error: null,
    });
    await expect(acceptNatoriQuote(TOKEN)).resolves.toMatchObject({ kind: "already-accepted" });
    expect(mockNotice).not.toHaveBeenCalled();
  });

  it("期限切れ・旧版は承諾しない", async () => {
    quoteTable(makeQuoteRow({ expires_at: new Date(Date.now() - 1000).toISOString() }));
    await expect(acceptNatoriQuote(TOKEN)).resolves.toEqual({ kind: "expired" });
    expect(mockRpc).not.toHaveBeenCalled();

    quoteTable(makeQuoteRow({ superseded_at: new Date().toISOString() }));
    await expect(acceptNatoriQuote(TOKEN)).resolves.toEqual({ kind: "not-found" });
  });

  it("通知失敗は承諾を巻き戻さない", async () => {
    quoteTable(makeQuoteRow());
    mockNotice.mockResolvedValue(false);
    await expect(acceptNatoriQuote(TOKEN)).resolves.toMatchObject({ kind: "ok" });
  });
});
