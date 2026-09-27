import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// Real management authentication is exercised in the isolated Next/browser run.
vi.mock("@/features/natori/server/natoriManagementRoute", () => ({
  withNatoriManagement: (_name: string, _mutation: boolean, handler: (request: Request) => Promise<Response>) => handler,
}));
vi.mock("@/features/natori/server/notificationVerification", () => ({
  notificationVerificationAvailable: vi.fn(() => true), verifyNotificationMail: vi.fn(async () => []),
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })), getIpFromRequest: () => "isolated-test",
  rateLimitExceeded: () => new Response(null, { status: 429 }),
}));
import { verifyNotificationMail, notificationVerificationAvailable } from "@/features/natori/server/notificationVerification";
import { GET, POST } from "../route";

beforeEach(() => { vi.clearAllMocks(); vi.mocked(notificationVerificationAvailable).mockReturnValue(true); });
const request = (body: unknown, csrf = true) => new Request("https://example.invalid/api/natori/admin/notification-verification", {
  method: "POST", headers: { "Content-Type": "application/json", ...(csrf ? { "x-requested-with": "me-ish" } : {}) }, body: JSON.stringify(body),
});
describe("bounded verification HTTP input", () => {
  it.each([
    { purpose: "all", to: "other@example.invalid" }, { purpose: "all", projectId: "real-project" },
    { purpose: "all", idempotencyKey: "new-key" }, { purpose: "arbitrary" }, null,
  ])("rejects unapproved input before sending: %j", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(verifyNotificationMail).not.toHaveBeenCalled();
  });
  it("requires CSRF even while enabled", async () => {
    expect((await POST(request({ purpose: "all" }, false))).status).toBe(403); expect(verifyNotificationMail).not.toHaveBeenCalled();
  });
  it("never sends on GET", async () => {
    expect((await GET(new Request("https://example.invalid"))).status).toBe(200); expect(verifyNotificationMail).not.toHaveBeenCalled();
  });
  it("cannot use POST after closure", async () => {
    vi.mocked(notificationVerificationAvailable).mockReturnValue(false);
    expect((await POST(request({ purpose: "all" }))).status).toBe(404); expect(verifyNotificationMail).not.toHaveBeenCalled();
  });
});
