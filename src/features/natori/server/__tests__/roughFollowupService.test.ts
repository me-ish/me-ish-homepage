import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), owner: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc: m.rpc }) }));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: m.owner }));
vi.mock("../acceptanceNotifications", () => ({ notificationSendingEnabled: () => process.env.NATORI_NOTIFICATION_SENDING_ENABLED === "1", dispatchAcceptanceNotification: m.dispatch }));
import { acknowledgeStaffRoughOk, loadStaffRoughOks, retryStaffRoughOkNotification } from "../roughFollowupService";
const pid = "11111111-2222-4333-8444-555555555555", rid = "99999999-bbbb-4ccc-8ddd-eeeeeeeeeeee", mid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", nid = "88888888-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const stamp = "2026-10-12T00:00:00Z", acknowledged = "2026-10-12T01:00:00Z";
const row = (patch: Record<string, unknown> = {}) => ({ rough_id: rid, message_id: mid, before_quote: true, client_ok_at: stamp, acknowledged_at: null, notification_id: nid,
  notification_status: "pending", notification_attempt_no: 1, notification_sent_at: null, notification_claim_count: 0,
  notification_lease_expires_at: null, notification_send_started_at: null, notification_retry_after: null, ...patch });
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T02:00:00Z")); m.owner.mockResolvedValue(mid); vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "1"); vi.stubEnv("NATORI_ACCEPTANCE_OUTBOX_ENABLED", "0"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("mandatory owner rough OK read", () => {
  it("retains multiple immutable OKs and specific acknowledgements with mail retry separate", async () => {
    m.rpc.mockResolvedValue({ data: [row({ acknowledged_at: acknowledged, notification_status: "failed" }), row({ rough_id: nid, notification_status: "sent", notification_sent_at: acknowledged })], error: null });
    const result = await loadStaffRoughOks(mid, pid);
    expect(m.rpc).toHaveBeenCalledWith("natori_rough_ok_list_v1", { p_owner_id: mid, p_project_id: pid });
    expect(result).toHaveLength(2);
    expect(result?.[0]).toMatchObject({ acknowledgedAt: acknowledged, notificationStatus: "failed", retryAvailable: true });
    expect(result?.[1]).toMatchObject({ acknowledgedAt: null, notificationStatus: "sent", retryAvailable: false });
    expect(JSON.stringify(result)).not.toMatch(/email|payload|snapshot|owner/);
  });
  it("preserves legacy OKs without fabricating a ledger or queuing a mail", async () => {
    m.rpc.mockResolvedValue({ data: [row({ notification_id: null, notification_status: null, notification_attempt_no: null, notification_claim_count: null })], error: null });
    expect((await loadStaffRoughOks(mid, pid))?.[0]).toMatchObject({ notificationId: null, notificationStatus: null, retryAvailable: false });
    expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("normalizes an expired sending lease to unknown but blocks active leases/cooldown/manual review", async () => {
    m.rpc.mockResolvedValue({ data: [row({ notification_status: "sending", notification_lease_expires_at: "2026-10-12T01:59:00Z", notification_send_started_at: "2026-10-12T01:58:00Z" })], error: null });
    expect((await loadStaffRoughOks(mid, pid))?.[0]).toMatchObject({ notificationStatus: "unknown", retryAvailable: true });
    for (const patch of [{ notification_lease_expires_at: "2026-10-12T02:01:00Z" }, { notification_retry_after: "2026-10-12T02:01:00Z" }, { notification_claim_count: 8 }, { notification_status: "failed", notification_attempt_no: 5 }, { notification_status: "unknown", notification_send_started_at: "2026-10-11T00:00:00Z" }]) {
      m.rpc.mockResolvedValue({ data: [row(patch)], error: null });
      expect((await loadStaffRoughOks(mid, pid))?.[0].retryAvailable).toBe(false);
    }
  });
  it.each([null, [], undefined, {}, { data: [] }, { data: [], error: false }, { data: [], error: undefined }, { data: null, error: null }, { data: [], error: { code: "PGRST202" } }])("does not turn unavailable/malformed envelopes into an empty history %#", async response => {
    m.rpc.mockResolvedValue(response); expect(await loadStaffRoughOks(mid, pid)).toBeNull();
  });
  it.each([{ client_ok_at: "bad" }, { notification_attempt_no: 0 }, { notification_attempt_no: 6 }, { notification_claim_count: 9 }, { notification_status: "invented" },
    { notification_status: "sent" }, { notification_status: "pending", notification_sent_at: stamp }, { acknowledged_at: "2026-10-11T00:00:00Z" }, { notification_id: null }])("rejects malformed job/fact metadata %#", async patch => {
    m.rpc.mockResolvedValue({ data: [row(patch)], error: null }); expect(await loadStaffRoughOks(mid, pid)).toBeNull();
  });
  it("accepts a proven empty list and rejects duplicate rough identities", async () => {
    m.rpc.mockResolvedValueOnce({ data: [], error: null }); expect(await loadStaffRoughOks(mid, pid)).toEqual([]);
    m.rpc.mockResolvedValueOnce({ data: [row(), row()], error: null }); expect(await loadStaffRoughOks(mid, pid)).toBeNull();
  });
});

describe("specific owner acknowledgement", () => {
  it("acknowledges exactly one rough, also on a closed project, and supports idempotent replay", async () => {
    m.rpc.mockResolvedValueOnce({ data: [{ result: "acknowledged", acknowledged_at: acknowledged }], error: null });
    expect(await acknowledgeStaffRoughOk(pid, rid)).toBe("ok");
    expect(m.rpc).toHaveBeenCalledWith("natori_acknowledge_rough_ok_v1", { p_owner_id: mid, p_project_id: pid, p_rough_id: rid });
    m.rpc.mockResolvedValueOnce({ data: [{ result: "already_acknowledged", acknowledged_at: acknowledged }], error: null });
    expect(await acknowledgeStaffRoughOk(pid, rid)).toBe("already"); expect(m.dispatch).not.toHaveBeenCalled();
  });
  it.each([["not_found", "not-found"], ["not_ok", "not-ok"]])("uses database current owner/rough/tombstone checks for %s", async (result, expected) => {
    m.rpc.mockResolvedValue({ data: [{ result, acknowledged_at: null }], error: null }); expect(await acknowledgeStaffRoughOk(pid, rid)).toBe(expected);
  });
  it.each([null, {}, { data: [{ result: "acknowledged", acknowledged_at: acknowledged }] }, { data: [{ result: "acknowledged", acknowledged_at: acknowledged }], error: false },
    { data: [], error: null }, { data: [{ result: "acknowledged", acknowledged_at: null }], error: null }, { data: [{ result: "invented", acknowledged_at: null }], error: null }])("cannot clear attention on an unavailable or malformed response %#", async response => {
    m.rpc.mockResolvedValue(response); expect(await acknowledgeStaffRoughOk(pid, rid)).toBe("unavailable");
  });
  it("rejects malformed IDs and missing owner without touching the database", async () => {
    expect(await acknowledgeStaffRoughOk("bad", rid)).toBe("not-found"); m.owner.mockResolvedValue(null);
    expect(await acknowledgeStaffRoughOk(pid, rid)).toBe("not-found"); expect(m.rpc).not.toHaveBeenCalled();
  });
});

describe("rough-only ledger retry independent of acceptance flag", () => {
  it("dispatches only a proven owner/project/rough scoped existing job", async () => {
    m.rpc.mockResolvedValue({ data: nid, error: null }); expect(await retryStaffRoughOkNotification(pid, rid)).toBe(true);
    expect(m.rpc).toHaveBeenCalledWith("natori_retry_rough_ok_notification_v1", { p_owner_id: mid, p_project_id: pid, p_rough_id: rid });
    expect(m.dispatch).toHaveBeenCalledWith(nid, true);
  });
  it.each([null, {}, { data: nid }, { data: nid, error: false }, { data: null, error: null }, { data: "bad", error: null }, { data: nid, error: { code: "error" } }])("does not send on a malformed/unsafe retry receipt %#", async response => {
    m.rpc.mockResolvedValue(response); expect(await retryStaffRoughOkNotification(pid, rid)).toBe(false); expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("honors sending pause and never automatically queues a historical notice", async () => {
    vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "0"); expect(await retryStaffRoughOkNotification(pid, rid)).toBe(false);
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.dispatch).not.toHaveBeenCalled();
  });
});
