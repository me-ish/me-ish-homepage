import {beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({from:vi.fn(),sign:vi.fn(),retry:vi.fn(),legacy:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({from:m.from,storage:{from:()=>({createSignedUrl:m.sign})}})}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}));
vi.mock("../notificationManagement",()=>({retryAcceptanceNotification:m.retry}));
vi.mock("../consultationOperationService",()=>({queueLegacyConsultationNotice:m.legacy}));
import {getStaffConsultation,getClientConsultation,retryStaffConsultationNotification} from "../consultationService";
const pid="11111111-2222-4333-8444-555555555555",mid="66666666-7777-4888-8999-aaaaaaaaaaaa";
let fileListError:boolean,initialListError:boolean,knownCount:number|null;
function chain(data:unknown,error:unknown=null){const q:unknown=new Proxy({},{get(_target,key){if(key==="then")return(resolve:(v:unknown)=>void)=>resolve({data,error});if(key==="maybeSingle")return async()=>({data,error});return()=>q;}});return q;}
beforeEach(()=>{
 vi.clearAllMocks();fileListError=false;initialListError=false;knownCount=1;m.sign.mockResolvedValue({data:null,error:{message:"unavailable"}});
 m.from.mockImplementation((table:string)=>chain(table==="natori_projects"?{id:pid,user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",title:"Fixture",client_name:"Fixture",request_data:{message:"Original request"},note:null,deleted_at:null,status:"inquiry"}:table==="natori_consultation_access"?{project_id:pid}:table==="natori_consultation_messages"?[{id:mid,project_id:pid,sender:"staff",body:"Saved",notification_status:"failed",notification_id:mid,created_at:"2026-10-01T00:00:00Z",attachment_count:knownCount}]:table==="natori_consultation_files"?[{id:mid,message_id:mid,storage_path:pid+"/file.png",file_name:"Saved.png",size_bytes:4}]:[{id:mid,storage_path:pid+"/initial.png"}],table==="natori_consultation_files"&&fileListError||table==="natori_inquiry_reference_files"&&initialListError?{message:"list failed"}:null));
});
describe("submitted attachment evidence survives acquisition failures",()=>{
 it("keeps signed URL failures as existing submitted rows for staff and client",async()=>{
  const staff=await getStaffConsultation(pid),client=await getClientConsultation("x".repeat(32));
  expect(staff?.messages[0].files[0]).toMatchObject({name:"Saved.png",url:null,exists:true,acquisitionState:"unavailable"});expect(client?.initialFiles[0]).toMatchObject({url:null,exists:true,acquisitionState:"unavailable"});expect(client?.initialInquiry).toBe("Original request");
 });
 it("keeps failed attachment listing distinct from a confirmed empty list",async()=>{
  fileListError=true;initialListError=true;
  const client=await getClientConsultation("x".repeat(32));expect(client?.messages[0]).toMatchObject({filesState:"unavailable",attachmentsExist:true});expect(client?.initialFilesState).toBe("unavailable");
 });
 it("marks unknown legacy counts as unknown when listing fails",async()=>{
  fileListError=true;knownCount=null;expect((await getStaffConsultation(pid))?.messages[0].attachmentsExist).toBeNull();
 });
 it("keeps per-file thrown signing errors from losing submitted rows",async()=>{
  m.sign.mockRejectedValue(new Error("unavailable"));expect((await getStaffConsultation(pid))?.messages[0].files[0]).toMatchObject({url:null,exists:true});
 });
});
