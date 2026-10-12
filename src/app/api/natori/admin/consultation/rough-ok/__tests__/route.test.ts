import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ allowed: vi.fn(), ack: vi.fn(), retry: vi.fn() }));
vi.mock("@/features/natori/server/natoriManagementRoute", () => ({ withNatoriManagement: (_op: string, _mutation: boolean, handler: (...args: unknown[]) => Promise<Response>) => handler }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: m.allowed }));
vi.mock("@/features/natori/server/roughFollowupService", () => ({ acknowledgeStaffRoughOk: m.ack, retryStaffRoughOkNotification: m.retry }));
import { POST } from "../route";
const call = (body: unknown, headers: Record<string, string> = { "x-requested-with": "me-ish" }) => POST(new Request("https://example.invalid/api/natori/admin/consultation/rough-ok", {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
}));
const body = { projectId: "project", roughId: "rough", action: "acknowledge" };
beforeEach(() => { vi.clearAllMocks(); m.allowed.mockResolvedValue(true); m.ack.mockResolvedValue("ok"); m.retry.mockResolvedValue(true); });
describe("owner rough OK actions HTTP boundary", () => {
  it("requires management authentication and CSRF before any action", async () => {
    m.allowed.mockResolvedValueOnce(false); expect((await call(body)).status).toBe(401);
    expect((await call(body, {})).status).toBe(403); expect(m.ack).not.toHaveBeenCalled(); expect(m.retry).not.toHaveBeenCalled();
  });
  it.each(["bad json", null, {}, { ...body, roughId: 4 }, { ...body, action: "all" }, { projectId: "p", action: "acknowledge" }])("rejects malformed or bulk actions %#", async raw => {
    expect((await call(raw)).status).toBe(400); expect(m.ack).not.toHaveBeenCalled(); expect(m.retry).not.toHaveBeenCalled();
  });
  it("returns a matching per-rough receipt after acknowledgement and replay", async () => {
    const response = await call(body); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, roughId: "rough" }); expect(m.ack).toHaveBeenCalledWith("project", "rough");
    m.ack.mockResolvedValueOnce("already"); expect(await (await call(body)).json()).toEqual({ ok: true, roughId: "rough", already: true });
    expect(m.retry).not.toHaveBeenCalled();
  });
  it.each([["not-found", 404], ["not-ok", 409], ["closed", 409], ["unavailable", 503]])("does not claim success for %s", async (result, status) => {
    m.ack.mockResolvedValue(result); const response = await call(body); expect(response.status).toBe(status); expect(await response.json()).not.toHaveProperty("ok", true);
  });
  it("keeps mail retry separate from business acknowledgement", async () => {
    expect(await (await call({ ...body, action: "retry-notification" })).json()).toEqual({ ok: true, roughId: "rough" });
    expect(m.retry).toHaveBeenCalledWith("project", "rough"); expect(m.ack).not.toHaveBeenCalled();
    m.retry.mockResolvedValueOnce(false); expect((await call({ ...body, action: "retry-notification" })).status).toBe(409);
    m.retry.mockRejectedValueOnce(new Error("private")); expect((await call({ ...body, action: "retry-notification" })).status).toBe(503);
  });
});
