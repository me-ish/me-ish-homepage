import {afterEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({gate:vi.fn(),owner:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("../caseWorkspaceRead",()=>({caseWorkspaceReadAvailable:()=>m.gate()}));
vi.mock("../trustedNatoriOwner",()=>({resolveTrustedNatoriOwnerId:()=>m.owner()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc})}));
import {retireCasePaymentReceipts} from "../casePaymentReceiptRetention";
afterEach(()=>vi.resetAllMocks());
describe("private receipt maintenance",()=>{
 it("does not initialize DB or owner when the workspace gate is closed",async()=>{m.gate.mockReturnValue(false);expect(await retireCasePaymentReceipts()).toEqual({enabled:false});expect(m.owner).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();});
 it("uses the trusted configured owner without an operator Cookie and a bounded batch",async()=>{m.gate.mockReturnValue(true);m.owner.mockReturnValue({kind:"ok",ownerId:"synthetic-owner"});m.rpc.mockResolvedValue({data:{retired:2,deferred:1,remaining:0,oldestEligibleAt:null},error:null});expect(await retireCasePaymentReceipts()).toEqual({enabled:true,retired:2,deferred:1,remaining:0,oldestEligibleAt:null});expect(m.rpc).toHaveBeenCalledWith("natori_case_payment_receipts_retire_v1",{p_owner_id:"synthetic-owner",p_limit:100});});
 it("surfaces SQL failure for maintenance reporting",async()=>{m.gate.mockReturnValue(true);m.owner.mockReturnValue({kind:"ok",ownerId:"synthetic-owner"});m.rpc.mockResolvedValue({data:null,error:{message:"unavailable"}});await expect(retireCasePaymentReceipts()).rejects.toThrow("receipt_retirement_unavailable");});
 it("does not fall back to a logged-in staff owner when configuration is absent",async()=>{m.gate.mockReturnValue(true);m.owner.mockReturnValue({kind:"unconfigured"});await expect(retireCasePaymentReceipts()).rejects.toThrow("receipt_retirement_owner_unavailable");expect(m.rpc).not.toHaveBeenCalled();});
});
