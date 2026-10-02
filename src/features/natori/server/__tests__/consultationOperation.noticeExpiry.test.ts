import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {createHash,randomBytes} from "node:crypto";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),info:vi.fn(),download:vi.fn(),sign:vi.fn(),remove:vi.fn(),schedule:vi.fn(),project:{id:"11111111-2222-4333-8444-555555555555",user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",title:"Fixture",client_name:"Fixture",client_email:"original@phase3b.invalid",note:null,request_data:null,status:"inquiry",deleted_at:null}}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc,storage:{from:()=>({info:m.info,download:m.download,createSignedUploadUrl:m.sign,remove:m.remove})}})}));
vi.mock("../consultationService",()=>({getClientProject:async()=>m.project,getStaffConsultation:async()=>({project:m.project,messages:[]})}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>m.project.user_id}));
vi.mock("../scheduleAcceptanceNotifications",()=>({scheduleAcceptanceNotifications:m.schedule}));
import {consultationOperation,hashConsultationOperation} from "../consultationOperationService";
import {consultationOperationResponse} from "../consultationOperationResponse";
import {sealDeliveryNotification,openDeliveryNotification} from "../deliveryNotificationPayload";
const op="66666666-7777-4888-8999-aaaaaaaaaaaa",fid="77777777-8888-4999-8aaa-bbbbbbbbbbbb",mid="88888888-9999-4aaa-8bbb-cccccccccccc",nid="99999999-aaaa-4bbb-8ccc-dddddddddddd";
function request(){const r={operationId:op,requestHash:"",body:"Original body",files:[{id:fid,fileName:"fixture.png",mimeType:"image/png",sizeBytes:4,sha256:createHash("sha256").update("fake").digest("hex")}]};r.requestHash=hashConsultationOperation(r);return r;}
type Args={p_command:string;p_claim_token:string|null;p_operation_id:string;p_request_hash:string;p_input:Record<string,unknown>};
let commands:Args[];
beforeEach(()=>{vi.clearAllMocks();commands=[];m.project.client_email="original@phase3b.invalid";m.info.mockResolvedValue({data:{size:4,contentType:"image/png"},error:null});m.download.mockResolvedValue({data:new Blob(["fake"]),error:null});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
function ordinary(args:Args){const r=request();return args.p_command==="lookup"?{result:"reserved"}:args.p_command==="claim"?{result:"claimed",files:[{...r.files[0],path:m.project.id+"/"+fid+".png"}]}:args.p_command==="renew"?{result:"renewed"}:args.p_command==="commit"?{result:"committed",messageId:mid,notificationId:nid,operationId:op,requestHash:r.requestHash}:{result:args.p_command==="cancel"?"cancelled":"reserved"};}
describe("consultation frozen notification expiry",()=>{
 it.each(["lookup","prepare","commit"] as const)("returns definitive notice_expired on %s without touching a frozen reservation",async action=>{
  m.rpc.mockImplementation(async(_name:string,args:Args)=>{commands.push(args);return{error:null,data:{result:"notice_expired"}};});
  const input=request(),frozen=JSON.stringify(input);expect(await consultationOperation({projectId:m.project.id},input,action)).toEqual({kind:"notice_expired"});
  expect(commands.map(value=>value.p_command)).toEqual(["lookup"]);expect(JSON.stringify(input)).toBe(frozen);expect(m.sign).not.toHaveBeenCalled();expect(m.info).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();expect(m.schedule).not.toHaveBeenCalled();
 });
 it("allows explicit cancellation of an expired operation without rewriting its original content",async()=>{
  m.rpc.mockImplementation(async(_name:string,args:Args)=>{commands.push(args);return{error:null,data:{result:args.p_command==="lookup"?"notice_expired":"cancelled"}};});
  const input=request(),frozen=JSON.stringify(input);expect(await consultationOperation({projectId:m.project.id},input,"cancel")).toEqual({kind:"cancelled"});expect(commands.map(value=>value.p_command)).toEqual(["lookup","cancel"]);expect(JSON.stringify(input)).toBe(frozen);expect(m.remove).not.toHaveBeenCalled();
 });
 it.each(["claim","first-renew","final-renew","commit"] as const)("preserves the expired result at %s and releases only the matching current verifier",async stage=>{
  let renew=0;m.rpc.mockImplementation(async(_name:string,args:Args)=>{commands.push(args);if(args.p_command==="renew")renew++;
   const expired=stage===args.p_command||(stage==="first-renew"&&args.p_command==="renew"&&renew===1)||(stage==="final-renew"&&args.p_command==="renew"&&renew===2);
   return{error:null,data:expired?{result:"notice_expired"}:ordinary(args)};
  });
  expect(await consultationOperation({projectId:m.project.id},request(),"commit")).toEqual({kind:"notice_expired"});
  const claim=commands.find(value=>value.p_command==="claim")!;
  const releases=commands.filter(value=>value.p_command==="release");expect(releases).toHaveLength(stage==="claim"?0:1);
  if(stage!=="claim")expect(releases[0]).toMatchObject({p_claim_token:claim.p_claim_token,p_operation_id:op,p_request_hash:request().requestHash});
  expect(m.schedule).not.toHaveBeenCalled();expect(m.sign).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();
 });
 it("releases its matching verifier after a final expiry rollback while retaining the unknown receipt identity",async()=>{
  m.rpc.mockImplementation(async(_name:string,args:Args)=>{commands.push(args);return args.p_command==="commit"?{error:{code:"40001"},data:null}:{error:null,data:ordinary(args)};});
  const input=request(),frozen=JSON.stringify(input);expect(await consultationOperation({projectId:m.project.id},input,"commit")).toEqual({kind:"unavailable"});expect(commands.at(-1)?.p_command).toBe("release");expect(commands.at(-1)?.p_claim_token).toBe(commands.find(value=>value.p_command==="claim")?.p_claim_token);expect(JSON.stringify(input)).toBe(frozen);expect(m.schedule).not.toHaveBeenCalled();
 });
 it("returns an already committed receipt before considering an expired snapshot",async()=>{
  m.rpc.mockImplementation(async(_name:string,args:Args)=>{commands.push(args);return{error:null,data:{result:"committed",messageId:mid,notificationId:nid,operationId:op,requestHash:request().requestHash}};});
  expect(await consultationOperation({projectId:m.project.id},request(),"prepare")).toMatchObject({kind:"committed",messageId:mid,notificationId:nid});expect(commands.map(value=>value.p_command)).toEqual(["lookup"]);expect(m.sign).not.toHaveBeenCalled();
 });
 it("keeps the standard encrypted envelope expiry refusal after a 31-day clock advance",async()=>{
  vi.useFakeTimers();const start=Date.now();vi.stubEnv("NATORI_DELIVERY_NOTIFICATION_KEY",randomBytes(32).toString("hex"));
  const snapshot={to:["original@phase3b.invalid"],text:"Original frozen notice"};const envelope=sealDeliveryNotification(snapshot,new Date(start+30*86400000).toISOString());expect(openDeliveryNotification(envelope)).toEqual(snapshot);
  const before=JSON.stringify(envelope);vi.setSystemTime(start+31*86400000);m.project.client_email="changed@phase3b.invalid";
  expect(()=>openDeliveryNotification(envelope)).toThrow("delivery_mail_configuration");expect(JSON.stringify(envelope)).toBe(before);
  m.rpc.mockResolvedValue({error:null,data:{result:"notice_expired"}});expect(await consultationOperation({projectId:m.project.id},request(),"commit")).toEqual({kind:"notice_expired"});expect(m.schedule).not.toHaveBeenCalled();expect(m.sign).not.toHaveBeenCalled();
 });
 it("returns HTTP409 without a success receipt for definitive notice expiry",async()=>{
  const response=consultationOperationResponse({kind:"notice_expired"});expect(response.status).toBe(409);expect(await response.json()).toEqual({kind:"notice_expired",ok:false});
 });
});
