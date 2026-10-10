// Stripe Webhook (POST /api/webhook/stripe) のテスト。
// 署名・ナトリの冪等性/再送・旧テスト商品の無副作用終了を検証する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const mockConstructEvent = vi.fn();
vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) };
    constructor(_apiKey?: string) {}
  },
}));

const mockMarkPaid = vi.fn();
vi.mock("@/features/natori/server/orderMailService", () => ({
  markNatoriCommissionPaid: (...args: unknown[]) => mockMarkPaid(...args),
}));

const mockAdminFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUserById = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { admin: { getUserById: (...args: unknown[]) => mockGetUserById(...args) } },
  })),
}));

import { POST } from "../route";

/* ---------- Helpers ---------- */

type Result = { data: unknown; error: unknown };

/**
 * どこまでチェーンしても最後は result に解決される query builder モック。
 * calls を渡すとチェーンしたメソッド呼び出し（filter 等）を記録する。
 */
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

/** テーブルごとの select 結果と、update / upsert / delete の記録 */
function makeTable(
  selectResult: Result,
  options: { updateResult?: Result; upsertResult?: Result } = {}
) {
  const updates: Record<string, unknown>[] = [];
  const updateCalls: string[] = [];
  const upserts: unknown[] = [];
  const deletes: string[] = [];
  return {
    updates,
    updateCalls,
    upserts,
    deletes,
    api: {
      select: vi.fn(() => chainResult(selectResult)),
      update: vi.fn((payload: Record<string, unknown>) => {
        updates.push(payload);
        return chainResult(
          options.updateResult ?? { data: [{ id: "row-1" }], error: null },
          updateCalls
        );
      }),
      upsert: vi.fn((payload: unknown) => {
        upserts.push(payload);
        return chainResult(options.upsertResult ?? { data: null, error: null });
      }),
      delete: vi.fn(() => chainResult({ data: null, error: null }, deletes)),
    },
  };
}

/**
 * processed_stripe_events（イベント dedup）テーブルのモック。
 * claim: "claimed"（新規挿入=処理権あり） / "duplicate"（衝突=二重配送） / "error"
 */
function dedupTable(claim: "claimed" | "duplicate" | "error" = "claimed") {
  return makeTable(
    { data: null, error: null },
    {
      upsertResult:
        claim === "error"
          ? { data: null, error: { message: "db down" } }
          : { data: claim === "claimed" ? [{ event_id: "evt_1" }] : [], error: null },
    }
  );
}

function useTables(tables: Record<string, { api: unknown }>) {
  mockAdminFrom.mockImplementation((table: string) => {
    const entry = tables[table];
    if (!entry) throw new Error(`unexpected table access: ${table}`);
    return entry.api;
  });
}

function makeReq(headers: Record<string, string> = { "stripe-signature": "sig_test" }) {
  return new NextRequest("https://example.com/api/webhook/stripe", {
    method: "POST",
    headers,
    body: "{}",
  });
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_1",
    payment_status: "paid",
    status: "complete",
    metadata: {},
    amount_total: 8000,
    customer_details: null,
    customer_email: null,
    ...overrides,
  };
}

function stubEvent(
  session: Record<string, unknown>,
  type = "checkout.session.completed"
) {
  mockConstructEvent.mockReturnValue({ id: "evt_1", type, data: { object: session } });
}

const NATORI_PROJECT_ID = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("NATORI_PAYMENT_INTEGRITY_ENABLED", "0");
  mockMarkPaid.mockResolvedValue({ kind: "ok" });
  mockAdminFrom.mockImplementation((table: string) => {
    throw new Error(`unexpected table access: ${table}`);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ---------- ガード ---------- */

describe("webhook guards", () => {
  it("STRIPE_WEBHOOK_SECRET 未設定なら 500", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it("stripe-signature ヘッダーが無ければ 400", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_signature");
  });

  it("署名検証に失敗したら 400", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_signature");
  });

  it("対象外イベントは何もせず 200 ACK", async () => {
    stubEvent(makeSession(), "payment_intent.succeeded");
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockAdminFrom).not.toHaveBeenCalled();
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it("未払いセッションは何もせず 200 ACK", async () => {
    stubEvent(makeSession({ payment_status: "unpaid", status: "open" }));
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockAdminFrom).not.toHaveBeenCalled();
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });
});

/* ---------- ルーティング ---------- */

describe("event dedup (processed_stripe_events)", () => {
  it("同一 event の再送は claim が duplicate になり、何も処理せず 200 ACK", async () => {
    const dedup = dedupTable("duplicate");
    useTables({ processed_stripe_events: dedup });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).deduped).toBe(true);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it("claim の挿入自体が失敗したら 500（dedup 行は無いので Stripe 再送で取りこぼさない）", async () => {
    const dedup = dedupTable("error");
    useTables({ processed_stripe_events: dedup });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it("claim は event.id で upsert（ignoreDuplicates）される", async () => {
    const dedup = dedupTable("claimed");
    useTables({ processed_stripe_events: dedup });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );

    await POST(makeReq());
    expect(dedup.upserts).toEqual([{ event_id: "evt_1" }]);
  });
});

describe("natori_commission routing", () => {
  it("kind=natori_commission + UUID projectId で入金反映を呼ぶ", async () => {
    useTables({ processed_stripe_events: dedupTable() });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockMarkPaid).toHaveBeenCalledWith(NATORI_PROJECT_ID, "cs_test_1", 8000, null);
  });

  it("projectId が UUID でなければ呼ばない", async () => {
    useTables({ processed_stripe_events: dedupTable() });
    stubEvent(
      makeSession({ metadata: { kind: "natori_commission", projectId: "1 OR 1=1" } })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it("db-error（一時エラー）は claim を解放して 500（Stripe に再送させる）", async () => {
    const dedup = dedupTable();
    useTables({ processed_stripe_events: dedup });
    mockMarkPaid.mockResolvedValue({ kind: "db-error" });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    // 再送をパスさせるため dedup 行を event_id 指定で削除している
    expect(dedup.api.delete).toHaveBeenCalledTimes(1);
    expect(dedup.deletes).toContain('eq("event_id","evt_1")');
  });

  it("not-found（恒久エラー）は 200 ACK で再送ループさせない", async () => {
    const dedup = dedupTable();
    useTables({ processed_stripe_events: dedup });
    mockMarkPaid.mockResolvedValue({ kind: "not-found" });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(dedup.api.delete).not.toHaveBeenCalled();
  });

  it("amount-mismatch（金額不一致）は恒久エラー扱いで 200 ACK（通知は service 側で送信済み）", async () => {
    const dedup = dedupTable();
    useTables({ processed_stripe_events: dedup });
    mockMarkPaid.mockResolvedValue({ kind: "amount-mismatch" });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(dedup.api.delete).not.toHaveBeenCalled();
  });

  it("already-paid（completed 後の async_payment_succeeded 等）は 200 ACK", async () => {
    useTables({ processed_stripe_events: dedupTable() });
    mockMarkPaid.mockResolvedValue({ kind: "already-paid" });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      }),
      "checkout.session.async_payment_succeeded"
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
  });
});

describe.each(["0", "1"])("retired products with payment integrity=%s", integrity => {
  it.each([
    ["aura", { kind: "aura", requestId: NATORI_PROJECT_ID }],
    ["card", { kind: "card", requestId: NATORI_PROJECT_ID }],
    ["entry plan", { kind: "entry_plan", entryId: "42" }],
    ["gallery", { kind: "gallery", entryId: "42" }],
    ["old gallery metadata", { entryId: "42", quantity: "2" }],
  ])("acknowledges %s without writes, claims or notifications", async (_name, metadata) => {
    vi.stubEnv("NATORI_PAYMENT_INTEGRITY_ENABLED", integrity);
    const network = vi.fn(() => { throw new Error("unexpected network effect"); });
    vi.stubGlobal("fetch", network);
    try {
      for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"]) {
        stubEvent(makeSession({ metadata }), type);
        const response = await POST(makeReq());
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, received: true, result: "legacy_product_retired" });
      }
      expect(mockAdminFrom).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockMarkPaid).not.toHaveBeenCalled();
      expect(mockGetUserById).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});

it("Natori rollback dispatch takes precedence over stray old entry metadata", async () => {
  useTables({ processed_stripe_events: dedupTable() });
  stubEvent(makeSession({ metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID, entryId: "42" } }));
  expect((await POST(makeReq())).status).toBe(200);
  expect(mockMarkPaid).toHaveBeenCalledWith(NATORI_PROJECT_ID, "cs_test_1", 8000, null);
});
