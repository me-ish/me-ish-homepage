import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc }) }));
import { loadConsultationOverviews } from "../consultationOverviewService";
const row = (id: string) => ({ project_id: id, latest_message_id: null, latest_message_at: null, latest_sender: null, notification_failed: 0, notification_pending: 0 });
beforeEach(() => { vi.clearAllMocks(); });
describe("owner scoped consultation projection", () => {
  it("uses bounded batches and preserves a genuinely empty conversation", async () => {
    rpc.mockImplementation(async (_name, args) => ({ data: args.p_project_ids.map(row), error: null }));
    const ids = Array.from({ length: 101 }, (_, index) => String(index));
    const result = await loadConsultationOverviews("owner", ids);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1]).toEqual({ p_owner_id: "owner", p_project_ids: ids.slice(0, 100) });
    expect(result?.size).toBe(101);
    expect(result?.get("0")?.latestSender).toBeNull();
  });
  it.each(["database", "missing", "foreign", "duplicate"])("returns unavailable on %s instead of an all-clear", async kind => {
    rpc.mockResolvedValue(kind === "database" ? { data: null, error: {} } : { data: kind === "missing" ? [] : kind === "foreign" ? [row("elsewhere"), row("b")] : [row("a"), row("a")], error: null });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await loadConsultationOverviews("owner", ["a", "b"])).toBeNull();
    spy.mockRestore();
  });
});
