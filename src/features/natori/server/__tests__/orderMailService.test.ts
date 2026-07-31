// 見積版・支払いリンク・送信ログ・Stripe Webhook の安全性を固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAYMENT_LINK_PLACEHOLDER } from "@/features/natori/lib/orderMail";

vi.mock("server-only", () => ({}));

const {
  mockSend,
  mockPricesCreate,
  mockLinksCreate,
  mockLinksUpdate,
  mockAdminFrom,
  mockRpc,
} = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockPricesCreate: vi.fn(),
  mockLinksCreate: vi.fn(),
  mockLinksUpdate: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
    constructor(_apiKey?: string) {}
  },
}));

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

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriActingUserId: vi.fn().mockResolvedValue("owner-1"),
}));

type Result = { data: unknown; error: unknown; count?: number | null };

function chainResult(result: Result, calls: string[] = []) {
  const chain: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (resolve: (value: Result) => void) => resolve(result);
        if (prop === "single" || prop === "maybeSingle") {
          return vi.fn().mockResolvedValue(result);
        }
        return (...args: unknown[]) => {
          calls.push(`${String(prop)}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
          return chain;
        };
      },
    }
  );
  return chain;
}

type DbOptions = {
  quote?: unknown;
  projectUpdateResults?: Result[];
  logInsertError?: unknown;
};

function installDb(project: unknown, options: DbOptions = {}) {
  const projectUpdates: Record<string, unknown>[] = [];
  const projectUpdateCalls: string[][] = [];
  const mailLogInserts: Record<string, unknown>[] = [];
  const mailLogUpdates: Record<string, unknown>[] = [];
  const ledgerInserts: Record<string, unknown>[] = [];
  let projectUpdateIndex = 0;

  const projectsApi = {
    select: vi.fn(() => chainResult({ data: project, error: null })),
    update: vi.fn((payload: Record<string, unknown>) => {
      projectUpdates.push(payload);
      const calls: string[] = [];
      projectUpdateCalls.push(calls);
      const result = options.projectUpdateResults?.[projectUpdateIndex] ?? {
        data: [{ id: (project as { id?: string } | null)?.id ?? "proj-1" }],
        error: null,
      };
      projectUpdateIndex += 1;
      return chainResult(result, calls);
    }),
  };
  const quotesApi = {
    select: vi.fn(() => chainResult({ data: options.quote ?? null, error: null })),
  };
  const logsApi = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      mailLogInserts.push(payload);
      return chainResult({ data: null, error: options.logInsertError ?? null });
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      mailLogUpdates.push(payload);
      return chainResult({ data: null, error: null });
    }),
  };
  const ledgerApi = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      ledgerInserts.push(payload);
      return chainResult({ data: null, error: null });
    }),
  };

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "natori_projects") return projectsApi;
    if (table === "natori_quotes") return quotesApi;
    if (table === "natori_order_mail_logs") return logsApi;
    if (table === "natori_payment_transactions") return ledgerApi;
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    projectsApi,
    logsApi,
    projectUpdates,
    projectUpdateCalls,
    mailLogInserts,
    mailLogUpdates,
    ledgerInserts,
  };
}

function makeProjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    user_id: "owner-1",
    title: "立ち絵一式",
    client_name: "テスト太郎",
    amount: 8000,
    type: "standing",
    status: "inquiry",
    note: "既存メモ",
    payment_confirmed_at: null,
    payment_link_id: null,
    payment_link_url: null,
    payment_link_status: null,
    payment_quote_id: null,
    active_quote_id: null,
    quoted_amount: null,
    stripe_payment_session_id: null,
    client_email: "client@example.com",
    ...overrides,
  };
}

const acceptedQuote = {
  id: "quote-1",
  amount: 12000,
  accepted_at: "2026-07-19T00:00:00Z",
  superseded_at: null,
};

async function loadService() {
  vi.resetModules();
  return import("@/features/natori/server/orderMailService");
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
  mockRpc.mockResolvedValue({ data: "quote-1", error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe("markNatoriCommissionPaid", () => {
  it("does not advance an undecided project after a Stripe payment", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    installDb(makeProjectRow({ type: "undecided", status: "awaiting_payment" }));
    await expect(
      markNatoriCommissionPaid("proj-1", "cs_test_undecided", 8000)
    ).resolves.toEqual({ kind: "db-error" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("入金を一度だけ確定し、受領額・session・台帳を残す", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    installDb(makeProjectRow({
      status: "awaiting_payment",
      quoted_amount: 8000,
      payment_quote_id: "quote-1",
    }));
    mockRpc.mockResolvedValue({
      data: [{ result: "received", advanced: true, new_event: true, recorded_amount: 8000 }],
      error: null,
    });

    await expect(markNatoriCommissionPaid("proj-1", "cs_test_123", 8000)).resolves.toEqual({ kind: "ok" });
    expect(mockRpc).toHaveBeenCalledWith("natori_record_stripe_payment", {
      p_project_id: "proj-1",
      p_session_id: "cs_test_123",
      p_amount: 8000,
      p_quote_id: null,
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("同じsessionのWebhook再送はalready-paidで通知も台帳追加もしない", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    installDb(
      makeProjectRow({
        payment_confirmed_at: "2026-07-20T00:00:00Z",
        stripe_payment_session_id: "cs_test_123",
      })
    );
    mockRpc.mockResolvedValue({
      data: [{ result: "already-paid", advanced: false, new_event: false, recorded_amount: 8000 }],
      error: null,
    });
    await expect(markNatoriCommissionPaid("proj-1", "cs_test_123", 8000)).resolves.toEqual({ kind: "already-paid" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("別sessionの追加入金は重複入金として台帳と警告を残す", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    installDb(
      makeProjectRow({
        payment_confirmed_at: "2026-07-20T00:00:00Z",
        stripe_payment_session_id: "cs_original",
      })
    );
    mockRpc.mockResolvedValue({
      data: [{ result: "duplicate-payment", advanced: false, new_event: true, recorded_amount: 8000 }],
      error: null,
    });
    await expect(markNatoriCommissionPaid("proj-1", "cs_second", 8000)).resolves.toEqual({ kind: "already-paid" });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("金額不一致は入金確定せず、監査台帳へ記録する", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    installDb(makeProjectRow({ quoted_amount: 12000, payment_quote_id: "quote-1" }));
    mockRpc.mockResolvedValue({
      data: [{ result: "amount-mismatch", advanced: false, new_event: true, recorded_amount: 5000 }],
      error: null,
    });
    await expect(markNatoriCommissionPaid("proj-1", "cs_mismatch", 5000)).resolves.toEqual({ kind: "amount-mismatch" });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("旧見積もりのリンクからの入金は制作開始せず警告する", async () => {
    const { markNatoriCommissionPaid } = await loadService();
    installDb(makeProjectRow({ payment_quote_id: "quote-current" }));
    mockRpc.mockResolvedValue({
      data: [{ result: "quote-mismatch", advanced: false, new_event: true, recorded_amount: 12000 }],
      error: null,
    });
    await expect(
      markNatoriCommissionPaid("proj-1", "cs_stale", 12000, "quote-old")
    ).resolves.toEqual({ kind: "quote-mismatch" });
    expect(mockRpc).toHaveBeenCalledWith("natori_record_stripe_payment", expect.objectContaining({
      p_quote_id: "quote-old",
    }));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe("sendNatoriOrderMail (estimate)", () => {
  it("does not issue a quote while the project type is undecided", async () => {
    const { sendNatoriOrderMail } = await loadService();
    installDb(makeProjectRow({ type: "undecided" }));
    await expect(
      sendNatoriOrderMail({
        projectId: "proj-1",
        kind: "estimate",
        to: "client@example.com",
        subject: "見積",
        body: "本文",
        amount: 12000,
      })
    ).resolves.toEqual({ kind: "invalid-state" });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("不変な見積版とpendingログをメール前に保存し、成功後にsentへ進める", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const db = installDb(makeProjectRow());
    const result = await sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "estimate",
      to: "client@example.com",
      subject: "お見積もり",
      body: "本文です",
      amount: 12000,
    });

    expect(result.kind).toBe("ok");
    expect(mockRpc).toHaveBeenCalledWith("natori_issue_quote", expect.objectContaining({
      p_user_id: "owner-1",
      p_amount: 12000,
      p_body_snapshot: "本文です",
    }));
    expect(db.mailLogInserts[0]).toMatchObject({ status: "pending", quote_id: "quote-1", sent_at: null });
    expect(db.logsApi.insert.mock.invocationCallOrder[0]).toBeLessThan(mockSend.mock.invocationCallOrder[0]);
    expect(db.mailLogUpdates).toContainEqual(expect.objectContaining({ status: "sent" }));
    const mail = mockSend.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain("/natori/quote/");
  });

  it("pendingログを保存できなければメールを送らない", async () => {
    const { sendNatoriOrderMail } = await loadService();
    installDb(makeProjectRow(), { logInsertError: { message: "log down" } });
    await expect(sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "estimate",
      to: "client@example.com",
      subject: "お見積もり",
      body: "本文です",
      amount: 12000,
    })).resolves.toEqual({ kind: "db-error" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("メール失敗をfailedとして記録し、案件をquotedに進めない", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const db = installDb(makeProjectRow());
    mockSend.mockResolvedValue({ error: { message: "mail down" } });
    await expect(sendNatoriOrderMail({
      projectId: "proj-1",
      kind: "estimate",
      to: "client@example.com",
      subject: "お見積もり",
      body: "本文です",
      amount: 12000,
    })).resolves.toEqual({ kind: "mail-error" });
    expect(db.mailLogUpdates).toContainEqual(expect.objectContaining({ status: "failed" }));
    expect(db.projectUpdates.some((update) => update.status === "quoted")).toBe(false);
  });
});

describe("sendNatoriOrderMail (payment)", () => {
  const input = {
    projectId: "proj-1",
    kind: "payment" as const,
    to: "client@example.com",
    subject: "お支払いのご案内",
    body: PAYMENT_LINK_PLACEHOLDER,
    amount: 12000,
  };

  it("承諾済み見積版と同額の場合だけ1回制限リンクを発行し、メール前に保存する", async () => {
    const { sendNatoriOrderMail } = await loadService();
    const db = installDb(makeProjectRow({ status: "quoted", active_quote_id: "quote-1" }), {
      quote: acceptedQuote,
    });
    await expect(sendNatoriOrderMail(input)).resolves.toEqual({
      kind: "ok",
      paymentLinkUrl: "https://pay.example.com/link-abc",
    });
    expect(mockLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ projectId: expect.any(String), quoteId: "quote-1" }),
        restrictions: { completed_sessions: { limit: 1 } },
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining(":quote-1:12000:link") })
    );
    const persisted = db.projectUpdates.find((update) => update.payment_link_id === "plink_new");
    expect(persisted).toMatchObject({
      payment_link_url: "https://pay.example.com/link-abc",
      payment_quote_id: "quote-1",
      quoted_amount: 12000,
    });
    expect(db.projectsApi.update.mock.invocationCallOrder[1]).toBeLessThan(mockSend.mock.invocationCallOrder[0]);
  });

  it("同じ見積版への再送は既存リンクを再利用し、Stripeで二重発行しない", async () => {
    const { sendNatoriOrderMail } = await loadService();
    installDb(makeProjectRow({
      status: "awaiting_payment",
      active_quote_id: "quote-1",
      payment_quote_id: "quote-1",
      payment_link_id: "plink_existing",
      payment_link_url: "https://pay.example.com/existing",
      payment_link_status: "sent",
      quoted_amount: 12000,
    }), { quote: acceptedQuote });
    await expect(sendNatoriOrderMail(input)).resolves.toEqual({
      kind: "ok",
      paymentLinkUrl: "https://pay.example.com/existing",
    });
    expect(mockPricesCreate).not.toHaveBeenCalled();
    expect(mockLinksCreate).not.toHaveBeenCalled();
    const mail = mockSend.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain("https://pay.example.com/existing");
  });

  it("未承諾・金額相違・入金済みでは支払いリンクを発行しない", async () => {
    const { sendNatoriOrderMail } = await loadService();
    installDb(makeProjectRow({ status: "quoted", active_quote_id: "quote-1" }));
    await expect(sendNatoriOrderMail(input)).resolves.toEqual({ kind: "quote-not-accepted" });

    installDb(makeProjectRow({ status: "quoted", active_quote_id: "quote-1" }), {
      quote: { ...acceptedQuote, amount: 13000 },
    });
    await expect(sendNatoriOrderMail(input)).resolves.toEqual({ kind: "amount-mismatch" });

    installDb(makeProjectRow({
      status: "awaiting_payment",
      active_quote_id: "quote-1",
      payment_confirmed_at: "2026-07-20T00:00:00Z",
    }), { quote: acceptedQuote });
    await expect(sendNatoriOrderMail(input)).resolves.toEqual({ kind: "already-paid" });
    expect(mockLinksCreate).not.toHaveBeenCalled();
  });
});
