import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExpire } = vi.hoisted(() => ({
  mockExpire: vi.fn(),
}));

vi.mock("@/features/natori/server/paymentLinkExpiryService", () => ({
  expireNatoriPaymentLinks: (...args: unknown[]) => mockExpire(...args),
}));

import { GET } from "@/app/api/cron/natori-payment-expiry/route";

function request(headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/cron/natori-payment-expiry", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("ADMIN_API_TOKEN", "admin-secret");
  mockExpire.mockResolvedValue({
    kind: "ok",
    scanned: 2,
    expired: 1,
    skipped: 1,
    failed: 0,
  });
});

describe("GET /api/cron/natori-payment-expiry", () => {
  it("認証なしは401で失効処理を呼ばない", async () => {
    const res = await GET(request() as never);
    expect(res.status).toBe(401);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("CRON_SECRETで認証して失効結果を返す", async () => {
    const res = await GET(
      request({ authorization: "Bearer cron-secret" }) as never
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      kind: "ok",
      scanned: 2,
      expired: 1,
    });
    expect(mockExpire).toHaveBeenCalledTimes(1);
  });
});
