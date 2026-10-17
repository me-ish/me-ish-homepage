import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const send = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/server/natoriManagementRoute", () => ({
  withNatoriManagement: (_name: string, _write: boolean, handler: (request: Request) => Promise<Response>) => handler,
}));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: async () => true }));
vi.mock("@/features/natori/server/orderMailService", () => ({ sendNatoriOrderMail: send }));

import { POST } from "../route";

beforeEach(() => vi.clearAllMocks());
describe("delivery expiry race response", () => {
  it("asks for confirmation with a dedicated 409 code instead of offering another extension", async () => {
    send.mockResolvedValue({ kind: "delivery-expiry-changed" });
    const response = await POST(new Request("https://example.invalid/api/natori/admin/order-mail", {
      method: "POST", headers: { "x-requested-with": "me-ish", "content-type": "application/json" },
      body: JSON.stringify({ kind: "delivery", projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        to: "client@example.invalid", subject: "Synthetic", body: "Synthetic", amount: 1000,
        operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", fileIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"] }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "delivery_expiry_changed",
      error: "納品ページの保存期限が更新されました。最新の期限を確認してから、もう一度送信してください。" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
