import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
const {rpc,admin}=vi.hoisted(()=>({rpc:vi.fn(),admin:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:admin}));
vi.mock("@/features/natori/server/natoriOwner",()=>({resolveNatoriOwnerId:async()=>"owner-fixture"}));
vi.mock("@/features/natori/server/trustedNatoriOwner",()=>({resolveTrustedNatoriOwnerId:()=>({kind:"ok",ownerId:"owner-fixture"})}));
vi.mock("@/features/natori/server/paymentLinkService",()=>({paymentLinkIntegrityEnabled:()=>false}));
vi.mock("@/features/natori/server/acceptanceNotifications",()=>({dispatchAcceptanceNotifications:vi.fn()}));

import {getPaymentAttention} from "@/features/natori/server/paymentReadModelService";

const payment={projectId:"payment-project",title:"Payment",status:"needs_review",reason:"currency_mismatch"};
const refund={projectId:"refund-project",title:"Refund",status:"pending",reason:"refund_pending"};

beforeEach(()=>{
 vi.clearAllMocks();
 vi.stubEnv("NATORI_PAYMENT_INTEGRITY_ENABLED","1");
 vi.stubEnv("NATORI_REFUND_LEDGER_ENABLED","0");
 vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED","0");
 admin.mockReturnValue({rpc});
});
afterEach(()=>vi.unstubAllEnvs());

describe("payment attention refund read boundary",()=>{
 it("keeps classic payment attention and owner scope when both refund gates are off",async()=>{
  rpc.mockResolvedValue({data:[payment],error:null});
  expect(await getPaymentAttention()).toEqual({available:true,items:[payment]});
  expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_payment_attention_v1",{p_owner_id:"owner-fixture"});
 });
 it.each(["0","1"])("selects refund-aware attention with writer enabled and reader %s",async reader=>{
  vi.stubEnv("NATORI_REFUND_LEDGER_ENABLED","1");vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED",reader);rpc.mockResolvedValue({data:[payment,refund],error:null});
  expect(await getPaymentAttention()).toEqual({available:true,items:[payment,refund]});
  expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_payment_attention_v2",{p_owner_id:"owner-fixture"});
 });
 it("retains refund attention during write rollback with the read gate enabled",async()=>{
  vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED","1");rpc.mockResolvedValue({data:[refund],error:null});
  expect(await getPaymentAttention()).toEqual({available:true,items:[refund]});
  expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_payment_attention_v2",{p_owner_id:"owner-fixture"});
 });
 it("does not silently fall back to classic attention when the enabled refund read fails",async()=>{
  vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED","1");rpc.mockResolvedValue({data:null,error:{code:"RPC_UNAVAILABLE"}});
  expect(await getPaymentAttention()).toEqual({available:false,items:[]});
  expect(rpc).toHaveBeenCalledExactlyOnceWith("natori_payment_attention_v2",{p_owner_id:"owner-fixture"});
 });
 it("rejects malformed refund-aware items without disclosing partially parsed data",async()=>{
  vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED","1");rpc.mockResolvedValue({data:[refund,{...payment,status:"foreign-status"}],error:null});
  expect(await getPaymentAttention()).toEqual({available:false,items:[]});
 });
 it("keeps attention disabled when payment integrity itself is off",async()=>{
  vi.stubEnv("NATORI_PAYMENT_INTEGRITY_ENABLED","0");vi.stubEnv("NATORI_REFUND_LEDGER_ENABLED","1");
  expect(await getPaymentAttention()).toBeNull();expect(rpc).not.toHaveBeenCalled();
 });
});
