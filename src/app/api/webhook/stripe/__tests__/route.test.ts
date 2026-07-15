// Stripe Webhook (POST /api/webhook/stripe) のテスト。
// 署名検証まわりのガード、metadata による4分岐（gallery / entry_plan / aura /
// card / natori_commission）のルーティング、二重配送への冪等性を固定する。
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

vi.mock("@/lib/coa/server", () => ({
  issueReissueLink: vi.fn().mockResolvedValue("https://example.com/coa"),
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

function chainResult(result: Result) {
  const chain: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (resolve: (v: Result) => void) => resolve(result);
        if (prop === "single" || prop === "maybeSingle") {
          return vi.fn().mockResolvedValue(result);
        }
        return vi.fn().mockReturnValue(chain);
      },
    }
  );
  return chain;
}

/** テーブルごとの select 結果と、update / upsert payload の記録 */
function makeTable(selectResult: Result, options: { updateResult?: Result } = {}) {
  const updates: Record<string, unknown>[] = [];
  const upserts: unknown[] = [];
  return {
    updates,
    upserts,
    api: {
      select: vi.fn(() => chainResult(selectResult)),
      update: vi.fn((payload: Record<string, unknown>) => {
        updates.push(payload);
        return chainResult(options.updateResult ?? { data: [{ id: "row-1" }], error: null });
      }),
      upsert: vi.fn((payload: unknown) => {
        upserts.push(payload);
        return chainResult({ data: null, error: null });
      }),
    },
  };
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
  vi.stubEnv("ADMIN_API_TOKEN", ""); // メール送信の内部API呼び出しを無効化
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

describe("natori_commission routing", () => {
  it("kind=natori_commission + UUID projectId で入金反映を呼ぶ", async () => {
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockMarkPaid).toHaveBeenCalledWith(NATORI_PROJECT_ID, "cs_test_1", 8000);
  });

  it("projectId が UUID でなければ呼ばない", async () => {
    stubEvent(
      makeSession({ metadata: { kind: "natori_commission", projectId: "1 OR 1=1" } })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it("入金反映が失敗しても 200 を返す（Stripe の再送ループ回避）", async () => {
    mockMarkPaid.mockResolvedValue({ kind: "db-error" });
    stubEvent(
      makeSession({
        metadata: { kind: "natori_commission", projectId: NATORI_PROJECT_ID },
      })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
  });
});

describe("aura routing", () => {
  const AURA_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("未払いレコードを paid にする（存在しない stripe_session_id 列は書かない）", async () => {
    const aura = makeTable({
      data: { id: AURA_ID, payment_status: "created" },
      error: null,
    });
    useTables({ aura_requests: aura });
    stubEvent(makeSession({ metadata: { kind: "aura", requestId: AURA_ID } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(aura.updates).toHaveLength(1);
    expect(aura.updates[0].payment_status).toBe("paid");
    expect(aura.updates[0].paid_at).toBeTruthy();
    // 回帰テスト: aura_requests に存在しない列を書くと update 全体が失敗する
    expect(aura.updates[0]).not.toHaveProperty("stripe_session_id");
  });

  it("冪等: すでに paid なら update しない", async () => {
    const aura = makeTable({
      data: { id: AURA_ID, payment_status: "paid" },
      error: null,
    });
    useTables({ aura_requests: aura });
    stubEvent(makeSession({ metadata: { kind: "aura", requestId: AURA_ID } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(aura.updates).toHaveLength(0);
  });
});

describe("card routing", () => {
  const CARD_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("未払いレコードを paid にし、session id を記録する", async () => {
    const card = makeTable({
      data: { id: CARD_ID, payment_status: "pending", stripe_session_id: null },
      error: null,
    });
    useTables({ card_requests: card });
    stubEvent(makeSession({ metadata: { kind: "card", requestId: CARD_ID } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(card.updates).toHaveLength(1);
    expect(card.updates[0].payment_status).toBe("paid");
    expect(card.updates[0].stripe_session_id).toBe("cs_test_1");
  });

  it("冪等: すでに paid なら update しない", async () => {
    const card = makeTable({
      data: { id: CARD_ID, payment_status: "paid", stripe_session_id: "cs_old" },
      error: null,
    });
    useTables({ card_requests: card });
    stubEvent(makeSession({ metadata: { kind: "card", requestId: CARD_ID } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(card.updates).toHaveLength(0);
  });
});

describe("entry plan routing", () => {
  it("kind=entry_plan + 数値 entryId でプラン支払いを paid にする", async () => {
    const entries = makeTable({
      data: { id: 42, plan_payment_status: null },
      error: null,
    });
    useTables({ entries });
    stubEvent(makeSession({ metadata: { kind: "entry_plan", entryId: "42" } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(entries.updates).toHaveLength(1);
    expect(entries.updates[0].plan_payment_status).toBe("paid");
    expect(entries.updates[0].plan_payment_session_id).toBe("cs_test_1");
  });

  it("冪等: すでに paid なら update しない", async () => {
    const entries = makeTable({
      data: { id: 42, plan_payment_status: "paid" },
      error: null,
    });
    useTables({ entries });
    stubEvent(makeSession({ metadata: { kind: "entry_plan", entryId: "42" } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(entries.updates).toHaveLength(0);
  });
});

describe("gallery routing", () => {
  it("冪等: 同じ session の sales 行が既にあれば finalize_sale を呼ばない", async () => {
    const sales = makeTable({ data: { id: "sale-1" }, error: null });
    useTables({ sales });
    stubEvent(makeSession({ metadata: { entryId: "42" } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("新規購入は finalize_sale RPC を数量・金額つきで呼ぶ", async () => {
    const sales = makeTable({ data: null, error: null });
    const entries = makeTable({
      data: { title: "作品", user_id: "artist-1", edition_total: 5 },
      error: null,
    });
    const profiles = makeTable({ data: { display_name: "アーティスト" }, error: null });
    useTables({ sales, entries, profiles });
    mockRpc.mockResolvedValue({
      data: [{ new_edition_sold: 1, sold_out: false }],
      error: null,
    });
    mockGetUserById.mockResolvedValue({ data: { user: { email: null } } });

    stubEvent(makeSession({ metadata: { entryId: "42", quantity: "2" } }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("finalize_sale", {
      p_entry_id: 42,
      p_quantity: 2,
      p_session_id: "cs_test_1",
      p_price: 8000,
    });
    // sales 行に金額・手数料・報酬が記録される（fee=800, reward=7200）
    expect(sales.updates).toHaveLength(1);
    expect(sales.updates[0].price).toBe(8000);
    expect(sales.updates[0].meish_fee_yen).toBe(800);
    expect(sales.updates[0].artist_reward_yen).toBe(7200);
  });
});
