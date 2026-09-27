import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { operator } = vi.hoisted(() => ({ operator: vi.fn() }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ resolveNatoriOperator: operator }));
import { resolveNatoriOwnerId, resolveNatoriManagementContext } from "../natoriOwner";
import { withNatoriManagement } from "../natoriManagementRoute";
import { natoriManagementScope } from "../natoriManagementScope";
const OWNER = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";
beforeEach(() => {
  vi.stubEnv("NATORI_OWNER_USER_ID", OWNER);
  operator.mockResolvedValue({ kind: "auth-user", userId: "staff-a" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); });
describe("fixed owner and request boundary", () => {
  it("operator identity never selects the dataset", async () => {
    expect(await resolveNatoriManagementContext()).toEqual({ownerId: OWNER, operator: {kind:"auth-user",userId:"staff-a"}});
    operator.mockResolvedValue({kind:"auth-user",userId:"staff-b"});
    expect(await resolveNatoriOwnerId()).toBe(OWNER);
  });
  it.each(["", "not-a-uuid"])("fails closed for owner setting %s before handler", async (setting) => {
    vi.stubEnv("NATORI_OWNER_USER_ID", setting);
    const handler = vi.fn();
    const r = await withNatoriManagement("test.GET", false, handler)();
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({code:"natori_owner_unavailable"});
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(handler).not.toHaveBeenCalled();
  });
  it("denies a non-operator before exposing configuration", async () => {
    operator.mockResolvedValue(null);
    vi.stubEnv("NATORI_OWNER_USER_ID", "");
    const handler=vi.fn();
    expect((await withNatoriManagement("test.GET",false,handler)()).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
  it("keeps concurrent operators separate and records no payload", async () => {
    const log=vi.spyOn(console,"info").mockImplementation(()=>{});
    operator.mockResolvedValueOnce({kind:"auth-user",userId:"staff-a"}).mockResolvedValueOnce({kind:"shared-key",userId:null});
    const handler=withNatoriManagement("test.POST",true,async (_body: string) => {
      await new Promise(resolve => setTimeout(resolve,5));
      return Response.json(await resolveNatoriManagementContext());
    });
    const [a,b]=await Promise.all([handler("customer-secret"),handler("private-token")]);
    expect((await a.json()).operator.userId).toBe("staff-a");
    expect((await b.json()).operator).toEqual({kind:"shared-key",userId:null});
    expect(natoriManagementScope.getStore()).toBeUndefined();
    expect(log).toHaveBeenCalledTimes(4);
    const logs=JSON.stringify(log.mock.calls);
    expect(logs).not.toContain("customer-secret"); expect(logs).not.toContain("private-token");
    expect(new Set(log.mock.calls.map(c => c[1].requestId)).size).toBe(2);
  });
  it("does not convert unexpected faults into success or owner errors", async () => {
    vi.spyOn(console,"info").mockImplementation(()=>{});
    await expect(withNatoriManagement("test.POST",true,async()=>{throw new Error("db unavailable");})()).rejects.toThrow("db unavailable");
    expect(natoriManagementScope.getStore()).toBeUndefined();
  });
});
