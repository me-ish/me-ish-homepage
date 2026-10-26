import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),send:vi.fn(),admit:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc,from:m.from})}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>"60000000-0000-4000-8000-000000000002"}));
vi.mock("../caseSystemHold",()=>({assertCaseSystemAdmission:m.admit}));
vi.mock("resend",()=>({Resend:class{emails={send:m.send};}}));
const PROJECT_ID="60000000-0000-4000-8000-000000000001",OWNER_ID="60000000-0000-4000-8000-000000000002",PRESET_ID="60000000-0000-4000-8000-000000000003",QUOTE_ID="60000000-0000-4000-8000-000000000004";
function validInput() {
  return {
    ownerId: OWNER_ID,
    projectId: PROJECT_ID,
    title: "一枚絵制作",
    clientName: "依頼者",
    toEmail: "client@example.com",
    subject: "正式見積のご案内",
    bodySnapshot: "正式見積の本文です。",
    tokenHash: "a".repeat(64),
    expiresAt: "2099-08-02T00:00:00.000Z",
    idempotencyKey: `quote:${PROJECT_ID}:attempt-1`,
    requestSnapshot: null,
    pricingSnapshot: {
      schemaVersion: 1 as const,
      mappingVersion: "natori-pricing-mapping-v1",
      pricingConfigVersion: 1,
      pricingPresetId: PRESET_ID,
      pricingPresetNameSnapshot: "標準料金",
      projectTypeSnapshot: "illustration" as const,
      items: [
        {
          id: "base:illustration",
          presetItemId: "illustration",
          kind: "base" as const,
          labelSnapshot: "一枚絵",
          quantity: 1,
          unitAmount: 10000,
          amount: 10000,
          automatic: true,
          sourceFields: ["project.type"],
          ruleId: "base:illustration",
          note: null,
        },
      ],
      reviewItems: [],
      reviewResolutions: [],
      subtotalBeforePercentage: 10000,
      total: 10000,
      currency: "JPY" as const,
      issuedAt: "2026-08-02T00:00:00.000Z",
    },
  };
}

beforeEach(()=>{vi.resetAllMocks();vi.resetModules();for(const k of ["NATORI_QUOTE_INTEGRITY_ENABLED","NATORI_PAYMENT_LINK_INTEGRITY_ENABLED","NATORI_PAYMENT_INTEGRITY_ENABLED","NATORI_STRIPE_MODE"])vi.stubEnv(k,undefined);for(const k of ["NATORI_ACCEPTANCE_OUTBOX_ENABLED","NATORI_NOTIFICATION_SENDING_ENABLED","NATORI_DELIVERY_INTEGRITY_ENABLED"])vi.stubEnv(k,"1");vi.stubEnv("RESEND_API_KEY","synthetic");vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://example.invalid");vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED","1");m.admit.mockResolvedValue(undefined);m.send.mockResolvedValue({data:{id:"synthetic-provider"},error:null});const project={id:PROJECT_ID,user_id:OWNER_ID,title:"一枚絵制作",client_name:"依頼者",status:"estimating"};const q={id:QUOTE_ID,project_id:PROJECT_ID,user_id:OWNER_ID,subject:"Synthetic",body_snapshot:"Synthetic",to_email:"client@example.com",expires_at:new Date(Date.now()+86400000).toISOString(),accepted_at:null,version:1,amount:10000};m.from.mockImplementation((table:string)=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==="natori_projects"?project:q,error:null})};return chain;});let operation:Record<string,unknown>|null=null;m.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{if(name==="natori_case_current_claim_v1"){if(operation)return {data:{result:"existing",operation},error:null};operation={id:args.p_id,kind:args.p_kind,status:"running",response:null,quote_id:QUOTE_ID,sent_at:null,created_at:new Date().toISOString(),version:1};return {data:{result:"claimed"},error:null};}if(name==="natori_issue_quote_from_draft_v1")return {data:[{quote_id:QUOTE_ID,version:1,reused:false}],error:null};if(name==="natori_case_current_step_v1"){if(args.p_action==="issue_quote")return {data:[{quote_id:QUOTE_ID,version:1,reused:false}],error:null};if(args.p_action==="mail_accepted")operation!.sent_at=new Date().toISOString();if(["finish","unknown"].includes(String(args.p_action))){operation!.status=args.p_action==="finish"&&operation!.sent_at?"completed":"unknown";operation!.response=operation!.status==="completed"?(args.p_input as {response:unknown}).response:null;return {data:{status:operation!.status},error:null};}return {data:true,error:null};}if(name==="natori_case_current_read_v1")return {data:operation,error:null};throw Error("unexpected "+name);});});
afterEach(()=>{vi.unstubAllEnvs();});
function input(){const v=validInput();return {...v,expiresAt:new Date(Date.now()+86400000).toISOString(),acceptToken:"a".repeat(64),workspaceRevision:"b".repeat(64),draftRevision:1,pricingSnapshot:{...v.pricingSnapshot,agreedTerms:{deliverables:"Synthetic",scope:"full_body" as const,scopeNote:"",usage:"Synthetic",commercialUse:"no" as const,publication:"Synthetic",dueDate:"2099-12-01",memo:""}}};}
describe("current production quote path",()=>{
 it("uses the original draft RPC and direct Resend once, not the new notification writer",async()=>{const s=await import("../structuredQuoteService"),v=input();expect(await s.issueStructuredQuoteAndSend(v)).toMatchObject({kind:"ok",quoteId:QUOTE_ID,version:1,notificationStatus:"sent"});expect(await s.issueStructuredQuoteAndSend(v)).toMatchObject({kind:"ok"});expect(m.send).toHaveBeenCalledTimes(1);expect(m.rpc.mock.calls.filter(c=>c[0]==="natori_case_current_step_v1"&&c[1].p_action==="issue_quote")).toHaveLength(1);expect(m.rpc.mock.calls.some(c=>c[0]==="natori_case_issue_quote_v1")).toBe(false);});
 it("lost mail response retains exact operation for read-only recovery, never repeats provider send",async()=>{m.send.mockRejectedValue(Error("synthetic timeout"));const s=await import("../structuredQuoteService"),v=input();expect(await s.issueStructuredQuoteAndSend(v)).toEqual({kind:"result-unconfirmed"});expect(await s.issueStructuredQuoteAndSend(v)).toEqual({kind:"result-unconfirmed"});expect(await s.getStructuredQuoteRecovery(PROJECT_ID,v.idempotencyKey)).toMatchObject({lookupOnly:true,issue:{quoteId:QUOTE_ID,version:1,notificationStatus:"unknown"}});expect(m.send).toHaveBeenCalledTimes(1);});
 it("renotifies the same saved quote through direct mail without creating a new version",async()=>{const s=await import("../structuredQuoteService");expect(await s.renotifyStructuredQuote(QUOTE_ID,PRESET_ID,"a".repeat(64))).toMatchObject({kind:"ok",version:1,quoteId:QUOTE_ID});expect(m.rpc.mock.calls.some(c=>c[0]==="natori_issue_quote_from_draft_v1")).toBe(false);expect(m.send).toHaveBeenCalledTimes(1);});
});
