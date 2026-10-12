import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc }) }));
import { loadConsultationOverviews } from "../consultationOverviewService";
const row = (id: string) => ({ project_id: id, latest_message_id: null, latest_message_at: null, latest_sender: null, notification_failed: 0, notification_pending: 0, rough_ok_pending: 0, latest_rough_ok_id: null, latest_rough_ok_at: null });
beforeEach(() => { vi.clearAllMocks(); });
describe("owner scoped consultation projection", () => {
  it("uses bounded batches and preserves a genuinely empty conversation", async () => {
    rpc.mockImplementation(async (_name, args) => ({ data: args.p_project_ids.map(row), error: null }));
    const ids = Array.from({ length: 101 }, (_, index) => String(index));
    const result = await loadConsultationOverviews("owner", ids);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe("natori_consultation_overview_v2");
    expect(rpc.mock.calls[0][1]).toEqual({ p_owner_id: "owner", p_project_ids: ids.slice(0, 100) });
    expect(result?.size).toBe(101);
    expect(result?.get("0")?.latestSender).toBeNull();
  });
  it.each([null, undefined, {}, { data: [row("a")] }, { data: [row("a")], error: undefined }, { data: [row("a")], error: false }])("rejects malformed response envelopes %#", async response => {
    rpc.mockResolvedValue(response);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await loadConsultationOverviews("owner", ["a"])).toBeNull(); spy.mockRestore();
  });
  it.each([{ rough_ok_pending: -1 }, { rough_ok_pending: 1 }, { rough_ok_pending: 0, latest_rough_ok_at: "2026-10-12T00:00:00Z" },
    { notification_failed: "0" }, { notification_pending: NaN }, { latest_message_at: "bad" }, { latest_sender: "client" },
    { rough_ok_pending: 1, latest_rough_ok_id: "99999999-bbbb-4ccc-8ddd-eeeeeeeeeeee", latest_rough_ok_at: "bad" }])("rejects inconsistent or malformed business projections %#", async patch => {
    rpc.mockResolvedValue({ data: [{ ...row("a"), ...patch }], error: null });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await loadConsultationOverviews("owner", ["a"])).toBeNull(); spy.mockRestore();
  });
  it("projects pending OKs independently of latest sender and email success", async () => {
    rpc.mockResolvedValue({ data: [{ ...row("a"), latest_message_id: "message", latest_sender: "staff", latest_message_at: "2026-10-01T00:00:00Z", rough_ok_pending: 2, latest_rough_ok_id: "99999999-bbbb-4ccc-8ddd-eeeeeeeeeeee", latest_rough_ok_at: "2026-10-12T00:00:00Z" }], error: null });
    expect((await loadConsultationOverviews("owner", ["a"]))?.get("a")).toMatchObject({ roughOkPending: 2, latestSender: "staff", notificationPending: 0, latestRoughOkAt: "2026-10-12T00:00:00Z" });
  });
  it.each(["database", "missing", "foreign", "duplicate"])("returns unavailable on %s instead of an all-clear", async kind => {
    rpc.mockResolvedValue(kind === "database" ? { data: null, error: {} } : { data: kind === "missing" ? [] : kind === "foreign" ? [row("elsewhere"), row("b")] : [row("a"), row("a")], error: null });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await loadConsultationOverviews("owner", ["a", "b"])).toBeNull();
    spy.mockRestore();
  });
});
