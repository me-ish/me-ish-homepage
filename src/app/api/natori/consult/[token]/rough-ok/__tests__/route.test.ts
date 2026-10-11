import { beforeEach, describe, expect, it, vi } from "vitest";
const record = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/server/talkRoughService", () => ({ recordClientRoughOk: record }));
import { POST } from "../route";

const call = (body: unknown, headers: Record<string, string> = { "x-requested-with": "me-ish" }) =>
  POST(new Request("http://localhost/api/natori/consult/t/rough-ok", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), { params: Promise.resolve({ token: "tok" }) });
beforeEach(() => record.mockReset());

describe("POST /api/natori/consult/[token]/rough-ok", () => {
  it("rejects a request without the CSRF header before touching anything", async () => {
    expect((await call({ roughId: "r" }, {})).status).toBe(403);
    expect(record).not.toHaveBeenCalled();
  });
  it("rejects broken bodies", async () => {
    expect((await call("not json")).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call({ roughId: 5 })).status).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });
  it("records the OK for the token's own project with no-store and no-referrer", async () => {
    record.mockResolvedValue("ok");
    const response = await call({ roughId: "r1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(record).toHaveBeenCalledWith("tok", "r1");
  });
  it("treats a second OK as success and maps the other outcomes without detail", async () => {
    record.mockResolvedValue("already");
    expect(await (await call({ roughId: "r1" })).json()).toEqual({ ok: true, already: true });
    for (const [result, status] of [["not-found", 404], ["closed", 409], ["unavailable", 503]] as const) {
      record.mockResolvedValue(result);
      expect((await call({ roughId: "r1" })).status).toBe(status);
    }
  });
});
