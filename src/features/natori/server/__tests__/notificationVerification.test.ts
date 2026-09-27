import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: vi.fn(() => { throw new Error("BUSINESS_DB_FORBIDDEN"); }) }));
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyNotificationMail, notificationVerificationAvailable } from "../notificationVerification";
import type { NotificationTransport, NotificationPayload } from "../acceptanceNotifications";

const recipient = "natori.o0716@gmail.com";
const from = "ナトリ（me-ish） <noreply@me-ish.art>";
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
  vi.stubEnv("NATORI_NOTIFICATION_VERIFY_ENABLED", "1"); vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NATORI_ORDER_MAIL_FROM", from); vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", recipient);
  vi.stubEnv("NATORI_MAIL_BCC", ""); vi.stubEnv("NATORI_ACCEPTANCE_OUTBOX_ENABLED", "0");
  vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "0"); vi.clearAllMocks();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the single explicitly authorized real-mail campaign", () => {
  it.each(["", "0"])("is closed without the flag (%s)", async flag => {
    vi.stubEnv("NATORI_NOTIFICATION_VERIFY_ENABLED", flag); const send = vi.fn();
    await expect(verifyNotificationMail("all", send)).rejects.toThrow("verification_closed"); expect(send).not.toHaveBeenCalled();
  });
  it.each(["2026-09-27T08:59:59Z", "2026-09-27T18:00:00Z", "2026-09-28T10:00:00Z"])("rejects %s before transport", async time => {
    vi.setSystemTime(new Date(time)); const send = vi.fn();
    expect(notificationVerificationAvailable()).toBe(false);
    await expect(verifyNotificationMail("all", send)).rejects.toThrow("verification_closed"); expect(send).not.toHaveBeenCalled();
  });
  it("cannot send from an automatically created Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); const send = vi.fn();
    await expect(verifyNotificationMail("all", send)).rejects.toThrow("verification_closed"); expect(send).not.toHaveBeenCalled();
  });
  it.each([["NATORI_PORTFOLIO_CONTACT_TO", "other@example.invalid"], ["NATORI_ORDER_MAIL_FROM", "other@example.invalid"], ["NATORI_MAIL_BCC", "extra@example.invalid"]])("rejects altered %s before ANY provider call", async (key, value) => {
    vi.stubEnv(key, value); const send = vi.fn();
    await expect(verifyNotificationMail("all", send)).rejects.toThrow("verification_configuration"); expect(send).not.toHaveBeenCalled();
  });
  it("uses the actual HTTP sender, three fixed recipient payloads and three stable keys without a DB", async () => {
    const requests: { payload: NotificationPayload; key: string }[] = [];
    vi.stubEnv("RESEND_API_KEY", "synthetic-not-a-real-key");
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.resend.com/emails"); expect(init.redirect).toBe("error");
      const headers = init.headers as Record<string, string>;
      requests.push({ payload: JSON.parse(String(init.body)), key: headers["Idempotency-Key"] });
      return new Response(JSON.stringify({ id: "synthetic-provider-id" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await verifyNotificationMail("all");
    expect(result).toHaveLength(3); expect(result.every(r => r.status === "sent" && r.acceptedAt)).toBe(true);
    expect(new Set(requests.map(r => r.key)).size).toBe(3);
    for (const { payload } of requests) {
      expect(payload.to).toEqual([recipient]); expect(payload.reply_to).toBe(recipient);
      expect(payload.from).toBe(from); expect(payload.bcc).toBeUndefined();
      expect(payload.subject).toMatch(/^【テスト・対応不要】/); expect(payload.text).toContain("実際のご依頼・承諾・納品・請求ではありません");
    }
    expect(JSON.stringify(result)).not.toMatch(/provider|gmail|snapshot|payload|token/);
    expect(supabaseAdmin).not.toHaveBeenCalled();
    expect(process.env.NATORI_ACCEPTANCE_OUTBOX_ENABLED).toBe("0"); expect(process.env.NATORI_NOTIFICATION_SENDING_ENABLED).toBe("0");
  });
  it("replays the identical three requests under concurrency and after an unknown result", async () => {
    const accepted = new Map<string, string>(); let unknown = true;
    const send: NotificationTransport = async (payload, key) => {
      const body = JSON.stringify(payload); expect(accepted.get(key) ?? body).toBe(body); accepted.set(key, body);
      return unknown ? { status: "unknown", errorCode: "provider_unknown" } : { status: "sent", providerId: "same-provider-id" };
    };
    const initial = await verifyNotificationMail("all", send); expect(initial.every(r => r.status === "unknown")).toBe(true);
    unknown = false; await Promise.all(Array.from({ length: 6 }, () => verifyNotificationMail("all", send)));
    expect(accepted.size).toBe(3); expect(supabaseAdmin).not.toHaveBeenCalled();
  });
  it("retries only the selected notification with its original key", async () => {
    const send = vi.fn<NotificationTransport>().mockResolvedValue({ status: "sent", providerId: "synthetic" });
    await verifyNotificationMail("all", send); const before = send.mock.calls[2]; send.mockClear();
    await verifyNotificationMail("delivery_accept_client", send); expect(send.mock.calls).toEqual([before]);
  });
  it("stops before another request if the hard window expires mid-sequence", async () => {
    const send = vi.fn<NotificationTransport>().mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-09-27T18:00:00Z")); return { status: "sent", providerId: "synthetic" };
    });
    await expect(verifyNotificationMail("all", send)).rejects.toThrow("verification_closed"); expect(send).toHaveBeenCalledTimes(1);
  });
});
