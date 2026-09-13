import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockLinksUpdate, mockAdminFrom } = vi.hoisted(() => ({
  mockLinksUpdate: vi.fn(),
  mockAdminFrom: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class {
    paymentLinks = {
      update: (...args: unknown[]) => mockLinksUpdate(...args),
    };
    constructor(_apiKey?: string) {}
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

type Result = { data: unknown; error: unknown };

function chain(result: Result) {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (resolve: (value: Result) => void) => resolve(result);
        if (prop === "maybeSingle") return vi.fn().mockResolvedValue(result);
        return () => proxy;
      },
    }
  );
  return proxy;
}

function installDb(sentAt: string) {
  const projectUpdates: Record<string, unknown>[] = [];
  const project = {
    id: "proj-1",
    payment_link_id: "plink_1",
    payment_link_url: "https://buy.stripe.com/test",
  };

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "natori_projects") {
      return {
        select: vi.fn(() => chain({ data: [project], error: null })),
        update: vi.fn((payload: Record<string, unknown>) => {
          projectUpdates.push(payload);
          return chain({ data: { id: "proj-1" }, error: null });
        }),
      };
    }
    if (table === "natori_order_mail_logs") {
      return {
        select: vi.fn(() => chain({ data: { sent_at: sentAt }, error: null })),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { projectUpdates };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  mockLinksUpdate.mockResolvedValue({ id: "plink_1", active: false });
});

describe("expireNatoriPaymentLinks", () => {
  it("最後の支払い案内から7日経過した未入金リンクを停止してvoidにする", async () => {
    const db = installDb("2026-09-01T00:00:00.000Z");
    const { expireNatoriPaymentLinks } = await import(
      "@/features/natori/server/paymentLinkExpiryService"
    );

    await expect(
      expireNatoriPaymentLinks(new Date("2026-09-08T00:00:00.000Z"))
    ).resolves.toEqual({ kind: "ok", scanned: 1, expired: 1, skipped: 0, failed: 0 });

    expect(mockLinksUpdate).toHaveBeenCalledWith(
      "plink_1",
      expect.objectContaining({
        active: false,
        inactive_message: expect.stringContaining("お支払い期限が切れています"),
      })
    );
    expect(db.projectUpdates).toContainEqual({ payment_link_status: "void" });
  });

  it("7日未満ならリンクを停止しない", async () => {
    installDb("2026-09-02T00:00:00.000Z");
    const { expireNatoriPaymentLinks } = await import(
      "@/features/natori/server/paymentLinkExpiryService"
    );

    await expect(
      expireNatoriPaymentLinks(new Date("2026-09-08T00:00:00.000Z"))
    ).resolves.toEqual({ kind: "ok", scanned: 1, expired: 0, skipped: 1, failed: 0 });
    expect(mockLinksUpdate).not.toHaveBeenCalled();
  });

  it("Stripe停止に失敗した案件はvoidにせずfailedとして継続する", async () => {
    const db = installDb("2026-09-01T00:00:00.000Z");
    mockLinksUpdate.mockRejectedValue(new Error("stripe down"));
    const { expireNatoriPaymentLinks } = await import(
      "@/features/natori/server/paymentLinkExpiryService"
    );

    await expect(
      expireNatoriPaymentLinks(new Date("2026-09-08T00:00:00.000Z"))
    ).resolves.toEqual({ kind: "ok", scanned: 1, expired: 0, skipped: 0, failed: 1 });
    expect(db.projectUpdates).toHaveLength(0);
  });
});
