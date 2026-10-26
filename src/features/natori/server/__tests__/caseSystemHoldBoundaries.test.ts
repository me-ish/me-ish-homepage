import {afterEach,beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const state=vi.hoisted(()=>({held:false,rpc:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:state.rpc})}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>"11111111-1111-4111-8111-111111111111"}));
import {executePaymentLinkOperation,type PaymentLinkProvider,type PaymentLinkRpc} from "../paymentLinkService";
const owner="11111111-1111-4111-8111-111111111111",project="22222222-2222-4222-8222-222222222222",op="33333333-3333-4333-8333-333333333333",quote="44444444-4444-4444-8444-444444444444";
beforeEach(()=>{
 state.held=false;state.rpc.mockImplementation(async(name:string)=>({data:name==="natori_case_system_admit_v1"&&!state.held,error:null}));
 for(const name of ["NATORI_PAYMENT_LINK_INTEGRITY_ENABLED","NATORI_ACCEPTANCE_OUTBOX_ENABLED","NATORI_QUOTE_INTEGRITY_ENABLED","NATORI_PAYMENT_INTEGRITY_ENABLED"])vi.stubEnv(name,"1");
 vi.stubEnv("NATORI_STRIPE_MODE","test");vi.stubEnv("NATORI_DELIVERY_NOTIFICATION_KEY","a".repeat(64));vi.stubEnv("NATORI_ORDER_MAIL_FROM","Fixture <mail@example.invalid>");vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO","reply@example.invalid");
});afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
async function run(heldAt:"before-price"|"after-price"){
 let attempt={id:quote,project_id:project,quote_id:quote,generation:1,amount:12000,livemode:false,provider_account_id:"acct_fixture",state:"creating",price_id:null as string|null,link_id:null,link_url:null,deadline:new Date(Date.now()+86400000).toISOString(),deadline_revision:1,claim_generation:1,price_started_at:null as string|null,link_started_at:null as string|null};
 const stages:string[]=[],call:PaymentLinkRpc=async(_owner,_project,command,input)=>{
  if(command==="operation")return {result:"absent"};if(command==="outbound_gate")return {result:"allowed"};if(command==="context")return {result:"ok"};
  if(command==="begin")return {result:"claimed",attempt};
  if(command==="stage"){
   const value=input as {stage:string;value?:{id?:string}};stages.push(value.stage);
   if(value.stage==="price_start")attempt={...attempt,price_started_at:new Date().toISOString()};
   if(value.stage==="price")attempt={...attempt,price_id:value.value?.id??null};
   if(value.stage==="link_start")attempt={...attempt,link_started_at:new Date().toISOString()};
   return {result:"saved",attempt};
  }throw Error("unexpected new command");
 };
 const createPrice=vi.fn(async()=>{state.held=true;return "price_known";}),createLink=vi.fn(async()=>{throw Error("held link must never run");});
 const never=vi.fn(async()=>{throw Error("unexpected provider boundary");});
 const external:PaymentLinkProvider={accountId:async()=>"acct_fixture",createPrice,createLink,readLink:never,findLink:never,sessions:never,expireSession:never,stopLink:never};
 if(heldAt==="before-price")state.held=true;
 const result=await executePaymentLinkOperation({projectId:project,operationId:op,action:"issue",deadline:attempt.deadline,to:"synthetic@example.invalid",subject:"合成",body:"{支払リンク}"},external,{rpc:call});
 return {result,stages,attempt,createPrice,createLink};
}
it("a supplied provider cannot bypass the final hold before price creation; the same operation remains unresolved",async()=>{
 const value=await run("before-price");expect(value.result.result).toBe("retry_same_operation");expect(value.createPrice).not.toHaveBeenCalled();expect(value.createLink).not.toHaveBeenCalled();expect(value.stages).toEqual(["price_start"]);
 expect(state.rpc).toHaveBeenCalledWith("natori_case_system_admit_v1",{p_owner:owner,p_kind:"sender"});
});
it("a price response arriving after stop is still saved; it cannot authorize the following link mutation",async()=>{
 const value=await run("after-price");expect(value.result.result).toBe("retry_same_operation");expect(value.createPrice).toHaveBeenCalledOnce();expect(value.createLink).not.toHaveBeenCalled();expect(value.attempt.price_id).toBe("price_known");expect(value.stages).toEqual(["price_start","price","link_start"]);
});
