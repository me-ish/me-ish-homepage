// orderMailService のテスト。
// 見積もり/支払い依頼メール送信後の案件更新と、Stripe Webhook からの
// 入金反映 (markNatoriCommissionPaid) の冪等性を固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAYMENT_LINK_PLACEHOLDER } from "@/features/natori/lib/orderMail";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
    constructor(_apiKey?: string) {}
  },
}));

const mockPricesCreate = vi.fn();
const mockLinksCreate = vi.fn();
const mockLinksUpdate = vi.fn();
vi.mock("stripe", () => ({
  default: class {
    prices = { create: (...args: unknown[]) => mockPricesCreate(...args) };
    paymentLinks = {
      create: (...args: unknown[]) => mockLinksCreate(...args),
      update: (...args: unknown[]) => mockLinksUpdate(...args),
    };
    constructor(_apiKey?: string) {}
  },
}));

const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
}));

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

/**
 * natori_projects テーブルのモック。update に渡された payload と filter を記録する。
 * updateRows: 条件付き UPDATE が返す行（省略時は1行更新成功、[] で0行=条件不一致）
 */
function projectsTable(
  row: unknown,
  options: { updateError?: unknown; updateRows?: unknown[] } = {}
) {
  const updates: Record<string, unknown>[] = [];
  const updateCalls: string[] = [];
  const api = {
    select: vi.fn(() => chainResult({ data: row, error: null })),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      const data = options.updateError
        ? null
        : options.updateRows ?? [{ id: (row as { id?: string })?.id ?? "row-1" }];
      return chainResult({ data, error: options.updateError ?? null }, updateCalls);
    }),
  };
  mockAdminFrom.mockImplementation((table: string) => {
    if (table !== "natori_projects") throw new Error(`unexpected table: ${table}`);
    return api;
  });
  return { api, updates, updateCalls };
}

function makeProjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    title: "立ち絵一式",
    client_name: "テスト太郎",
    amount: 8000,
    status: "inquiry",
    note: "既存メモ",
    payment_confirmed_at: null,
    payment_link_id: null,
    quoted_amount: null,
    ...overrides,
  };
}

async function loadService() {
  vi.resetModules();
  return await import("@/features/natori/server/orderMailService");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-resend-key");
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "natori-test@example.com");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  mockSend.mockResolvedValue({ error: null });
  mockPricesCreate.mockResolvedValue({ id: "price_test_1" });
  mockLinksCreate.mockResolvedValue({
    id: "plink_new",
    url: "https://pay.example.com/link-abc",
  });
  mockLinksUpdate.mockResolvedValue({ id: "plink_old", active: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ---------- markNatoriCommissionPaid (Webhook 入金反映) ---------- */

describe("markNatoriCommissionPaid", () => {
  it("入金でラフに進み、メモに記録し、ナトリへ通知メールを送る", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    const { updates, updateCalls } = projectsTable(
      makeProjectRow({ status: "awaiting_payment" })
    );

    const result = await markNatoriCommissionPaid("proj-1", "cs_test_123", 8000);

    expect(result).toEqual({ kind: "ok" });
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("rough");
    expect(updates[0].payment_confirmed_at).toBeTruthy();
    expect(String(updates[0].note)).toContain("既存メモ");
    expect(String(updates[0].note)).toContain("入金確認（Stripe）");
    expect(String(updates[0].note)).toContain("cs_test_123");

    // 冪等ゲート: payment_confirmed_at IS NULL を UPDATE の条件に含める
    expect(updateCalls).toContain('is("payment_confirmed_at",null)');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0] as { to: string[]; subject: string };
    expect(mail.to).toEqual(["natori-test@example.com"]);
    expect(mail.subject).toContain("入金確認");
  });

  it("冪等: 条件付き UPDATE が 0 行（既に入金確定済み）なら already-paid でメールも送らない", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    projectsTable(
      makeProjectRow({ payment_confirmed_at: "2026-07-10T00:00:00Z" }),
      { updateRows: [] }
    );

    const result = await markNatoriCommissionPaid("proj-1", "cs_test_123", 8000);

    expect(result).toEqual({ kind: "already-paid" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("同一 Checkout の completed → async_payment_succeeded でも入金反映と通知は1回だけ", async () => {
    const { markNatoriCommissionPaid } = await loadService();

    // 1通目 (completed): 未払い行に条件付き UPDATE が当たり1行更新
    projectsTable(makeProjectRow({ status: "awaiting_payment" }));
    const first = await markNatoriCommissionPaid("proj-1", "cs_test_123", 8000);
    expect(first).toEqual({ kind: "ok" });

    // 2通目 (async_payment_succeeded): 行は確定済みになっており UPDATE は0行
    projectsTable(
      makeProjectRow({
        status: "rough",
        payment_confirmed_at: "2026-07-16T00:00:00Z",
      }),
      { updateRows: [] }
    );
    const second = await markNatoriCommissionPaid("proj-1", "cs_test_123", 8000);
    expect(second).toEqual({ kind: "already-paid" });

    // 通知メールは1通目の1回だけ
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("案件が見つからなければ not-found", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    projectsTable(null);

    const result = await markNatoriCommissionPaid("missing", "cs_test_123", 8000);
    expect(result).toEqual({ kind: "not-found" });
  });

  it("入金額が quoted_amount と不一致なら rough に進めず、警告メモ + 要確認メール", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    const { updates } = projectsTable(
      makeProjectRow({ status: "awaiting_payment", quoted_amount: 12000 })
    );

    const result = await markNatoriCommissionPaid("proj-1", "cs_test_123", 5000);

    expect(result).toEqual({ kind: "amount-mismatch" });
    // ステータス・入金確定は書かず、警告メモの追記だけ
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBeUndefined();
    expect(updates[0].payment_confirmed_at).toBeUndefined();
    expect(String(updates[0].note)).toContain("要確認");
    expect(String(updates[0].note)).toContain("入金金額不一致");

    // 要確認メールがナトリ宛に飛ぶ
    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0] as { to: string[]; subject: string; text: string };
    expect(mail.to).toEqual(["natori-test@example.com"]);
    expect(mail.subject).toContain("要確認");
    expect(mail.text).toContain("cs_test_123");
  });

  it("入金額が quoted_amount と一致すれば通常どおり rough に進む", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    const { updates } = projectsTable(
      makeProjectRow({ status: "awaiting_payment", quoted_amount: 12000 })
    );

    const result = await markNatoriCommissionPaid("proj-1", "cs_test_123", 12000);
    expect(result).toEqual({ kind: "ok" });
    expect(updates[0].status).toBe("rough");
  });

  it("quoted_amount 未保存の既存案件は照合をスキップして通常どおり進む", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    const { updates } = projectsTable(
      makeProjectRow({ status: "awaiting_payment", quoted_amount: null })
    );

    const result = await markNatoriCommissionPaid("proj-1", "cs_test_123", 5000);
    expect(result).toEqual({ kind: "ok" });
    expect(updates[0].status).toBe("rough");
  });

  it("更新に失敗したら db-error を返し、通知メールは送らない", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    projectsTable(makeProjectRow(), { updateError: { message: "boom" } });

    const result = await markNatoriCommissionPaid("proj-1", "cs_test_123", 8000);
    expect(result).toEqual({ kind: "db-error" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("通知メールが失敗しても入金反映自体は ok（メールはベストエフォート）", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    projectsTable(makeProjectRow());
    mockSend.mockResolvedValue({ error: { message: "mail down" } });

    const result = await markNatoriCommissionPaid("proj-1", "cs_test_123", 8000);
    expect(result).toEqual({ kind: "ok" });
  });
});

/* ---------- sendNatoriOrderMail ---------- */

describe("sendNatoriOrderMail (estimate)", () => {
  it("見積もりメールを送り、案件を quoted に進めて送信ログを残す", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const { updates } = projectsTable(makeProjectRow({ status: "inquiry" }));

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "estimate",
      to: "client@example.com",
      subject: "お見積もり",
      body: "本文です",
      amount: 12000,
    });

    expect(result.kind).toBe("ok");
    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0] as { to: string[]; text: string };
    expect(mail.to).toEqual(["client@example.com"]);

    expect(updates).toHaveLength(1);
    expect(updates[0].amount).toBe(12000);
    expect(updates[0].status).toBe("quoted");
    expect(String(updates[0].note)).toContain("見積もりメール送信");
    expect(String(updates[0].note)).toContain("client@example.com");
  });

  it("すでに入金待ちの案件へ再送してもステータスを巻き戻さない", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const { updates } = projectsTable(makeProjectRow({ status: "awaiting_payment" }));

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "estimate",
      to: "client@example.com",
      subject: "お見積もり（再送）",
      body: "本文です",
      amount: 12000,
    });

    expect(result.kind).toBe("ok");
    expect(updates).toHaveLength(1);
    // ステータス変更は含まれない（送信ログと金額のみ）
    expect(updates[0].status).toBeUndefined();
  });

  it("RESEND_API_KEY 未設定なら not-configured で何もしない", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendNatoriOrderMail } = await loadService();
    projectsTable(makeProjectRow());

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "estimate",
      to: "client@example.com",
      subject: "お見積もり",
      body: "本文です",
      amount: 12000,
    });
    expect(result.kind).toBe("not-configured");
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("sendNatoriOrderMail (payment)", () => {
  it("1回限りの支払いリンクを発行して本文へ差し込み、awaiting_payment に進める", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const { updates } = projectsTable(makeProjectRow({ status: "quoted" }));

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "payment",
      to: "client@example.com",
      subject: "お支払いのご案内",
      body: `リンクはこちら\n${PAYMENT_LINK_PLACEHOLDER}\n以上`,
      amount: 12000,
    });

    expect(result).toEqual({ kind: "ok", paymentLinkUrl: "https://pay.example.com/link-abc" });

    // Payment Link は Webhook 分岐用 metadata と1回制限、二重発行防止の
    // idempotency key つきで作られる
    expect(mockPricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "jpy", unit_amount: 12000 }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("natori-plink:") })
    );
    expect(mockLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          kind: "natori_commission",
          projectId: "11111111-2222-3333-4444-555555555555",
        },
        restrictions: { completed_sessions: { limit: 1 } },
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("natori-plink:") })
    );

    // 初回発行（payment_link_id なし）では旧リンク無効化は呼ばれない
    expect(mockLinksUpdate).not.toHaveBeenCalled();

    // 本文のプレースホルダは実URLに置き換わって送信される
    const mail = mockSend.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain("https://pay.example.com/link-abc");
    expect(mail.text).not.toContain(PAYMENT_LINK_PLACEHOLDER);

    expect(updates[0].status).toBe("awaiting_payment");
    expect(String(updates[0].note)).toContain("https://pay.example.com/link-abc");
    // 発行した link.id と確定金額を保存（再発行時の無効化・入金金額照合に使う）
    expect(updates[0].payment_link_id).toBe("plink_new");
    expect(updates[0].quoted_amount).toBe(12000);
  });

  it("再発行時は旧 Payment Link を無効化してから新リンクを発行する", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const { updates } = projectsTable(
      makeProjectRow({ status: "awaiting_payment", payment_link_id: "plink_old", quoted_amount: 10000 })
    );

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "payment",
      to: "client@example.com",
      subject: "お支払いのご案内（再送）",
      body: PAYMENT_LINK_PLACEHOLDER,
      amount: 12000,
    });

    expect(result.kind).toBe("ok");
    expect(mockLinksUpdate).toHaveBeenCalledWith("plink_old", { active: false });
    // 無効化 → 新規発行 の順
    expect(mockLinksUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mockLinksCreate.mock.invocationCallOrder[0]
    );
    // 新しい link.id と金額で上書き
    expect(updates[0].payment_link_id).toBe("plink_new");
    expect(updates[0].quoted_amount).toBe(12000);
  });

  it("旧リンクが Stripe 側に無い（resource_missing）場合は無効化をスキップして続行する", async () => {
    const { sendNatoriOrderMail } = await loadService();
    projectsTable(makeProjectRow({ payment_link_id: "plink_gone" }));
    mockLinksUpdate.mockRejectedValue(
      Object.assign(new Error("No such payment link"), { code: "resource_missing" })
    );

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "payment",
      to: "client@example.com",
      subject: "お支払いのご案内",
      body: PAYMENT_LINK_PLACEHOLDER,
      amount: 12000,
    });

    expect(result.kind).toBe("ok");
    expect(mockLinksCreate).toHaveBeenCalledTimes(1);
  });

  it("旧リンクの無効化がその他のエラーで失敗したら中断（旧リンクを生かしたまま新発行しない）", async () => {
    const { sendNatoriOrderMail } = await loadService();
    projectsTable(makeProjectRow({ payment_link_id: "plink_old" }));
    mockLinksUpdate.mockRejectedValue(new Error("stripe down"));

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "payment",
      to: "client@example.com",
      subject: "お支払いのご案内",
      body: PAYMENT_LINK_PLACEHOLDER,
      amount: 12000,
    });

    expect(result.kind).toBe("stripe-error");
    expect(mockLinksCreate).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("Stripe のリンク生成に失敗したらメールを送らず stripe-error", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const { updates } = projectsTable(makeProjectRow({ status: "quoted" }));
    mockLinksCreate.mockRejectedValue(new Error("stripe down"));

    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "payment",
      to: "client@example.com",
      subject: "お支払いのご案内",
      body: PAYMENT_LINK_PLACEHOLDER,
      amount: 12000,
    });

    expect(result.kind).toBe("stripe-error");
    expect(mockSend).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
