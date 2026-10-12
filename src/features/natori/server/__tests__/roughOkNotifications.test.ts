import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc: m.rpc }) }));
import { buildAcceptanceNotificationPayload, dispatchAcceptanceNotification, sendAcceptanceNotification, type NotificationPayload } from "../acceptanceNotifications";
import type { NatoriNotificationRow } from "@/types/supabase";
const nid = "88888888-bbbb-4ccc-8ddd-eeeeeeeeeeee", rid = "99999999-bbbb-4ccc-8ddd-eeeeeeeeeeee", pid = "11111111-2222-4333-8444-555555555555";
const stamp = "2026-10-12T00:00:00Z";
const snapshot = { roughId: rid, projectId: pid, title: "Original rough project", clientName: "Synthetic client", beforeQuote: true, clientOkAt: stamp };
let job: NatoriNotificationRow;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(stamp));
  vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "1"); vi.stubEnv("NATORI_ACCEPTANCE_OUTBOX_ENABLED", "0");
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "staff@example.invalid"); vi.stubEnv("NATORI_ORDER_MAIL_FROM", "Fixture <sender@example.invalid>");
  vi.stubEnv("NATORI_MAIL_BCC", ""); vi.stubEnv("RESEND_API_KEY", "synthetic-never-sent");
  job = { id: nid, notification_key: `rough_ok/${rid}`, attempt_no: 1, project_id: pid, quote_id: null, purpose: "rough_ok_artist", snapshot,
    payload: null, status: "pending", claim_token: null, lease_expires_at: null, claim_count: 0, send_started_at: null, retry_after: null,
    provider_id: null, sent_at: null, error_code: null, created_at: stamp, updated_at: stamp };
  m.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "natori_notification_claim_v1") return { data: [{ ...job }], error: null };
    if (name === "natori_notification_start_v1") {
      job = { ...job, payload: args.p_payload as NotificationPayload, send_started_at: job.send_started_at ?? stamp, lease_expires_at: "2026-10-12T00:02:00Z" };
      return { data: [{ ...job }], error: null };
    }
    return { data: true, error: null };
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("rough OK immutable notice payload", () => {
  it("has a staff-only destination and snapshot identity, while explicitly excluding quote/payment consent", () => {
    const payload = buildAcceptanceNotificationPayload(job);
    expect(payload.from).toBe("Fixture <sender@example.invalid>"); expect(payload.to).toEqual(["staff@example.invalid"]); expect(payload.reply_to).toBe("staff@example.invalid");
    expect(payload.subject).toContain("参考ラフ"); expect(payload.text).toContain(snapshot.title); expect(payload.text).toContain(snapshot.clientName);
    expect(payload.text).toContain(rid); expect(payload.text).toContain(stamp); expect(payload.text).toContain(`?project=${pid}&view=conversation`);
    expect(payload.text).toContain("見積もりの承認やお支払いではありません"); expect(payload.headers["X-Meish-Template"]).toBe("natori-rough_ok_artist");
  });
  it.each(["NATORI_PORTFOLIO_CONTACT_TO", "NATORI_ORDER_MAIL_FROM"])("does not use a fallback for missing %s", key => {
    vi.stubEnv(key, ""); expect(() => buildAcceptanceNotificationPayload(job)).toThrow("mail_configuration");
  });
  it("reuses the frozen exact payload even after configuration or current project metadata change", () => {
    const payload = buildAcceptanceNotificationPayload(job); vi.stubEnv("NATORI_ORDER_MAIL_FROM", ""); vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "changed@example.invalid");
    expect(buildAcceptanceNotificationPayload({ ...job, snapshot: {}, payload })).toEqual(payload);
  });
});

describe("rough OK durable worker transport", () => {
  it("keeps configuration failure visible without sending or deleting the job", async () => {
    vi.stubEnv("NATORI_ORDER_MAIL_FROM", ""); const transport = vi.fn();
    await dispatchAcceptanceNotification(nid, false, transport);
    expect(transport).not.toHaveBeenCalled(); expect(m.rpc.mock.calls.some(([name]) => name === "natori_notification_start_v1")).toBe(false);
    expect(m.rpc).toHaveBeenLastCalledWith("natori_notification_finish_v1", expect.objectContaining({ p_id: nid, p_status: "failed", p_error_code: "mail_configuration" }));
    expect(job.snapshot).toEqual(snapshot); expect(job.payload).toBeNull();
  });
  it("uses the same idempotency key and frozen payload after unknown and process death", async () => {
    const sent: { payload: NotificationPayload; key: string }[] = [];
    const transport = vi.fn(async (payload: NotificationPayload, key: string) => { sent.push({ payload, key }); return { status: "unknown" as const, errorCode: "provider_unknown" }; });
    await dispatchAcceptanceNotification(nid, false, transport);
    const frozen = job.payload; const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "changed@example.invalid");
    await dispatchAcceptanceNotification(nid, true, async (payload, key) => { sent.push({ payload, key }); throw new Error("process stopped"); });
    expect(m.rpc).toHaveBeenLastCalledWith("natori_notification_start_v1", expect.objectContaining({ p_payload: frozen }));
    await dispatchAcceptanceNotification(nid, true, transport);
    expect(sent).toHaveLength(3); expect(sent.every(entry => entry.key === `natori-notice/${nid}` && JSON.stringify(entry.payload) === JSON.stringify(frozen))).toBe(true);
    expect(job.snapshot).toEqual(snapshot); spy.mockRestore();
  });
  it("cannot turn a rejection on replay into proof an interrupted send failed", async () => {
    job.send_started_at = stamp; job.payload = buildAcceptanceNotificationPayload(job);
    await dispatchAcceptanceNotification(nid, true, async () => ({ status: "failed", errorCode: "provider_rejected" }));
    expect(m.rpc).toHaveBeenLastCalledWith("natori_notification_finish_v1", expect.objectContaining({ p_status: "unknown", p_error_code: "provider_unknown" }));
  });
  it("sending pause preserves the queued job without claiming it", async () => {
    vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "0"); const transport = vi.fn(); await dispatchAcceptanceNotification(nid, false, transport);
    expect(m.rpc).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled(); expect(job.status).toBe("pending");
  });
  it.each([[422, "failed"], [500, "unknown"], [503, "unknown"], [409, "unknown"]])("classifies mocked provider HTTP %s as %s", async (status, expected) => {
    const fetcher = vi.fn(async () => new Response("{}", { status: status as number })); vi.stubGlobal("fetch", fetcher);
    expect(await sendAcceptanceNotification(buildAcceptanceNotificationPayload(job), `natori-notice/${nid}`)).toMatchObject({ status: expected });
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": `natori-notice/${nid}` }) }));
  });
  it("classifies timeout as unknown and missing API key as definite configuration failure", async () => {
    const fetcher = vi.fn(async () => { throw new Error("timeout"); }); vi.stubGlobal("fetch", fetcher);
    const payload = buildAcceptanceNotificationPayload(job);
    expect(await sendAcceptanceNotification(payload, nid)).toEqual({ status: "unknown", errorCode: "provider_unknown" });
    vi.stubEnv("RESEND_API_KEY", ""); fetcher.mockClear();
    expect(await sendAcceptanceNotification(payload, nid)).toEqual({ status: "failed", errorCode: "mail_configuration" }); expect(fetcher).not.toHaveBeenCalled();
  });
});
