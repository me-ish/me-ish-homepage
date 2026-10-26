import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),maybeSingle:vi.fn(),fetch:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc,from:m.from})}));
import {acceptanceContext} from "../caseAcceptance";
import {casePaymentEnabled} from "../casePaymentWorkspace";
import {caseNoMailAcceptanceEnabled} from "../caseNoMailAcceptance";
import {notificationSendingEnabled,dispatchAcceptanceNotification,sendAcceptanceNotification,type NotificationPayload} from "../acceptanceNotifications";
import {reserveAcceptanceMail,acceptanceTransport,withAcceptanceMail} from "../caseAcceptanceMail";
import {assertCaseSystemAdmission} from "../caseSystemHold";
const owner="22222222-2222-4222-8222-222222222222",project="33333333-3333-4333-8333-333333333333",run="44444444-4444-4444-8444-444444444444";
const target={profile:"hosted",ref:"abcdefghijklmnopqrst",project:"prj_synthetic",url:"https://abcdefghijklmnopqrst.supabase.co",origin:"https://case-synthetic.vercel.app",run,startsAt:"2026-10-25T00:00:00Z",endsAt:"2026-10-26T00:00:00Z"};
const budget=()=>({id:run,owner_id:owner,project_ref:target.ref,origin:target.origin,provider_scope:"case-synthetic",stripe_account:"acct_synthetic",starts_at:target.startsAt,ends_at:target.endsAt,enabled:true,allowed_to:[],human_to:[],mail_limit:12,human_limit:0,used:0,human_used:0});
const payload:NotificationPayload={from:"Local <mail@example.invalid>",to:["client@example.invalid"],reply_to:"reply@example.invalid",subject:"synthetic",text:"synthetic",headers:{}};
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-25T01:00:00Z"));vi.clearAllMocks();
 for(const [key,value]of Object.entries({NATORI_CASE_ACCEPTANCE_NO_MAIL:"1",NATORI_NOTIFICATION_SENDING_ENABLED:"0",RESEND_API_KEY:"",NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET:"",NATORI_CASE_PRODUCTION_MAIL_CONNECTION:"",NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS:"",NATORI_CASE_RELEASE_ENABLED:"0",NATORI_CASE_ACCEPTANCE_TARGET:JSON.stringify(target),NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET:JSON.stringify(target),SUPABASE_URL:target.url,NEXT_PUBLIC_SUPABASE_URL:target.url,VERCEL_ENV:"preview",VERCEL_PROJECT_ID:target.project,NATORI_OWNER_USER_ID:owner,NATORI_CASE_ACCEPTANCE_MAIL_SCOPE:"case-synthetic",NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT:"acct_synthetic",NATORI_CASE_PAYMENT_WORKSPACE_ENABLED:"1",NATORI_PAYMENT_LINK_INTEGRITY_ENABLED:"1",NATORI_ACCEPTANCE_OUTBOX_ENABLED:"1",NATORI_QUOTE_INTEGRITY_ENABLED:"1",NATORI_PAYMENT_INTEGRITY_ENABLED:"1"}))vi.stubEnv(key,value);
 m.rpc.mockResolvedValue({data:{scope:"case-synthetic",account:"acct_synthetic",origin:target.origin,ref:target.ref,active:true},error:null});
 m.maybeSingle.mockResolvedValue({data:budget(),error:null});
 m.from.mockImplementation(()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:m.maybeSingle})})})}));
 vi.stubGlobal("fetch",m.fetch);
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.useRealTimers();});
describe("explicit no-mail acceptance, no production permission change",()=>{
 it("opens preparation only with all existing integrity flags and a matched run",async()=>{
  expect(caseNoMailAcceptanceEnabled()).toBe(true);expect(casePaymentEnabled()).toBe(true);
  expect(await acceptanceContext(owner,project,true)).toMatchObject({active:true});
  expect(m.from).toHaveBeenCalledWith("natori_case_acceptance_runs");
  vi.stubEnv("NATORI_PAYMENT_INTEGRITY_ENABLED","0");expect(casePaymentEnabled()).toBe(false);
 });
 it.each([['VERCEL_ENV','production'],['VERCEL_PROJECT_ID','prj_wrong'],['SUPABASE_URL','https://lvnfspyainrxtztjytbo.supabase.co'],['NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET',''],['NATORI_CASE_ACCEPTANCE_TARGET',''],['NATORI_CASE_RELEASE_ENABLED','1'],['RESEND_API_KEY','synthetic-not-a-key'],['NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET','synthetic-not-a-secret'],['NATORI_CASE_PRODUCTION_MAIL_CONNECTION','synthetic-connection'],['NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS','synthetic-not-a-secret'],['NATORI_NOTIFICATION_SENDING_ENABLED','1'],['NATORI_CASE_ACCEPTANCE_NO_MAIL','false']])("closes invalid configuration %s",(key,value)=>{
  vi.stubEnv(key,value);expect(casePaymentEnabled()).toBe(false);expect(notificationSendingEnabled()).toBe(false);
 });
 it.each([{allowed_to:["client@example.invalid"]},{human_to:["client@example.invalid"]},{human_limit:12},{used:1},{human_used:1},{mail_limit:30},{id:project},{owner_id:project},{project_ref:"wrong"},{origin:"https://other.vercel.app"},{stripe_account:"acct_wrong"},{provider_scope:"other"},{enabled:false},{ends_at:"2026-10-27T00:00:00Z"}])("rejects a changed or nonzero run contract %j before an external request",async change=>{
  m.maybeSingle.mockResolvedValue({data:{...budget(),...change},error:null});
  await expect(acceptanceContext(owner,project,true)).rejects.toThrow("acceptance_no_mail_run_invalid");expect(m.fetch).not.toHaveBeenCalled();
 });
 it("does not cache the run or infer an empty budget after a read failure",async()=>{
  await acceptanceContext(owner,project,true);m.maybeSingle.mockResolvedValue({data:null,error:{message:"private"}});
  await expect(acceptanceContext(owner,project,true)).rejects.toThrow("acceptance_no_mail_run_invalid");
 });
 it("keeps evidence reads after expiry but blocks new operations",async()=>{
  vi.setSystemTime(new Date(target.endsAt));expect(casePaymentEnabled()).toBe(true);
  expect(await acceptanceContext(owner,project,false)).toBeTruthy();
  await expect(acceptanceContext(owner,project,true)).rejects.toThrow();
 });
 it("mail_limit=12 never claims, spends, fetches or invokes an injected transport",async()=>{
  const transport=vi.fn(async()=>({status:"sent" as const,providerId:"forbidden-fake-success"}));
  await dispatchAcceptanceNotification(project,true,transport);
  expect(transport).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();expect(m.from).not.toHaveBeenCalled();
  expect(await sendAcceptanceNotification(payload,"synthetic")).toEqual({status:"failed",errorCode:"acceptance_mail_disabled"});
  await expect(reserveAcceptanceMail(owner,project,run,run,payload,{})).rejects.toThrow("acceptance_mail_disabled");
  await expect(acceptanceTransport(payload,"synthetic",()=>transport())).rejects.toThrow("acceptance_mail_disabled");
  await expect(withAcceptanceMail(null,()=>transport())).rejects.toThrow("acceptance_mail_disabled");
  await expect(assertCaseSystemAdmission("legacy-sender")).rejects.toThrow("natori_system_held");
  expect(m.rpc).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();expect(transport).not.toHaveBeenCalled();
 });
 it("default OFF does not open a normal workspace with mail disabled",()=>{
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_NO_MAIL","");expect(caseNoMailAcceptanceEnabled()).toBe(false);expect(casePaymentEnabled()).toBe(false);
  vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED","1");expect(casePaymentEnabled()).toBe(true);
 });
});
