import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc})}));
vi.mock("../natoriOwner",()=>({resolveNatoriManagementContext:async()=>({ownerId:"22222222-2222-4222-8222-222222222222",operator:{kind:"shared-key",userId:null}})}));
import {assertCaseSystemAdmission,readCaseSystemHold,readCaseSystemReview,controlCaseSystem} from "../caseSystemHold";
const owner="22222222-2222-4222-8222-222222222222";
const other="33333333-3333-4333-8333-333333333333";
const open={owner,generation:0,armed:false,commandsHeld:false,sendersHeld:false,readOnly:false};
beforeEach(()=>{vi.stubEnv("NATORI_OWNER_USER_ID",owner);rpc.mockImplementation(async(name:string)=>({data:name==="natori_case_system_status_v1"?open:true,error:null}));});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe("persisted admission state: no inferred completion or retries",()=>{
 it("uses one fixed READ ONLY owner-bound RPC, never sends caller SQL or a mutation",async()=>{
  expect(await readCaseSystemHold(owner)).toEqual(open);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_case_system_status_v1",{p_owner:owner},{get:true});
 });
 it.each(["command","sender","legacy-sender"] as const)("retains existing behavior before arming: %s",async kind=>{
  await expect(assertCaseSystemAdmission(kind)).resolves.toBeUndefined();
  expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_case_system_admit_v1",{p_owner:owner,p_kind:kind});
 });
 it.each(["NATORI_CASE_RELEASE_ENABLED","NATORI_CASE_PRODUCTION_MAIL_CONNECTION","NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS"])("%s prevents unbound direct legacy sends even before DB arming",async key=>{
  vi.stubEnv("NATORI_CASE_RELEASE_ENABLED","0");vi.stubEnv(key,key==="NATORI_CASE_RELEASE_ENABLED"?"1":"retained-or-invalid-metadata");
  await expect(assertCaseSystemAdmission("legacy-sender")).rejects.toThrow("natori_system_held");
  expect(rpc).not.toHaveBeenCalled();
 });
 it.each(["command","sender"] as const)("production mail metadata does not bypass or replace the %s DB fence",async kind=>{
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION","retained-metadata");
  await expect(assertCaseSystemAdmission(kind)).resolves.toBeUndefined();
  rpc.mockResolvedValue({data:false,error:null});await expect(assertCaseSystemAdmission(kind)).rejects.toThrow("natori_system_held");
  expect(rpc).toHaveBeenCalledTimes(2);
 });
 it.each(["command","sender","legacy-sender"] as const)("denies a held boundary without retrying or settling any data: %s",async kind=>{
  rpc.mockResolvedValue({data:false,error:null});
  await expect(assertCaseSystemAdmission(kind)).rejects.toThrow("natori_system_held");
  expect(rpc).toHaveBeenCalledTimes(1);
 });
 it("binds each boundary separately; a prior command admission does not authorize a sender",async()=>{
  rpc.mockResolvedValueOnce({data:true,error:null}).mockResolvedValue({data:false,error:null});
  await expect(assertCaseSystemAdmission("command")).resolves.toBeUndefined();
  await expect(assertCaseSystemAdmission("sender")).rejects.toThrow("natori_system_held");
  await expect(assertCaseSystemAdmission("legacy-sender")).rejects.toThrow("natori_system_held");
 });
 it.each([
  {data:open,error:{message:"offline"}},
  {data:null,error:null},
  {data:{...open,owner:other},error:null},
  {data:{...open,generation:2**53},error:null},
  {data:{...open,commandsHeld:"false"},error:null},
 ])("fails closed on read error, incomplete data, owner mismatch and invalid state",async result=>{
  rpc.mockResolvedValue(result);
  await expect(readCaseSystemHold(owner)).rejects.toThrow("natori_system_held");
  expect(rpc).toHaveBeenCalledTimes(1);
 });
 it.each([null,false,"true",{},[]])("accepts only the exact DB boolean true for admission",async data=>{
  rpc.mockResolvedValue({data,error:null});
  await expect(assertCaseSystemAdmission("sender")).rejects.toThrow("natori_system_held");
 });
 it("normalizes transport/configuration failure without retrying or leaking its detail",async()=>{
  rpc.mockRejectedValue(Error("synthetic private failure"));
  await expect(assertCaseSystemAdmission("sender")).rejects.toThrow(/^natori_system_held$/);
  expect(rpc).toHaveBeenCalledTimes(1);
 });
 it("does not cache or infer unheld state after a control read fails",async()=>{
  await assertCaseSystemAdmission("command");
  rpc.mockResolvedValue({data:null,error:{message:"failed"}});
  await expect(assertCaseSystemAdmission("command")).rejects.toThrow("natori_system_held");
  expect(rpc).toHaveBeenCalledTimes(2);
 });
 it("requires the server-selected owner before any admission lookup",async()=>{
  vi.stubEnv("NATORI_OWNER_USER_ID","");
  await expect(assertCaseSystemAdmission("sender")).rejects.toThrow("natori_system_held");
  expect(rpc).not.toHaveBeenCalled();
 });
});

it("binds a pure review to the server owner and rejects an absence assertion",async()=>{
 const review={...open,revision:"a".repeat(32),localUnknownRecords:0,localInFlightRecords:0,records:[],recordsComplete:true,externalAbsenceProven:false,priorRequestsMayComplete:true,scope:"local-ledgers-only"};
 rpc.mockResolvedValue({data:review,error:null});expect(await readCaseSystemReview(owner)).toEqual(review);
 expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_case_system_review_v1",{p_owner:owner},{get:true});
 rpc.mockResolvedValue({data:{...review,externalAbsenceProven:true},error:null});await expect(readCaseSystemReview(owner)).rejects.toThrow("natori_system_held");
});
it("control obtains the owner/operator from request authorization, never review metadata",async()=>{
 rpc.mockResolvedValue({data:{result:"saved",generation:2,priorRequestsMayComplete:true},error:null});
 expect(await controlCaseSystem({action:"resume-commands",generation:1,revision:"a".repeat(32),acknowledgePrior:true})).toMatchObject({result:"saved"});
 expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_case_system_control_v2",{p_owner:owner,p_action:"resume-commands",p_generation:1,p_actor:{kind:"shared-key",userId:null},p_review:"a".repeat(32),p_acknowledge_prior:true});
});

describe("first rollout: freeze before any schema-dependent admission",()=>{
 const armed={...open,armed:true,generation:1,commandsHeld:true,sendersHeld:true,readOnly:true};
 it.each(["command","legacy-command","sender","legacy-sender"] as const)("hold blocks %s even if an unarmed RPC would allow it",async kind=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","hold");
  await expect(assertCaseSystemAdmission(kind)).rejects.toThrow("natori_system_held");
  expect(rpc).not.toHaveBeenCalled();
 });
 it.each(["0","false","Managed","unknown"])("malformed phase %s cannot release the freeze",async phase=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE",phase);
  await expect(assertCaseSystemAdmission("command")).rejects.toThrow("natori_system_held");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("production opt-in without an explicit managed phase stays closed",async()=>{
  vi.stubEnv("NATORI_CASE_RELEASE_ENABLED","1");
  await expect(assertCaseSystemAdmission("command")).rejects.toThrow("natori_system_held");
  expect(rpc).not.toHaveBeenCalled();
 });
 it.each([open,{...armed,generation:0},null,{...armed,owner:other}])("managed requires a valid persisted owner hold, never schema presence alone",async state=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","managed");
  rpc.mockResolvedValue({data:state,error:null});
  await expect(assertCaseSystemAdmission("command")).rejects.toThrow("natori_system_held");
  expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_case_system_status_v1",{p_owner:owner},{get:true});
 });
 it("does not reopen when the initial absent RPC becomes an unarmed RPC",async()=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","managed");
  rpc.mockResolvedValueOnce({data:null,error:{code:"PGRST202"}}).mockResolvedValue({data:open,error:null});
  await expect(assertCaseSystemAdmission("sender")).rejects.toThrow("natori_system_held");
  await expect(assertCaseSystemAdmission("sender")).rejects.toThrow("natori_system_held");
  expect(rpc.mock.calls.every(([name])=>name==="natori_case_system_status_v1")).toBe(true);
 });
 it("managed keeps the persisted fence after UI/release OFF, then checks each new boundary",async()=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","managed");
  vi.stubEnv("NATORI_CASE_RELEASE_ENABLED","0");
  vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED","0");
  rpc.mockImplementation(async(name:string)=>({data:name==="natori_case_system_status_v1"?armed:false,error:null}));
  await expect(assertCaseSystemAdmission("command")).rejects.toThrow("natori_system_held");
  const resumed={...armed,commandsHeld:false,sendersHeld:false,readOnly:false,generation:3};
  rpc.mockImplementation(async(name:string,args:{p_kind?:string})=>({data:name==="natori_case_system_status_v1"?resumed:args.p_kind==="command",error:null}));
  await expect(assertCaseSystemAdmission("command")).resolves.toBeUndefined();
  await expect(assertCaseSystemAdmission("sender")).rejects.toThrow("natori_system_held");
  expect(rpc.mock.calls.filter(([name])=>name==="natori_case_system_admit_v1")).toHaveLength(3);
 });
 it.each(["resume-commands","resume-senders"] as const)("freeze rejects %s without changing a ledger",async action=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","hold");
  await expect(controlCaseSystem({action,generation:1,revision:"a".repeat(32),acknowledgePrior:true})).rejects.toThrow("natori_system_held");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("still permits authorized stop and read-only status/review during bootstrap",async()=>{
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE","hold");
  rpc.mockResolvedValueOnce({data:{result:"saved",generation:1,priorRequestsMayComplete:true},error:null});
  expect(await controlCaseSystem({action:"hold",generation:0,revision:null,acknowledgePrior:false})).toMatchObject({result:"saved"});
  rpc.mockResolvedValueOnce({data:armed,error:null});
  expect(await readCaseSystemHold(owner)).toEqual(armed);
 });
});
