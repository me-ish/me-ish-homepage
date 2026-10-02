import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const fake=vi.hoisted(()=>({rpc:vi.fn(),owner:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:fake.rpc})}));
vi.mock("@/features/natori/server/natoriOwner",()=>({resolveNatoriOwnerId:fake.owner}));
import {loadCoherentTaskSnapshot,setTaskFromLatestDb} from "@/features/natori/server/taskIntegrityService";
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",taskId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const projection={id,status:"lineart",nextAction:"SECOND_TASK",mutationRevision:4,
 tasks:[{id:"one",label:"FIRST_TASK",stage:"rough",done:true},{id:"two",label:"SECOND_TASK",stage:"lineart",done:false}],
 paymentConfirmedAt:"2026-10-01T12:00:00Z",paidAt:"2026-10-01T12:00:00Z",paidAmount:12000,
 completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null};
beforeEach(()=>{vi.clearAllMocks();fake.owner.mockResolvedValue(owner);vi.spyOn(console,"error").mockImplementation(()=>{});});
describe("latest DB task transaction adapter",()=>{
 it("returns DB aggregate/revision and never sends a client status or whole project",async()=>{
  fake.rpc.mockResolvedValue({data:{result:"applied",project:projection},error:null});
  expect(await setTaskFromLatestDb(id,"one",true)).toEqual({kind:"ok",project:projection});
  expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("natori_update_task_v1",{p_owner:owner,p_project:id,p_task_key:"one",p_done:true});
 });
 it("returns unchanged canonical state without inventing a client revision",async()=>{
  fake.rpc.mockResolvedValue({data:{result:"unchanged",project:projection},error:null});
  expect(await setTaskFromLatestDb(id,"one",true)).toEqual({kind:"ok",project:projection});
 });
 it("terminal conflict contains fresh server facts for recovery",async()=>{
  const terminal={...projection,status:"closed",mutationRevision:7};fake.rpc.mockResolvedValue({data:{result:"conflict",project:terminal},error:null});
  expect(await setTaskFromLatestDb(id,"one",true)).toEqual({kind:"conflict",project:terminal});
 });
 it("missing owner never reaches privileged RPC",async()=>{
  fake.owner.mockResolvedValue(null);expect(await setTaskFromLatestDb(id,"one",true)).toEqual({kind:"not-found"});expect(fake.rpc).not.toHaveBeenCalled();
 });
 it.each([{data:null,error:{code:"synthetic"}},{data:{result:"applied"},error:null},
  {data:{result:"applied",project:{...projection,mutationRevision:9007199254740992}},error:null}])("unavailable or unsafe result never claims success",async response=>{
  fake.rpc.mockResolvedValue(response);expect(await setTaskFromLatestDb(id,"one",true)).toEqual({kind:"db-error"});
 });
 it("single owner-scoped snapshot preserves project fields and actual task flags",async()=>{
  const p={id,user_id:owner,status:"lineart",mutation_revision:4,deleted_at:null,title:"Synthetic",request_data:{schemaVersion:1}},
   task={id:taskId,project_id:id,task_key:"one",label:"FIRST_TASK",stage:"rough",estimated_hours:null,done:false,sort_order:0};
  fake.rpc.mockResolvedValue({data:{projects:[p],tasks:[task]},error:null});
  expect(await loadCoherentTaskSnapshot(owner,id)).toEqual({projects:[p],tasks:[task]});
  expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("natori_project_task_snapshot_v1",{p_owner:owner,p_project_ids:[id]});
 });
 it("malformed snapshot fails closed instead of attempting split query fallback",async()=>{
  fake.rpc.mockResolvedValue({data:{projects:[{id}],tasks:[]},error:null});expect(await loadCoherentTaskSnapshot(owner)).toBeNull();expect(fake.rpc).toHaveBeenCalledTimes(1);
 });
 it("valid-shaped foreign-owner/project snapshot is rejected",async()=>{
  const project={id,user_id:taskId,status:"rough",mutation_revision:4,deleted_at:null};
  fake.rpc.mockResolvedValue({data:{projects:[project],tasks:[]},error:null});expect(await loadCoherentTaskSnapshot(owner,id)).toBeNull();
 });
 it("a valid-shaped task reply for another project never becomes success",async()=>{
  fake.rpc.mockResolvedValue({data:{result:"applied",project:{...projection,id:taskId}},error:null});
  expect(await setTaskFromLatestDb(id,"one",true)).toEqual({kind:"db-error"});
 });
});
