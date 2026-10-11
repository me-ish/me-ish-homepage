import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ allowed: vi.fn(), mark: vi.fn(), unmark: vi.fn() }));
vi.mock("@/features/natori/server/natoriManagementRoute", () => ({ withNatoriManagement: (_op: string, _mutation: boolean, handler: (...args: unknown[]) => Promise<Response>) => handler }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: m.allowed }));
vi.mock("@/features/natori/server/talkRoughService", () => ({ markStaffRough: m.mark, unmarkStaffRough: m.unmark }));
import { POST } from "../route";

const call = (body: unknown, headers: Record<string, string> = { "x-requested-with": "me-ish" }) =>
  POST(new Request("http://localhost/api/natori/admin/consultation/rough", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
beforeEach(() => { m.allowed.mockReset().mockResolvedValue(true); m.mark.mockReset(); m.unmark.mockReset(); });

describe("POST /api/natori/admin/consultation/rough", () => {
  it("needs the management session and the CSRF header", async () => {
    m.allowed.mockResolvedValueOnce(false);
    expect((await call({ projectId: "p", messageId: "m", action: "mark" })).status).toBe(401);
    expect((await call({ projectId: "p", messageId: "m", action: "mark" }, {})).status).toBe(403);
    expect(m.mark).not.toHaveBeenCalled();
  });
  it("rejects malformed requests", async () => {
    for (const body of ["not json", {}, { projectId: "p", messageId: "m" }, { projectId: "p", messageId: "m", action: "delete" }, { projectId: 1, messageId: "m", action: "mark" }])
      expect((await call(body)).status).toBe(400);
  });
  it("marks and un-marks through the service", async () => {
    m.mark.mockResolvedValue("ok"); m.unmark.mockResolvedValue("already");
    expect(await (await call({ projectId: "p", messageId: "m", action: "mark" })).json()).toEqual({ ok: true });
    expect(m.mark).toHaveBeenCalledWith("p", "m");
    expect(await (await call({ projectId: "p", messageId: "m", action: "unmark" })).json()).toEqual({ ok: true, already: true });
    expect(m.unmark).toHaveBeenCalledWith("p", "m");
  });
  it("explains refusals in Japanese and never reports success for an unavailable table", async () => {
    for (const [result, status] of [["invalid", 400], ["not-found", 404], ["closed", 409], ["unavailable", 503]] as const) {
      m.mark.mockResolvedValue(result);
      const response = await call({ projectId: "p", messageId: "m", action: "mark" });
      expect(response.status).toBe(status);
      expect(typeof (await response.json() as { error: string }).error).toBe("string");
    }
  });
});
