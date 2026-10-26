import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../caseSystemHold",async importOriginal=>({...await importOriginal<typeof import('../caseSystemHold')>(),assertCaseSystemAdmission:vi.fn(async()=>{})}));
const { operator } = vi.hoisted(() => ({ operator: vi.fn() }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ resolveNatoriOperator: operator }));
import { resolveNatoriOwnerId, resolveNatoriManagementContext } from "../natoriOwner";
import { withNatoriManagement } from "../natoriManagementRoute";
import { natoriManagementScope } from "../natoriManagementScope";
import {assertCaseSystemAdmission,CaseSystemHeld} from "../caseSystemHold";
const OWNER = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";
beforeEach(() => {
  vi.stubEnv("NATORI_OWNER_USER_ID", OWNER);
  operator.mockResolvedValue({ kind: "auth-user", userId: "staff-a" });
  vi.mocked(assertCaseSystemAdmission).mockResolvedValue(undefined);
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
  it("distinguishes rejection before the handler from a hold after an admitted effect",async()=>{
    const handler=vi.fn(async()=>{throw new CaseSystemHeld();});
    vi.mocked(assertCaseSystemAdmission).mockRejectedValueOnce(new CaseSystemHeld());
    const pre=await withNatoriManagement("projects.PATCH",true,handler)();
    expect(await pre.json()).toMatchObject({resultUnchanged:true});expect(handler).not.toHaveBeenCalled();
    const late=await withNatoriManagement("projects.PATCH",true,handler)();
    expect(await late.json()).toEqual({error:"natori_system_held",resultUnconfirmed:true});expect(handler).toHaveBeenCalledOnce();
  });
  it.each(["lookup","inspect"])("keeps the exact consultation %s receipt branch available without admitting a command",async action=>{
    const handler=vi.fn(async(_request:Request)=>Response.json({result:"saved"}));
    vi.mocked(assertCaseSystemAdmission).mockRejectedValue(new CaseSystemHeld());
    const wrapped=withNatoriManagement("consultation.POST",true,handler);
    const request=(data:unknown)=>new Request("https://example.invalid/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    expect((await wrapped(request({action,projectId:OWNER,operation:{id:OWNER}}))).status).toBe(200);
    expect(assertCaseSystemAdmission).not.toHaveBeenCalled();
    expect((await wrapped(request({action,projectId:OWNER,operation:{id:OWNER},retryMessageId:OWNER}))).status).toBe(503);
    expect(handler).toHaveBeenCalledOnce();
  });
  it.each([{action:["lookup"]},{action:["inspect"]},{action:{action:"lookup"}},{action:null}])("does not coerce a malformed action into a receipt-only exemption",async({action})=>{
    const handler=vi.fn(async(_request:Request)=>Response.json({result:"committed"}));
    vi.mocked(assertCaseSystemAdmission).mockRejectedValue(new CaseSystemHeld());
    const response=await withNatoriManagement("consultation.POST",true,handler)(new Request("https://example.invalid/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,projectId:OWNER,operation:{id:OWNER}})}));
    expect(response.status).toBe(503);expect(handler).not.toHaveBeenCalled();
  });
});

it("administrative control remains reachable during a business hold with fixed owner authorization",async()=>{
 vi.mocked(assertCaseSystemAdmission).mockRejectedValue(new CaseSystemHeld());
 const handler=vi.fn(async()=>Response.json({owner:await resolveNatoriOwnerId()}));
 expect((await withNatoriManagement("case-system.POST",true,handler)()).status).toBe(200);
 expect(assertCaseSystemAdmission).not.toHaveBeenCalled();expect(handler).toHaveBeenCalledOnce();
});

it.each(["projects.PATCH","external-inquiry.POST","payment-link.POST","notifications.POST"])("keeps unsafe legacy %s closed after an owner has been armed",async operation=>{
 vi.mocked(assertCaseSystemAdmission).mockImplementation(async kind=>{if(kind==='legacy-command')throw new CaseSystemHeld();});
 const handler=vi.fn(async()=>Response.json({saved:true}));
 expect((await withNatoriManagement(operation,true,handler)()).status).toBe(503);
 expect(assertCaseSystemAdmission).toHaveBeenCalledWith('legacy-command',OWNER);expect(handler).not.toHaveBeenCalled();
});
it.each(["consultation.POST","rough.POST","rough-ok.POST","delivery-files.POST","events.PATCH","profile.PATCH"])("keeps canonical reused or administrative %s available when commands resume",async operation=>{
 vi.mocked(assertCaseSystemAdmission).mockImplementation(async kind=>{if(kind==='legacy-command')throw new CaseSystemHeld();});
 const handler=vi.fn(async()=>Response.json({saved:true}));
 expect((await withNatoriManagement(operation,true,handler)()).status).toBe(200);
 expect(assertCaseSystemAdmission).toHaveBeenCalledWith('command',OWNER);expect(handler).toHaveBeenCalledOnce();
});
