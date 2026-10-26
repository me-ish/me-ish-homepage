import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks=vi.hoisted(()=>({ cookies:vi.fn(), user:vi.fn(), rpc:vi.fn(), admin:vi.fn() }));
vi.mock("next/headers",()=>({cookies:mocks.cookies}));
vi.mock("@/lib/supabaseServer",()=>({supabaseServer:async()=>({auth:{getUser:mocks.user}})}));
vi.mock("@/lib/isAdmin",()=>({isAdminEmailAsync:async()=>false}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:mocks.admin}));
import { GET } from "@/app/api/natori/admin/case-workspace/route";
import * as route from "@/app/api/natori/admin/case-workspace/route";
import { caseWorkspaceReadAvailable,readCaseWorkspace } from "../caseWorkspaceRead";
import { previewEnvelopes } from "../../../../../scripts/natori-case-preview/fixtureReader";

const OWNER="22222222-2222-4222-8222-222222222222", OTHER="33333333-3333-4333-8333-333333333333";
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv("NODE_ENV","test");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","http://localhost:4193");vi.stubEnv("VERCEL_ENV","");
 vi.stubEnv("NATORI_OWNER_USER_ID",OWNER);vi.stubEnv("NATORI_DASHBOARD_KEY","");vi.stubEnv("NATORI_STAFF_EMAILS","staff@example.invalid");
 mocks.cookies.mockResolvedValue({get:()=>undefined});
 mocks.user.mockResolvedValue({data:{user:{id:OTHER,email:"staff@example.invalid"}},error:null});
 mocks.admin.mockReturnValue({rpc:mocks.rpc});
 mocks.rpc.mockImplementation(async(name:string)=>({data:name==="natori_case_system_status_v1"?{owner:OWNER,generation:0,armed:false,commandsHeld:false,sendersHeld:false,readOnly:false}:{complete:true,rows:previewEnvelopes()},error:null}));
});
afterEach(()=>vi.unstubAllEnvs());

describe("actual management authorization to normalized read route",()=>{
 it("uses the configured owner for pure status and collection GET RPCs, never the operator or query owner",async()=>{
  const response=await GET();expect(response.status).toBe(200);
  expect(mocks.rpc.mock.calls).toEqual([["natori_case_system_status_v1",{p_owner:OWNER},{get:true}],["natori_case_workspace_v1",{p_owner_id:OWNER},{get:true}]]);
  const result=await response.json();expect(result.records).toHaveLength(8);
  expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("vary")).toBe("Cookie");
  expect(JSON.stringify(result)).not.toContain("user_id");
  expect(JSON.stringify(result)).not.toContain("payment_link_url");
 });
 it.each([null,{id:OTHER,email:"outside@example.invalid"}])("rejects unauthenticated and non-staff users before creating an admin DB client",async user=>{
  mocks.user.mockResolvedValue({data:{user},error:null});
  expect((await GET()).status).toBe(401);expect(mocks.admin).not.toHaveBeenCalled();
 });
 it("fails closed when Auth lookup fails",async()=>{
  mocks.user.mockResolvedValue({data:{user:null},error:new Error("synthetic auth outage")});
  expect((await GET()).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it.each(["", "invalid-owner"])("rejects missing or invalid configured owner before the RPC",async owner=>{
  vi.stubEnv("NATORI_OWNER_USER_ID",owner);const response=await GET();expect(response.status).toBe(503);
  expect((await response.json()).code).toBe("natori_owner_unavailable");expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rejects an entire response that contains another owner or duplicate id",async()=>{
  const rows=previewEnvelopes();rows[0].project.user_id=OTHER;
  expect(await readCaseWorkspace(async()=>({complete:true,rows}))).toEqual({state:"unavailable",reason:"incomplete"});
  const own=previewEnvelopes();own[1]=own[0];
  expect(await readCaseWorkspace(async()=>({complete:true,rows:own}))).toEqual({state:"unavailable",reason:"incomplete"});
 });
 it("distinguishes an owned empty collection, a capped collection, and a failed read",async()=>{
  expect(await readCaseWorkspace(async()=>({complete:true,rows:[]}))).toEqual({state:"ready",records:[]});
  expect(await readCaseWorkspace(async()=>({complete:false,rows:[]}))).toEqual({state:"unavailable",reason:"collection_limit"});
  mocks.rpc.mockResolvedValue({data:null,error:{message:"synthetic SQL details"}});
  const response=await GET();expect(response.status).toBe(503);expect(await response.text()).not.toContain("SQL details");
 });
 it("uses coherent metadata and preserves null dates and known facts despite a failed domain",async()=>{
  const rows=previewEnvelopes();Object.assign(rows[3].project,{title:"架空の旧案件",client_name:"架空依頼者",due_date:null});
  rows[3].sections.financial_payments={state:"unavailable",reason:"read_failed"};
  const result=await readCaseWorkspace(async()=>({complete:true,rows}));
  expect(result.state).toBe("ready");if(result.state!=="ready")throw new Error("ready required");
  expect(result.records[3]).toMatchObject({title:"架空の旧案件",clientLabel:"架空依頼者",registeredDueDate:null});
  expect(result.records[3].display.payment.state).toBe("ready");expect(result.records[3].display.receipt.state).toBe("ready");
 });
 it("has no mutation route export and fails closed outside local development/test",async()=>{
  expect("POST" in route).toBe(false);expect("PATCH" in route).toBe(false);expect("DELETE" in route).toBe(false);
  vi.stubEnv("NODE_ENV","production");expect(caseWorkspaceReadAvailable()).toBe(false);expect((await GET()).status).toBe(404);expect(mocks.rpc).not.toHaveBeenCalled();
  vi.stubEnv("NODE_ENV","development");vi.stubEnv("VERCEL_ENV","production");expect(caseWorkspaceReadAvailable()).toBe(false);
 });
});
