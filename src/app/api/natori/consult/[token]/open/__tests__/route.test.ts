import { beforeEach, describe, expect, it, vi } from "vitest";
const open = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/server/talkOpenService", () => ({ openTalkLink: open }));
import { POST } from "../route";

const call = (body: unknown, headers: Record<string, string> = { "x-requested-with": "me-ish" }) =>
  POST(new Request("http://localhost/api/natori/consult/t/open", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), { params: Promise.resolve({ token: "tok" }) });
beforeEach(() => open.mockReset());

describe("POST /api/natori/consult/[token]/open", () => {
  it("rejects a request without the CSRF header before touching anything", async () => {
    expect((await call({ target: "quote" }, {})).status).toBe(403);
    expect(open).not.toHaveBeenCalled();
  });
  it("rejects unknown targets and broken bodies", async () => {
    expect((await call({ target: "payment" })).status).toBe(400);
    expect((await call("not json")).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect(open).not.toHaveBeenCalled();
  });
  it("returns the path with no-store and no-referrer", async () => {
    open.mockResolvedValue({ kind: "ok", path: "/natori/quote/abc" });
    const response = await call({ target: "quote" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: "/natori/quote/abc" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(open).toHaveBeenCalledWith("tok", "quote");
  });
  it("maps outcomes to status codes without leaking detail", async () => {
    for (const [kind, status] of [["not-found", 404], ["unavailable", 409], ["throttled", 429], ["db-error", 503]] as const) {
      open.mockResolvedValue({ kind });
      expect((await call({ target: "delivery" })).status).toBe(status);
    }
  });
});
