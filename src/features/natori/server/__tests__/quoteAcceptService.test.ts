// quoteAcceptService のテスト。
// トークン照合（ハッシュ）・有効期限・条件付き UPDATE による承諾の冪等性を固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const { mockAdminFrom, mockNotice } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockNotice: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
}));

vi.mock("@/features/natori/server/orderMailService", () => ({
  sendNatoriNoticeMail: (...args: unknown[]) => mockNotice(...args),
}));

import {
  acceptNatoriQuote,
  getNatoriQuoteByToken,
} from "@/features/natori/server/quoteAcceptService";

/* ---------- Helpers ---------- */

const TOKEN = "abcDEF123_-".repeat(4); // 44文字・base64url風
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

type Result = { data: unknown; error: unknown };

function chainResult(result: Result, calls?: string[]) {
  const chain: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (resolve: (v: Result) => void) => resolve(result);
        if (prop === "single" || prop === "maybeSingle") {
          return vi.fn().mockResolvedValue(result);
        }
        return (...args: unknown[]) => {
          calls?.push(`${String(prop)}(${args.map((a) => JSON.stringify(a)).join(",")})`);
          return chain;
        };
      },
    }
  );
  return chain;
}

function quoteTable(row: unknown, options: { updateRows?: unknown[] } = {}) {
  const updates: Record<string, unknown>[] = [];
  const updateCalls: string[] = [];
  const api = {
    select: vi.fn(() => chainResult({ data: row, error: null })),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return chainResult(
        { data: options.updateRows ?? [{ id: "proj-1" }], error: null },
        updateCalls
      );
    }),
  };
  mockAdminFrom.mockImplementation((table: string) => {
    if (table !== "natori_projects") throw new Error(`unexpected table: ${table}`);
    return api;
  });
  return { api, updates, updateCalls };
}

function makeQuoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    title: "立ち絵一式",
    client_name: "テスト太郎",
    amount: 12000,
    note: "既存メモ",
    quote_accepted_at: null,
    quote_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNotice.mockResolvedValue(true);
  mockAdminFrom.mockImplementation((table: string) => {
    throw new Error(`unexpected table access: ${table}`);
  });
});

/* ---------- Tests ---------- */

describe("getNatoriQuoteByToken", () => {
  it("正しいトークンで見積もり内容を返す", async () => {
    quoteTable(makeQuoteRow());
    const result = await getNatoriQuoteByToken(TOKEN);
    expect(result).toEqual({
      kind: "ok",
      quote: {
        projectId: "proj-1",
        title: "立ち絵一式",
        clientName: "テスト太郎",
        amount: 12000,
        acceptedAt: null,
      },
    });
  });

  it("形式外のトークンは DB を引かずに not-found", async () => {
    const result = await getNatoriQuoteByToken("<script>短い");
    expect(result).toEqual({ kind: "not-found" });
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("該当行が無ければ not-found、期限切れは expired", async () => {
    quoteTable(null);
    expect(await getNatoriQuoteByToken(TOKEN)).toEqual({ kind: "not-found" });

    quoteTable(
      makeQuoteRow({
        quote_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      })
    );
    expect(await getNatoriQuoteByToken(TOKEN)).toEqual({ kind: "expired" });
  });

  it("承諾済みの見積もりは期限が過ぎていても承諾済みとして表示できる", async () => {
    quoteTable(
      makeQuoteRow({
        quote_accepted_at: "2026-07-01T00:00:00Z",
        quote_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      })
    );
    const result = await getNatoriQuoteByToken(TOKEN);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.quote.acceptedAt).toBe("2026-07-01T00:00:00Z");
    }
  });
});

describe("acceptNatoriQuote", () => {
  it("承諾を条件付き UPDATE で記録し、ナトリへ通知する", async () => {
    const { updates, updateCalls } = quoteTable(makeQuoteRow());

    const result = await acceptNatoriQuote(TOKEN);
    expect(result.kind).toBe("ok");

    expect(updates).toHaveLength(1);
    expect(updates[0].quote_accepted_at).toBeTruthy();
    expect(updates[0].quote_accepted_amount).toBe(12000);
    expect(String(updates[0].next_action)).toContain("承諾済み");
    expect(String(updates[0].note)).toContain("既存メモ");
    expect(String(updates[0].note)).toContain("見積もり承諾");

    // 二度押し・二重タブ対策の条件と、トークン一致の条件が UPDATE に付く
    expect(updateCalls).toContain('is("quote_accepted_at",null)');
    expect(updateCalls).toContain(`eq("quote_accept_token_hash","${TOKEN_HASH}")`);

    expect(mockNotice).toHaveBeenCalledTimes(1);
    const [subject, body] = mockNotice.mock.calls[0] as [string, string];
    expect(subject).toContain("承諾");
    expect(body).toContain("テスト太郎");
  });

  it("既に承諾済みなら更新も通知もせず already-accepted", async () => {
    const { updates } = quoteTable(
      makeQuoteRow({ quote_accepted_at: "2026-07-01T00:00:00Z" })
    );
    const result = await acceptNatoriQuote(TOKEN);
    expect(result.kind).toBe("already-accepted");
    expect(updates).toHaveLength(0);
    expect(mockNotice).not.toHaveBeenCalled();
  });

  it("条件付き UPDATE が 0 行（レースで先に承諾済み）なら already-accepted、通知は1回に抑える", async () => {
    quoteTable(makeQuoteRow(), { updateRows: [] });
    const result = await acceptNatoriQuote(TOKEN);
    expect(result.kind).toBe("already-accepted");
    expect(mockNotice).not.toHaveBeenCalled();
  });

  it("期限切れは更新せず expired", async () => {
    const { updates } = quoteTable(
      makeQuoteRow({
        quote_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      })
    );
    const result = await acceptNatoriQuote(TOKEN);
    expect(result.kind).toBe("expired");
    expect(updates).toHaveLength(0);
  });

  it("通知メールの失敗は無視して承諾自体は成立させる", async () => {
    quoteTable(makeQuoteRow());
    mockNotice.mockResolvedValue(false);
    const result = await acceptNatoriQuote(TOKEN);
    expect(result.kind).toBe("ok");
  });
});
