import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),stop:vi.fn(),enabled:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc})}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>"owner"}));
vi.mock("../trustedNatoriOwner",()=>({resolveTrustedNatoriOwnerId:()=>({kind:"ok",ownerId:"owner"})}));
vi.mock("../paymentLinkService",()=>({paymentLinkIntegrityEnabled:m.enabled,stopDuePaymentLinks:m.stop}));
import {getPaymentStopStatus,runScheduledPaymentStops} from "../paymentStopManagementService";
const counts={kind:"ok",scanned:2,expired:1,skipped:0,failed:1};
beforeEach(()=>{vi.resetAllMocks();m.enabled.mockReturnValue(true);m.rpc.mockResolvedValue({data:true,error:null});m.stop.mockResolvedValue(counts);});
describe("scheduled stop observability",()=>{
 it("records start and the actual partial result with a single run ID",async()=>{
  expect(await runScheduledPaymentStops()).toEqual(counts);
  expect(m.rpc.mock.calls[0][0]).toBe("natori_payment_stop_run_v1");
  expect(m.rpc.mock.calls[1][1]).toEqual({...m.rpc.mock.calls[0][1],p_result:counts});
 });
 it.each(["start","finish"])("keeps stopping links when %s recording fails, but returns db-error",async(stage)=>{
  m.rpc.mockImplementation(async(_name,args)=>({data:stage==="start"?Boolean(args.p_result):!args.p_result,error:null}));
  expect(await runScheduledPaymentStops()).toEqual({kind:"db-error"});expect(m.stop).toHaveBeenCalledOnce();
 });
 it("records a thrown processing error without leaking its contents",async()=>{
  m.stop.mockRejectedValue(new Error("synthetic-provider-private-detail"));
  expect(await runScheduledPaymentStops()).toEqual({kind:"db-error"});expect(m.rpc.mock.calls[1][1].p_result).toEqual({kind:"db-error"});
 });
 it("disabled management does not read or write",async()=>{m.enabled.mockReturnValue(false);expect(await getPaymentStopStatus()).toEqual({enabled:false});expect(m.rpc).not.toHaveBeenCalled();});
 it("unavailable read does not become an empty healthy list",async()=>{m.rpc.mockResolvedValue({data:null,error:{code:"fixture"}});await expect(getPaymentStopStatus()).rejects.toThrow("payment_stop_status_unavailable");expect(m.rpc.mock.calls[0][1]).toEqual({p_owner_id:"owner"});});
 it("rejects malformed or unsupported status data",async()=>{m.rpc.mockResolvedValue({data:{enabled:true,jobs:[]},error:null});await expect(getPaymentStopStatus()).rejects.toThrow();});
});
