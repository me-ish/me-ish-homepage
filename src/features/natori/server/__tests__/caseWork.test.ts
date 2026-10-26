import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),issue:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc})}));
vi.mock("../natoriOwner",()=>({resolveNatoriManagementContext:async()=>({ownerId:"22222222-2222-4222-8222-222222222222",operator:{kind:"auth-user",userId:"33333333-3333-4333-8333-333333333333"}})}));
vi.mock("../deliveryReleaseService",()=>({issueReadyDelivery:m.issue}));
import {commandCaseDelivery,commandCaseWork,readCaseWork} from "../caseWork";
import {caseWorkCommand} from "../../lib/caseWork";
const id="11111111-1111-4111-8111-111111111111",op="44444444-4444-4444-8444-444444444444",file="55555555-5555-4555-8555-555555555555",revision="a".repeat(64);
function view(){return {project:{id,status:"delivery_prep",nextAction:"納品準備",title:"架空案件",clientName:"架空依頼者",clientEmail:"synthetic@example.invalid",amount:12000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:new Date().toISOString(),note:null,requestData:null,mutationRevision:1,tasks:[],paymentConfirmedAt:new Date().toISOString(),paidAt:null,paidAmount:12000,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null},revision,complete:true,records:[],files:[{id:file,fileName:"synthetic.png",sizeBytes:4,version:"v1",verifiedAt:"2026-10-20T00:00:00Z",state:"ready"}],messages:[],release:null,operation:null,outboundBlocked:false};}
function request(){const preparedAt=new Date().toISOString();return{projectId:id,operationId:op,revision,to:"synthetic@example.invalid",subject:"架空納品",body:"{納品リンク}",fileIds:[file],files:view().files,preparedAt,expiresAt:new Date(Date.parse(preparedAt)+30*86400000).toISOString()};}
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:view(),error:null});m.issue.mockResolvedValue({kind:"ok",releaseId:file,notificationStatus:"unknown"});});
describe("R2 work command boundary",()=>{
 it("uses a fixed read RPC with server owner and GET semantics",async()=>{await readCaseWork(id);expect(m.rpc).toHaveBeenCalledWith("natori_case_work_read_v1",{p_owner:"22222222-2222-4222-8222-222222222222",p_project:id,p_operation:undefined},{get:true});expect(m.issue).not.toHaveBeenCalled();});
 it("does not expose another project's projection",async()=>{m.rpc.mockResolvedValue({data:{...view(),project:{...view().project,id:op}},error:null});await expect(readCaseWork(id)).rejects.toThrow("scope_mismatch");});
 it("incomplete work collection is not an empty complete view",async()=>{m.rpc.mockResolvedValue({data:{...view(),complete:false},error:null});await expect(readCaseWork(id)).rejects.toThrow();});
 it.each(["origin","revision_open","revision_handled","manual_receipt"])("rejects missing %s evidence before RPC",async kind=>{await expect(commandCaseWork({command:"record",projectId:id,revision,id:op,kind,data:{note:"架空根拠"}})).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled();});
 it("passes only server actor to an attributed record",async()=>{m.rpc.mockResolvedValue({data:{result:"applied"},error:null});await commandCaseWork({command:"record",projectId:id,revision,id:op,kind:"origin",data:{origin:"external",note:"担当記録"},operator:{kind:"shared-key"}});expect(m.rpc.mock.calls[0][1].p_input.operator).toEqual({kind:"auth-user",userId:"33333333-3333-4333-8333-333333333333"});});
 it("rejects amount/contract edits in metadata",()=>{expect(caseWorkCommand.safeParse({command:"metadata",projectId:id,revision,data:{amount:1}}).success).toBe(false);});
});
describe("R2 delivery confirmation and result lookup",()=>{
 it("submits frozen metadata and original deadline through guarded service",async()=>{const input=request();await commandCaseDelivery(input);expect(m.issue).toHaveBeenCalledWith({...input,workspace:{revision,expiresAt:input.expiresAt}});});
 it.each(["unknown","sent","failed","sending"])("existing %s operation is a pure lookup and never redispatches",async status=>{m.rpc.mockResolvedValue({data:{...view(),operation:{id:op,releaseId:file,notificationId:id,status}},error:null});expect(await commandCaseDelivery(request())).toMatchObject({kind:"recorded"});expect(m.issue).not.toHaveBeenCalled();});
 it("unknown sibling prevents a new operation",async()=>{m.rpc.mockResolvedValue({data:{...view(),outboundBlocked:true},error:null});expect(await commandCaseDelivery(request())).toEqual({kind:"notice-pending"});expect(m.issue).not.toHaveBeenCalled();});
 it("a stale confirmation cannot publish",async()=>{expect(await commandCaseDelivery({...request(),revision:"b".repeat(64)})).toEqual({kind:"confirmation-stale"});expect(m.issue).not.toHaveBeenCalled();});
 it("expired preparation requires confirmation again with same operation identity",async()=>{const r=request();r.preparedAt=new Date(Date.now()-61000).toISOString();r.expiresAt=new Date(Date.parse(r.preparedAt)+30*86400000).toISOString();expect(await commandCaseDelivery(r)).toEqual({kind:"confirmation-stale"});expect(m.issue).not.toHaveBeenCalled();});
 it("client cannot lengthen the fixed first delivery period",async()=>{const r=request();r.expiresAt=new Date(Date.parse(r.preparedAt)+31*86400000).toISOString();expect(await commandCaseDelivery(r)).toEqual({kind:"confirmation-stale"});expect(m.issue).not.toHaveBeenCalled();});
 it("resend keeps the canonical release deadline rather than restarting 30 days",async()=>{const r=request(),expiresAt=new Date(Date.now()+86400000).toISOString();m.rpc.mockResolvedValue({data:{...view(),release:{id:file,expiresAt,publishedAt:r.preparedAt,acceptedAt:null}},error:null});expect(await commandCaseDelivery(r)).toEqual({kind:"confirmation-stale"});await commandCaseDelivery({...r,expiresAt});expect(m.issue).toHaveBeenCalledTimes(1);});
 it("extension accepts only existing allowed days and explicit reason",async()=>{await expect(commandCaseDelivery({...request(),extension:{days:100,reason:"test"}})).rejects.toThrow();expect(m.issue).not.toHaveBeenCalled();});
});
