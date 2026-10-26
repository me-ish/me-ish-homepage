import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const {rpc,operator}=vi.hoisted(()=>({rpc:vi.fn(),operator:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc})}));
vi.mock("../requireNatoriAdmin",()=>({resolveNatoriOperator:operator}));
import {withNatoriManagement} from "../natoriManagementRoute";
import {assertCaseSystemAdmission} from "../caseSystemHold";
const owner="22222222-2222-4222-8222-222222222222";

beforeEach(()=>{
 vi.stubEnv("NATORI_OWNER_USER_ID",owner);
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","http://127.0.0.1:54321");
 vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","hold");
 operator.mockResolvedValue({kind:"auth-user",userId:owner});
 rpc.mockResolvedValue({data:true,error:null});
 vi.spyOn(console,"info").mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();vi.clearAllMocks();});
describe("real management wrapper + real bootstrap admission; synthetic Auth/DB",()=>{
 it.each(["projects.PATCH","payment-link.POST","notifications.POST","case-work.POST","events.PATCH","portfolio-content.PUT"])("stops %s before its handler and before an unarmed DB lookup",async operation=>{
  const handler=vi.fn(async()=>Response.json({saved:true}));
  const response=await withNatoriManagement(operation,true,handler)();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({error:"natori_system_held",resultUnchanged:true});
  expect(handler).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
 });
 it("keeps a pure receipt lookup and read available, but never its retry selector",async()=>{
  const handler=vi.fn(async(_request?:Request)=>Response.json({result:"unknown",retryAllowed:false}));
  expect((await withNatoriManagement("case-history.GET",false,handler)()).status).toBe(200);
  const request=(retry=false)=>new Request("http://127.0.0.1/api/natori/admin/consultation",{method:"POST",body:JSON.stringify({action:"inspect",projectId:owner,operation:{id:owner},...(retry?{retryMessageId:owner}:{})})});
  expect((await withNatoriManagement("consultation.POST",true,handler)(request())).status).toBe(200);
  expect((await withNatoriManagement("consultation.POST",true,handler)(request(true))).status).toBe(503);
  expect(handler).toHaveBeenCalledTimes(2);expect(rpc).not.toHaveBeenCalled();
 });
 it("retains authentication before receipt inspection or administrative stop",async()=>{
  operator.mockResolvedValue(null);
  const handler=vi.fn();
  expect((await withNatoriManagement("case-system.POST",true,handler)()).status).toBe(401);
  expect(handler).not.toHaveBeenCalled();
 });
 it("rechecks a sender after a command was admitted before the freeze",async()=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","");
  await assertCaseSystemAdmission("command");
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","hold");
  const externalTransport=vi.fn();
  await expect((async()=>{await assertCaseSystemAdmission("sender");externalTransport();})()).rejects.toThrow("natori_system_held");
  expect(externalTransport).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledTimes(1);
 });
});
