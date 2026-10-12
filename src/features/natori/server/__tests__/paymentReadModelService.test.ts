import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
const {rpc,admin,linkEnabled}=vi.hoisted(()=>({rpc:vi.fn(),admin:vi.fn(),linkEnabled:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:admin}));
vi.mock("@/features/natori/server/natoriOwner",()=>({resolveNatoriOwnerId:async()=>"owner-fixture"}));
vi.mock("@/features/natori/server/trustedNatoriOwner",()=>({resolveTrustedNatoriOwnerId:()=>({kind:"ok",ownerId:"owner-fixture"})}));
vi.mock("@/features/natori/server/paymentLinkService",()=>({paymentLinkIntegrityEnabled:linkEnabled}));
vi.mock("@/features/natori/server/acceptanceNotifications",()=>({dispatchAcceptanceNotifications:vi.fn()}));

import {getPaymentAttention,getQuotePaymentOverview} from "@/features/natori/server/paymentReadModelService";

const payment={projectId:"payment-project",title:"Payment",status:"needs_review",reason:"currency_mismatch"};
const refund={projectId:"refund-project",title:"Refund",status:"pending",reason:"refund_pending"};

beforeEach(()=>{
 vi.clearAllMocks();
 vi.stubEnv("NATORI_PAYMENT_INTEGRITY_ENABLED","1");
 vi.stubEnv("NATORI_REFUND_LEDGER_ENABLED","0");
 vi.stubEnv("NATORI_REFUND_LEDGER_READ_ENABLED","0");
 admin.mockReturnValue({rpc});
 linkEnabled.mockReturnValue(false);
});

const quoteState={available:true,confirmedAt:null,requiresReview:false,processing:false};
const linkState={result:"ok",state:"active",terminal:false,confirmedAt:null,attemptId:"attempt-synthetic",generation:1,revision:1,deadline:"2099-01-01T00:00:00Z",url:"https://buy.stripe.com/synthetic"};
const success=(data:unknown)=>({data,error:null});

describe("quote payment overview read safety",()=>{
 it("keeps deliberate disabled integrity distinct from unavailable reads",async()=>{
  vi.stubEnv("NATORI_PAYMENT_INTEGRITY_ENABLED","0");
  expect(await getQuotePaymentOverview("project-fixture")).toBeUndefined();expect(rpc).not.toHaveBeenCalled();
 });
 it("uses only owner-scoped read commands and a sanitized coherent link projection",async()=>{
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success(quoteState)).mockResolvedValueOnce(success(linkState));
  expect(await getQuotePaymentOverview("project-fixture")).toEqual({...quoteState,linkState:"active",linkDeadline:linkState.deadline,linkUrl:linkState.url});
  expect(rpc.mock.calls).toEqual([["natori_quote_payment_state_v1",{p_owner_id:"owner-fixture",p_project_id:"project-fixture"}],["natori_payment_links_v1",{p_owner_id:"owner-fixture",p_project_id:"project-fixture",p_command:"read"}]]);
 });
 it("retains the latest confirmation arriving after the first payment read",async()=>{
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success(quoteState)).mockResolvedValueOnce(success({...linkState,confirmedAt:"2026-10-12T01:00:00Z"}));
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:true,confirmedAt:"2026-10-12T01:00:00Z"});
 });
 it("keeps established confirmation and review even if the later read returns null confirmation",async()=>{
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success({...quoteState,confirmedAt:"2026-10-12T01:00:00Z",requiresReview:true})).mockResolvedValueOnce(success(linkState));
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:true,confirmedAt:"2026-10-12T01:00:00Z",requiresReview:true});
 });
 it.each(["needs_review","legacy_review"])("carries %s as a review warning",async state=>{
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success(quoteState)).mockResolvedValueOnce(success({...linkState,state}));
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:true,requiresReview:true,linkState:state});
 });
 it("carries the current terminal condition instead of old project status",async()=>{
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success(quoteState)).mockResolvedValueOnce(success({...linkState,terminal:true}));
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:true,linkState:"terminal"});
 });
 it.each([null,[],{}, {...quoteState,available:false}, {...quoteState,confirmedAt:"invalid"}, {...quoteState,confirmedAt:"2026-02-30T00:00:00Z"}, {...quoteState,processing:"yes"}, {...quoteState,requiresReview:null}])("fails closed for malformed first payment RPC %#",async data=>{
  rpc.mockResolvedValue(success(data));expect(await getQuotePaymentOverview("project-fixture")).toEqual({available:false,confirmedAt:null,requiresReview:false,processing:false});
 });
 it.each([null,[],{}, {...linkState,result:"not_found"}, {...linkState,result:undefined}, {...linkState,state:"unknown"}, {...linkState,terminal:undefined}, {...linkState,confirmedAt:undefined}, {...linkState,deadline:null}, {...linkState,deadline:"bad"}, {...linkState,url:"https://evil.example/"}, {...linkState,attemptId:null}, {...linkState,generation:0}, {...linkState,revision:0}])("fails closed for malformed later link RPC %# while retaining known paid+review facts",async data=>{
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success({...quoteState,confirmedAt:"2026-10-12T01:00:00Z",requiresReview:true})).mockResolvedValueOnce(success(data));
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:false,confirmedAt:"2026-10-12T01:00:00Z",requiresReview:true});
 });
 it("returns unavailable for RPC errors and catches throws rather than crashing quote pages",async()=>{
  rpc.mockResolvedValueOnce({data:quoteState,error:{code:"READ_FAILED"}});
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:false,confirmedAt:null});
  const log=vi.spyOn(console,"error").mockImplementation(()=>undefined);
  rpc.mockRejectedValueOnce(new Error("fixture read rejection"));
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:false,confirmedAt:null});
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success({...quoteState,confirmedAt:"2026-10-12T01:00:00Z",requiresReview:true})).mockRejectedValueOnce(new Error("fixture link read rejection"));
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:false,confirmedAt:"2026-10-12T01:00:00Z",requiresReview:true});
  log.mockRestore();
 });
 it.each([undefined,false,0,""])("requires explicit successful RPC error:null rather than falsy error %#",async error=>{
  rpc.mockResolvedValueOnce({data:quoteState,error});
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:false,confirmedAt:null});
  linkEnabled.mockReturnValue(true);rpc.mockResolvedValueOnce(success({...quoteState,confirmedAt:"2026-10-12T01:00:00Z"})).mockResolvedValueOnce({data:linkState,error});
  expect(await getQuotePaymentOverview("project-fixture")).toMatchObject({available:false,confirmedAt:"2026-10-12T01:00:00Z"});
 });
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
