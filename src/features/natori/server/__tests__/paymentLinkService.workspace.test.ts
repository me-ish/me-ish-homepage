import {beforeEach,afterEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../caseSystemHold",async importOriginal=>({...await importOriginal<typeof import('../caseSystemHold')>(),assertCaseSystemAdmission:vi.fn(async()=>{})}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>"11111111-1111-4111-8111-111111111111"}));
vi.mock("../acceptanceNotifications",()=>({buildAcceptanceNotificationPayload:vi.fn(),dispatchAcceptanceNotification:vi.fn()}));
import {executePaymentLinkOperation,type PaymentLinkProvider,type PaymentLinkRpc} from "../paymentLinkService";
const project="22222222-2222-4222-8222-222222222222",operation="33333333-3333-4333-8333-333333333333",notice="44444444-4444-4444-8444-444444444444";
beforeEach(()=>{for(const key of ['NATORI_PAYMENT_LINK_INTEGRITY_ENABLED','NATORI_ACCEPTANCE_OUTBOX_ENABLED','NATORI_QUOTE_INTEGRITY_ENABLED','NATORI_PAYMENT_INTEGRITY_ENABLED'])vi.stubEnv(key,"1");vi.stubEnv("NATORI_STRIPE_MODE","test");vi.stubEnv("NATORI_DELIVERY_NOTIFICATION_KEY","a".repeat(64));});
afterEach(()=>vi.unstubAllEnvs());
it.each(["operation","begin"])("does not redispatch when a concurrent workspace confirm already completed at %s",async completedAt=>{
 const dispatch=vi.fn(),create=vi.fn(async()=>{throw Error("creation must not occur");});
 const external:PaymentLinkProvider={accountId:async()=>"acct_fixture",createPrice:create,createLink:create,readLink:create,findLink:create,sessions:create,expireSession:create,stopLink:create};
 const call=vi.fn<PaymentLinkRpc>(async(_owner,_project,command)=>command===completedAt?{result:"completed",notificationId:notice}:{result:command==="operation"?"absent":command==="outbound_gate"?"allowed":"ok"});
 const result=await executePaymentLinkOperation({projectId:project,operationId:operation,action:"issue",deadline:new Date(Date.now()+86400000).toISOString(),to:"synthetic@example.invalid",subject:"合成案内",body:"{支払リンク}"},external,{rpc:call,dispatch});
 expect(result.result).toBe("completed");expect(dispatch).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();expect(call.mock.calls.map(c=>c[2])).toEqual(completedAt==="operation"?["operation"]:["operation","outbound_gate","context","begin"]);
});

it("reissue recovery always rechecks the pinned old generation after an interrupted Session stop",async()=>{
 const quote="55555555-5555-4555-8555-555555555555",priorId="66666666-6666-4666-8666-666666666666",newId="77777777-7777-4777-8777-777777777777";
 const prior={id:priorId,project_id:project,quote_id:quote,generation:1,amount:12000,livemode:false,provider_account_id:"acct_fixture",state:"inactive",price_id:"price_old",link_id:"plink_old",link_url:"https://buy.stripe.com/old",deadline:new Date(Date.now()+86400000).toISOString(),deadline_revision:1,claim_generation:1,price_started_at:null,link_started_at:null};
 const current={...prior,id:newId,generation:2,state:"creating",price_id:null,link_id:null,link_url:null};
 let attempts=0;
 const call=vi.fn<PaymentLinkRpc>(async(_owner,_project,command)=>{
  if(command==="operation")return {result:"pending"};
  if(command==="outbound_gate")return {result:"allowed"};
  if(command==="context")return {result:"ok",attempt:attempts?current:prior};
  if(command==="begin"){attempts++;return {result:"claimed",attempt:current};}
  if(command==="reissue_source")return {result:"ok",attempt:prior};
  if(command==="stage")return {result:"saved",attempt:current};
  throw Error("unexpected write");
 });
 const create=vi.fn(async()=>{throw Error("must not create while old Session remains uncertain");});
 const sessions=vi.fn(async()=>[{id:"cs_old",status:"open",paymentStatus:"unpaid"}]);
 const external:PaymentLinkProvider={accountId:async()=>"acct_fixture",createPrice:create,createLink:create,readLink:vi.fn(async()=>({id:"plink_old",url:prior.link_url,active:false,livemode:false,projectId:project,quoteId:quote,kind:"natori_commission",attemptId:priorId,generation:"1",priceId:"price_old",amount:12000,currency:"jpy"})),findLink:create,sessions,expireSession:vi.fn(async()=>{throw Error("provider response lost");}),stopLink:create};
 const request={projectId:project,operationId:operation,action:"reissue",confirmed:true,deadline:new Date(Date.now()+86400000).toISOString(),to:"synthetic@example.invalid",subject:"合成案内",body:"{支払リンク}"};
 expect((await executePaymentLinkOperation(request,external,{rpc:call})).result).toBe("retry_same_operation");
 expect((await executePaymentLinkOperation(request,external,{rpc:call})).result).toBe("retry_same_operation");
 expect(call.mock.calls.filter(c=>c[2]==="reissue_source")).toHaveLength(2);expect(sessions).toHaveBeenCalledTimes(2);expect(external.expireSession).toHaveBeenCalledTimes(2);expect(create).not.toHaveBeenCalled();
});
