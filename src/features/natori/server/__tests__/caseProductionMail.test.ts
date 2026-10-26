import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {createHash,createHmac} from "node:crypto";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({call:vi.fn(),jobs:vi.fn(),context:vi.fn()}));
vi.mock("../caseAcceptance",()=>({acceptanceRpc:m.call,acceptanceContext:vi.fn(),acceptanceStripeKey:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.jobs})}));
vi.mock("../caseSystemHold",()=>({assertCaseSystemAdmission:vi.fn(async()=>{})}));
vi.mock("../natoriOwner",()=>({resolveNatoriManagementContext:m.context}));
import {productionMailTarget,reserveProductionMail,withProductionMail,productionMailTags,inspectProductionMail} from "../caseProductionMail";
import {receiveCaseMailWebhook} from "../caseMailWebhook";
import {commandCaseReconciliation} from "../caseReconciliation";
import {dispatchAcceptanceNotification,type NotificationPayload} from "../acceptanceNotifications";
import {casePaymentEnabled} from "../casePaymentWorkspace";
import {caseWorkspaceReadAvailable} from "../caseWorkspaceRead";
import {caseDashboardPreviewMode} from "../caseDashboardPreview";
import {evidenceCanApply,type ReconciliationIdentity} from "../../lib/caseReconciliation";
const owner="22222222-2222-4222-8222-222222222222",project="33333333-3333-4333-8333-333333333333",job="44444444-4444-4444-8444-444444444444",claim="55555555-5555-4555-8555-555555555555",conn="66666666-6666-4666-8666-666666666666",other="77777777-7777-4777-8777-777777777777";
const target={profile:"production",ref:"abcdefghijklmnopqrst",project:"prj_synthetic",origin:"https://release.example.invalid",owner};
const credential="re_synthetic_not_real",secret="whsec_"+Buffer.alloc(32,7).toString("base64");
const payload:NotificationPayload={from:"Fixture <mail@example.invalid>",to:["client@example.invalid"],reply_to:"reply@example.invalid",subject:"Synthetic",text:"Synthetic only",headers:{"X-Meish-Template":"fixture"}};
const hash=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
const identity:ReconciliationIdentity={owner,project,target:job,quote:null,account:`resend/${conn}`,livemode:null,amount:null,currency:"jpy",purpose:"rough_ok_artist",key:`natori-notice/${job}`,requestHash:hash,payloadHash:"b".repeat(64),mailEnvironment:"production",mailConnection:conn,reference:null};
const proof=()=>({reference:"mail_fixture",occurredAt:"2026-10-25T00:59:59.123456+00:00",requestHash:hash,payloadHash:"b".repeat(64),scope:`resend/${conn}`,environment:"production",connection:conn,owner,ref:target.ref,origin:target.origin});
beforeEach(()=>{
 vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-25T01:00:00Z"));
 for(const [k,v]of Object.entries({NODE_ENV:"production",VERCEL_ENV:"production",VERCEL_PROJECT_ID:target.project,SUPABASE_URL:`https://${target.ref}.supabase.co`,NEXT_PUBLIC_SUPABASE_URL:`https://${target.ref}.supabase.co`,NEXT_PUBLIC_SITE_URL:target.origin,NATORI_OWNER_USER_ID:owner,NATORI_CASE_RELEASE_TARGET:JSON.stringify(target),NATORI_CASE_RELEASE_ENABLED:"1",NATORI_CASE_RECONCILIATION_ENABLED:"1",NATORI_CASE_PRODUCTION_MAIL_CONNECTION:conn,NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED:"1",NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS:JSON.stringify({[conn]:secret}),RESEND_API_KEY:credential}))vi.stubEnv(k,v);
 vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET",undefined);vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET",undefined);vi.stubEnv("NATORI_STRIPE_MODE",undefined);
 vi.stubGlobal("fetch",vi.fn(async()=>{throw Error("unexpected real HTTP");}));
 m.context.mockResolvedValue({ownerId:owner,operator:{kind:"auth-user",userId:owner}});
 m.call.mockImplementation(async(name:string,args:Record<string,unknown>)=>name==="natori_case_production_mail_bind_v1"?{allowed:true,scope:`resend/${conn}`,requestHash:args.p_request_hash,connection:conn}:name==="natori_case_production_mail_send_v1"?true:name==="natori_case_production_mail_evidence_v1"?proof():{result:"recorded"});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});
const reserve=()=>reserveProductionMail(owner,project,job,claim,payload,payload);
function signed(tags:unknown=[{name:"natori_job",value:job},{name:"natori_connection",value:conn},{name:"natori_hash",value:hash}],patch:Record<string,unknown>={}){
 const raw=JSON.stringify({type:"email.sent",created_at:"2026-10-25T00:59:59.123456Z",data:{email_id:"mail_fixture",tags,...patch}}),stamp=String(Math.floor(Date.now()/1000)),id="evt_fixture";
 const sig=createHmac("sha256",Buffer.from(secret.slice(6),"base64")).update(`${id}.${stamp}.${raw}`).digest("base64");
 return{raw,headers:new Headers({"svix-id":id,"svix-timestamp":stamp,"svix-signature":`v1,${sig}`})};
}
describe("production mail binding and final transport fence",()=>{
 it("default/legacy profile adds no RPC or credential requirement",async()=>{
  for(const key of ["NATORI_CASE_PRODUCTION_MAIL_CONNECTION","NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS","NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED","NATORI_CASE_RELEASE_ENABLED","NATORI_CASE_RELEASE_TARGET"])vi.stubEnv(key,undefined);
  expect(await reserve()).toBeNull();expect(m.call).not.toHaveBeenCalled();
 });
 it("publishing the flow keeps existing mail without selecting the optional evidence contract",async()=>{
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION",undefined);vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS",undefined);
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED",undefined);
  vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED","1");vi.stubEnv("NATORI_CASE_PAYMENT_WORKSPACE_ENABLED","1");
  for(const name of ["NATORI_PAYMENT_LINK_INTEGRITY_ENABLED","NATORI_ACCEPTANCE_OUTBOX_ENABLED","NATORI_QUOTE_INTEGRITY_ENABLED","NATORI_PAYMENT_INTEGRITY_ENABLED","NATORI_NOTIFICATION_SENDING_ENABLED"])vi.stubEnv(name,"1");
  expect(caseWorkspaceReadAvailable()).toBe(true);expect(caseDashboardPreviewMode()).toBe("interactive");expect(casePaymentEnabled()).toBe(true);
  expect(await reserve()).toBeNull();expect(await withProductionMail(null,()=>productionMailTags(payload,`natori-notice/${job}`))).toEqual([]);
  expect(m.call).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it.each(["1","false","invalid"])("an explicit partial mail opt-in %s never falls back to the existing sender",async flag=>{
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION",undefined);vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS",undefined);
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED",flag);
  await expect(reserve()).rejects.toThrow("unconfigured");expect(m.call).not.toHaveBeenCalled();
 });
 it.each([{provider_scope:`resend/${conn}`,provider_livemode:null},{provider_scope:"retained-scope",provider_livemode:false}])("retained scoped jobs cannot lose their evidence contract: %j",async prior=>{
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION",undefined);vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS",undefined);
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED",undefined);
  await expect(reserveProductionMail(owner,project,job,claim,payload,payload,prior)).rejects.toThrow("scope_retained");
  expect(m.call).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it.each(["sent","unknown","rejected-replay"] as const)("flow release preserves the existing claim/start/key/finish contract: %s",async outcome=>{
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION",undefined);vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS",undefined);
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED",undefined);vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED","1");
  const row={id:job,project_id:project,purpose:"payment_received_artist",payload,snapshot:{},provider_scope:null,provider_livemode:null,
   send_started_at:outcome==="rejected-replay"?new Date(Date.now()-1000).toISOString():null,lease_expires_at:new Date(Date.now()+120000).toISOString()};
  m.jobs.mockImplementation(async(name:string)=>{
   if(name==="natori_notification_claim_v1")return {data:[row],error:null};
   if(name==="natori_notification_start_v1")return {data:[{...row,send_started_at:row.send_started_at??new Date().toISOString()}],error:null};
   if(name==="natori_notification_finish_v1")return {data:true,error:null};
   throw Error("unexpected infrastructure RPC");
  });
  const transport=vi.fn(async()=>outcome==="sent"?{status:"sent" as const,providerId:"mail_existing_sender"}:outcome==="unknown"?{status:"unknown" as const,errorCode:"provider_unknown"}:{status:"failed" as const,errorCode:"provider_rejected"});
  await dispatchAcceptanceNotification(job,false,transport);
  expect(transport).toHaveBeenCalledExactlyOnceWith(payload,`natori-notice/${job}`);
  expect(m.jobs.mock.calls.map(([name])=>name)).toEqual(["natori_notification_claim_v1","natori_notification_start_v1","natori_notification_finish_v1"]);
  expect(m.jobs).toHaveBeenLastCalledWith("natori_notification_finish_v1",expect.objectContaining({p_id:job,p_status:outcome==="sent"?"sent":"unknown"}));
  expect(m.call).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it("the actual existing transport keeps the fixed endpoint, frozen payload and original idempotency key",async()=>{
  for(const name of ["NATORI_CASE_PRODUCTION_MAIL_CONNECTION","NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS","NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED"])vi.stubEnv(name,undefined);
  vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED","1");
  const row={id:job,project_id:project,purpose:"payment_received_artist",payload,snapshot:{},provider_scope:null,provider_livemode:null,send_started_at:null};
  m.jobs.mockImplementation(async(name:string)=>{
   if(name==="natori_notification_claim_v1")return {data:[row],error:null};
   if(name==="natori_notification_start_v1")return {data:[{...row,send_started_at:new Date().toISOString(),lease_expires_at:new Date(Date.now()+120000).toISOString()}],error:null};
   if(name==="natori_notification_finish_v1")return {data:true,error:null};
   throw Error("unexpected infrastructure RPC");
  });
  vi.mocked(globalThis.fetch).mockResolvedValue(Response.json({id:"mail_existing"}));
  await dispatchAcceptanceNotification(job);
  expect(globalThis.fetch).toHaveBeenCalledExactlyOnceWith("https://api.resend.com/emails",expect.objectContaining({method:"POST",body:JSON.stringify(payload),headers:expect.objectContaining({"Idempotency-Key":`natori-notice/${job}`})}));
  expect(m.jobs).toHaveBeenLastCalledWith("natori_notification_finish_v1",expect.objectContaining({p_status:"sent",p_provider_id:"mail_existing"}));
  expect(m.call).not.toHaveBeenCalled();
 });
 it.each([null,"2026-10-25T00:59:59Z"])("a previously bound job never reaches transport after its settings are removed: %s",async started=>{
  for(const name of ["NATORI_CASE_PRODUCTION_MAIL_CONNECTION","NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS","NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED"])vi.stubEnv(name,undefined);
  vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED","1");
  m.jobs.mockImplementation(async(name:string)=>name==="natori_notification_claim_v1"?{data:[{id:job,project_id:project,purpose:"payment_received_artist",payload,snapshot:{},provider_scope:`resend/${conn}`,provider_livemode:null,send_started_at:started}],error:null}:{data:true,error:null});
  const transport=vi.fn();await dispatchAcceptanceNotification(job,false,transport);
  expect(transport).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();expect(m.call).not.toHaveBeenCalled();
  expect(m.jobs.mock.calls.map(([name])=>name)).toEqual(["natori_notification_claim_v1","natori_notification_finish_v1"]);
  expect(m.jobs).toHaveBeenLastCalledWith("natori_notification_finish_v1",expect.objectContaining({p_status:started?"unknown":"failed"}));
 });
 it("binds the claimed job and frozen payload before start without inventing provider mode",async()=>{
  const bound=await reserve();expect(m.call).toHaveBeenCalledWith("natori_case_production_mail_bind_v1",expect.objectContaining({p_owner:owner,p_project:project,p_job:job,p_claim:claim,p_connection:conn,p_request_hash:hash,p_payload:payload,p_credential_hash:createHash("sha256").update(credential).digest("hex")}));
  expect(JSON.stringify(m.call.mock.calls)).not.toContain(credential);expect(m.call.mock.calls[0][1]).not.toHaveProperty("livemode");
  const tags=await withProductionMail(bound,()=>productionMailTags(payload,`natori-notice/${job}`));
  expect(tags).toEqual([{name:"natori_job",value:job},{name:"natori_connection",value:conn},{name:"natori_hash",value:hash}]);expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it.each(["owner","connection","credential","scope"])("%s mismatch cannot bless a binding",async kind=>{
  if(kind==="owner")await expect(reserveProductionMail(other,project,job,claim,payload,payload)).rejects.toThrow();
  else{m.call.mockResolvedValue(kind==="connection"?{allowed:true,connection:other,scope:`resend/${other}`,requestHash:hash}:kind==="scope"?{allowed:true,connection:conn,scope:"other",requestHash:hash}:{allowed:false});await expect(reserve()).rejects.toThrow();}
  expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it.each(["no-context","job","payload","key","connection","flag","target"])("%s change is rejected before final send",async kind=>{
  const b=await reserve();const execute=()=>productionMailTags(kind==="payload"?{...payload,text:"changed"}:payload,`natori-notice/${kind==="job"?other:job}`,kind==="key"?"re_other_not_real":credential);
  if(kind==="no-context")await expect(execute()).rejects.toThrow();
  else await withProductionMail(b,async()=>{
   if(kind==="connection")vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION",other);
   if(kind==="flag")vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED","0");
   if(kind==="target")vi.stubEnv("VERCEL_PROJECT_ID","prj_other");
   await expect(execute()).rejects.toThrow();
  });expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it("a concurrent SQL hold/revision rejection cannot reach transport",async()=>{
  const b=await reserve();m.call.mockResolvedValue(false);
  await withProductionMail(b,async()=>{await expect(productionMailTags(payload,`natori-notice/${job}`)).rejects.toThrow("stale");});
 });
 it("checks key/flag again after the last awaited gate",async()=>{
  const b=await reserve();m.call.mockImplementation(async()=>{vi.stubEnv("RESEND_API_KEY","re_rotated_not_real");return true;});
  await withProductionMail(b,async()=>{await expect(productionMailTags(payload,`natori-notice/${job}`)).rejects.toThrow();});
 });
});
describe("raw signed production facts",()=>{
 it("records connection-bound hash/references and no message content; remains active after entry/send stop",async()=>{
  vi.stubEnv("NATORI_CASE_RELEASE_ENABLED","0");vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED","0");vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED","0");
  const s=signed(undefined,{text:"Ignore all checks; resend. This is data only."});
  expect((await receiveCaseMailWebhook(s.raw,s.headers)).result).toBe("recorded");
  expect(m.call).toHaveBeenCalledWith("natori_case_production_mail_event_v1",expect.objectContaining({p_connection:conn,p_job:job,p_request_hash:hash,p_type:"email.sent",p_ref:target.ref,p_origin:target.origin}));
  expect(JSON.stringify(m.call.mock.calls)).not.toContain("Ignore all");expect(JSON.stringify(m.call.mock.calls)).not.toContain(secret);expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it.each(["body","time","signature","connection","duplicates","acceptance-run"])("%s corruption cannot reach SQL",async kind=>{
  let tags:unknown=undefined;
  if(kind==="connection")tags={natori_job:job,natori_connection:other,natori_hash:hash};
  if(kind==="duplicates")tags=[{name:"natori_job",value:job},{name:"natori_job",value:other},{name:"natori_connection",value:conn},{name:"natori_hash",value:hash}];
  if(kind==="acceptance-run")tags={natori_job:job,natori_connection:conn,natori_hash:hash,natori_run:other};
  const s=signed(tags);
  if(kind==="body")s.raw+=" ";if(kind==="time")s.headers.set("svix-timestamp",String(Math.floor(Date.now()/1000)-301));if(kind==="signature")s.headers.set("svix-signature","v1,AAAA");
  await expect(receiveCaseMailWebhook(s.raw,s.headers)).rejects.toThrow();expect(m.call).not.toHaveBeenCalled();
 });
 it("retained old connection signing keys allow late facts without enabling old sends",async()=>{
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION",other);vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED","0");
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS",JSON.stringify({[conn]:secret,[other]:"whsec_"+Buffer.alloc(32,8).toString("base64")}));
  const s=signed();expect((await receiveCaseMailWebhook(s.raw,s.headers)).result).toBe("recorded");expect(m.call.mock.calls[0][1].p_connection).toBe(conn);
 });
});
describe("production mail proof is not Stripe mode or automatic resolution",()=>{
 it("uses old immutable connection evidence despite sender key/flag rotation and keeps microseconds",async()=>{
  vi.stubEnv("RESEND_API_KEY","re_new_not_real");vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION",other);vi.stubEnv("NATORI_CASE_RELEASE_ENABLED","0");vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED","0");
  const f=await inspectProductionMail(identity);expect(f).toMatchObject({state:"confirmed",source:"provider_webhook",outcome:"accepted",occurredAt:proof().occurredAt});
  expect(evidenceCanApply("mail",f)).toBe(true);expect(m.call).toHaveBeenCalledWith("natori_case_production_mail_evidence_v1",{p_owner:owner,p_project:project,p_job:job,p_connection:conn});expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it.each([{livemode:true},{livemode:false},{account:null},{mailEnvironment:undefined},{mailConnection:undefined},{payloadHash:null},{requestHash:undefined}])("incomplete/legacy identity stays unknown: %j",async patch=>{
  const f=await inspectProductionMail({...identity,...patch});expect(f.complete).toBe(false);expect(m.call).not.toHaveBeenCalled();
 });
 it.each([{owner:other},{connection:other},{scope:"other"},{requestHash:"c".repeat(64)},{payloadHash:"c".repeat(64)},{ref:"z".repeat(20)},{environment:"acceptance"}])("mismatched proof stays unresolved: %j",async patch=>{
  m.call.mockResolvedValue({...proof(),...patch});const f=await inspectProductionMail(identity);expect(f.complete).toBe(false);expect(evidenceCanApply("mail",f)).toBe(false);
 });
 it.each([null,{result:"not_found"},{complete:false}])("missing/incomplete evidence never proves nonexecution: %j",async value=>{
  m.call.mockResolvedValue(value);expect((await inspectProductionMail(identity)).complete).toBe(false);
 });
 it("late/cancelled read cannot settle evidence",async()=>{
  const controller=new AbortController();m.call.mockImplementation(async()=>{controller.abort();return proof();});expect((await inspectProductionMail(identity,controller.signal)).complete).toBe(false);
 });
 it("default R1 path saves the signed proof separately and does not apply or send",async()=>{
  const call=vi.fn(async(_o:string,_p:string,c:string)=>c==="claim"?{result:"claimed",generation:1,identity}:{result:"saved"});
  await commandCaseReconciliation({action:"inspect",projectId:project,id:claim,kind:"mail",target:job,revision:"a".repeat(64)},{call});
  expect(call.mock.calls.map(c=>c[2])).toEqual(["claim","save"]);expect(call).toHaveBeenLastCalledWith(owner,project,"save",expect.objectContaining({facts:expect.objectContaining({identity,state:"confirmed",source:"provider_webhook",occurredAt:proof().occurredAt})}));expect(globalThis.fetch).not.toHaveBeenCalled();
 });
});
it("actual existing notification worker binds before start and preserves unknown plus exact payload/key on replay",async()=>{
 vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED","1");vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO","staff@example.invalid");vi.stubEnv("NATORI_ORDER_MAIL_FROM","Fixture <sender@example.invalid>");vi.stubEnv("NATORI_MAIL_BCC","");
 const snapshot={roughId:claim,projectId:project,title:"Synthetic",clientName:"Synthetic client",beforeQuote:true,clientOkAt:new Date().toISOString()};
 let frozen:NotificationPayload|null=null,started:string|null=null;
 m.jobs.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
  if(name==="natori_notification_claim_v1")return{data:[{id:job,project_id:project,purpose:"rough_ok_artist",snapshot,payload:frozen,send_started_at:started}],error:null};
  if(name==="natori_notification_start_v1"){expect(m.call.mock.calls.some(c=>c[0]==="natori_case_production_mail_bind_v1")).toBe(true);frozen=args.p_payload as NotificationPayload;started=new Date().toISOString();return{data:[{send_started_at:started,lease_expires_at:new Date(Date.now()+120000).toISOString()}],error:null};}
  return{data:true,error:null};
 });
 const transport=vi.fn(async()=>({status:"unknown" as const,errorCode:"provider_unknown"}));await dispatchAcceptanceNotification(job,false,transport);
 expect(transport).toHaveBeenCalledTimes(1);expect(m.jobs).toHaveBeenLastCalledWith("natori_notification_finish_v1",expect.objectContaining({p_status:"unknown"}));
 await dispatchAcceptanceNotification(job,true,async()=>({status:"failed",errorCode:"replay_rejection"}));
 expect(m.jobs).toHaveBeenLastCalledWith("natori_notification_finish_v1",expect.objectContaining({p_status:"unknown",p_error_code:"provider_unknown"}));expect(transport.mock.calls[0]).toEqual([frozen,`natori-notice/${job}`]);expect(globalThis.fetch).not.toHaveBeenCalled();
});
