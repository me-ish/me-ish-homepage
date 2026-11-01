import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc})}));
vi.mock("../natoriOwner",()=>({resolveNatoriManagementContext:async()=>({ownerId:"22222222-2222-4222-8222-222222222222",operator:{kind:"auth-user",userId:"33333333-3333-4333-8333-333333333333"}})}));
import {commandCaseCompletion} from "../caseCompletion";
import {caseCompletionOption,type CaseWorkView} from "../../lib/caseWork";
const id="11111111-1111-4111-8111-111111111111",req="44444444-4444-4444-8444-444444444444",revision="a".repeat(64);
const now=Date.parse("2026-11-01T10:00:00Z");
function view(patch:Partial<CaseWorkView["project"]>={},rest:Partial<CaseWorkView>={}):CaseWorkView{
 return {project:{id,status:"delivery_prep",nextAction:"-",title:"架空案件",clientName:"架空依頼者",clientEmail:null,amount:12000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:"2026-10-01T00:00:00Z",note:null,requestData:null,mutationRevision:1,tasks:[],paymentConfirmedAt:null,paidAt:null,paidAmount:null,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null,...patch},
  revision,complete:true,records:[],files:[],messages:[],release:null,operation:null,outboundBlocked:false,...rest};
}
const release=(expiresAt:string,acceptedAt:string|null=null)=>({id:req,expiresAt,acceptedAt,publishedAt:"2026-09-01T00:00:00Z"});
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:{result:"applied"},error:null});});
describe("which completion the case screen offers",()=>{
 it("offers external completion for a case taken outside the site",()=>{expect(caseCompletionOption(view(),now)).toBe("external");});
 it("does not offer external completion for a site-form case or a case recorded as a site case",()=>{
  expect(caseCompletionOption(view({requestData:{schemaVersion:1}}),now)).toBeNull();
  expect(caseCompletionOption(view({},{records:[{id:req,kind:"origin",data:{note:"x",origin:"internal"},operator:{kind:"auth-user",userId:null},created_at:"2026-10-01T00:00:00Z"}]}),now)).toBeNull();
 });
 it("offers deemed completion only after the delivery page expired without acceptance",()=>{
  expect(caseCompletionOption(view({status:"delivered"},{release:release("2026-10-30T00:00:00Z")}),now)).toBe("deemed");
  expect(caseCompletionOption(view({status:"delivered"},{release:release("2026-11-30T00:00:00Z")}),now)).toBeNull();
  expect(caseCompletionOption(view({status:"delivered"},{release:release("2026-10-30T00:00:00Z","2026-10-20T00:00:00Z")}),now)).toBeNull();
 });
 it("offers nothing once completed or closed",()=>{
  expect(caseCompletionOption(view({status:"completed",completedAt:"2026-10-20T00:00:00Z"}),now)).toBeNull();
  expect(caseCompletionOption(view({status:"closed"}),now)).toBeNull();
 });
});
describe("completion request boundary",()=>{
 it("sends server owner and operator to the fixed RPC",async()=>{
  expect(await commandCaseCompletion({command:"complete",projectId:id,revision,requestId:req,kind:"external",note:" つなぐで納品 ",completedAt:"2026-10-20T03:00:00.000Z",operator:{kind:"shared-key"}})).toEqual({result:"applied"});
  expect(m.rpc).toHaveBeenCalledWith("natori_case_complete_v1",{p_owner:"22222222-2222-4222-8222-222222222222",p_project:id,p_input:{requestId:req,revision,kind:"external",note:"つなぐで納品",completedAt:"2026-10-20T03:00:00.000Z",operator:{kind:"auth-user",userId:"33333333-3333-4333-8333-333333333333"}}});
 });
 it("deemed completion cannot choose its own date",async()=>{
  await expect(commandCaseCompletion({command:"complete",projectId:id,revision,requestId:req,kind:"deemed",note:"x",completedAt:"2026-10-20T03:00:00.000Z"})).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
 });
 it("an RPC error is an unconfirmed result, not a failure",async()=>{
  m.rpc.mockResolvedValue({data:null,error:{message:"private"}});
  await expect(commandCaseCompletion({command:"complete",projectId:id,revision,requestId:req,kind:"external",note:"x"})).rejects.toThrow("result_unconfirmed");
 });
});
