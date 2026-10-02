import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {createHash} from "node:crypto";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),info:vi.fn(),download:vi.fn(),sign:vi.fn(),remove:vi.fn(),schedule:vi.fn(),project:{id:"11111111-2222-4333-8444-555555555555",user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",title:"Fixture",client_name:"Fixture",client_email:"fixture@example.invalid",note:null,request_data:null,status:"inquiry",deleted_at:null}}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc,storage:{from:()=>({info:m.info,download:m.download,createSignedUploadUrl:m.sign,remove:m.remove})}})}));
vi.mock("../consultationService",()=>({getClientProject:async()=>m.project,getStaffConsultation:async()=>({project:m.project,messages:[]})}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>m.project.user_id}));
vi.mock("../scheduleAcceptanceNotifications",()=>({scheduleAcceptanceNotifications:m.schedule}));
vi.mock("../deliveryNotificationPayload",()=>({sealDeliveryNotification:()=>({format:"synthetic-encrypted"})}));
import {consultationOperation,cleanupConsultationOperation,hashConsultationOperation} from "../consultationOperationService";
const op="66666666-7777-4888-8999-aaaaaaaaaaaa",fid="77777777-8888-4999-8aaa-bbbbbbbbbbbb",mid="88888888-9999-4aaa-8bbb-cccccccccccc",nid="99999999-aaaa-4bbb-8ccc-dddddddddddd";
function request(){const r={operationId:op,requestHash:"",body:"Fixture",files:[{id:fid,fileName:"fixture.png",mimeType:"image/png",sizeBytes:4,sha256:createHash("sha256").update("fake").digest("hex")}]};r.requestHash=hashConsultationOperation(r);return r;}
let commands:string[];
beforeEach(()=>{
 vi.clearAllMocks();m.sign.mockReset();commands=[];
 const r=request(),file={...r.files[0],path:m.project.id+"/"+fid+".png"};
 m.rpc.mockImplementation(async(_name:string,args:{p_command:string})=>{commands.push(args.p_command);return{error:null,data:args.p_command==="lookup"?{result:"reserved"}:args.p_command==="claim"?{result:"claimed",files:[file]}:args.p_command==="renew"?{result:"renewed"}:args.p_command==="commit"?{result:"committed",messageId:mid,notificationId:nid,operationId:op,requestHash:r.requestHash}:{result:"reserved"}};});
 m.info.mockResolvedValue({data:{size:4,contentType:"image/png"},error:null});m.download.mockResolvedValue({data:new Blob(["fake"]),error:null});m.remove.mockResolvedValue({error:null});
});
afterEach(()=>{vi.useRealTimers();});

describe("consultation verified atomic finalize",()=>{
 it("verifies stored metadata and actual bytes before one commit and schedules the saved notice",async()=>{
  const result=await consultationOperation({token:"synthetic-token"},request(),"commit");
  expect(result).toMatchObject({kind:"committed",messageId:mid,operationId:op});expect(commands).toEqual(["lookup","claim","renew","renew","commit"]);expect(m.schedule).toHaveBeenCalledExactlyOnceWith([nid]);
 });
 it.each(["metadata","bytes","download"])("keeps reservations unfinalized on %s mismatch without deleting storage",async failure=>{
  if(failure==="metadata")m.info.mockResolvedValue({data:{size:5,contentType:"image/png"},error:null});
  if(failure==="bytes")m.download.mockResolvedValue({data:new Blob(["evil"]),error:null});
  if(failure==="download")m.download.mockResolvedValue({data:null,error:{message:"temporary"}});
  expect(await consultationOperation({token:"synthetic-token"},request(),"commit")).toEqual({kind:"storage_error"});expect(commands).not.toContain("commit");expect(commands.at(-1)).toBe("release");expect(m.schedule).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();
 });
 it("replays committed receipt without signing, uploading, or verifying again",async()=>{
  m.rpc.mockResolvedValue({error:null,data:{result:"committed",messageId:mid,notificationId:nid,operationId:op,requestHash:request().requestHash}});
  expect(await consultationOperation({token:"synthetic-token"},request(),"prepare")).toMatchObject({kind:"committed",messageId:mid});expect(m.rpc).toHaveBeenCalledTimes(1);expect(m.info).not.toHaveBeenCalled();expect(m.sign).not.toHaveBeenCalled();
 });
 it("does not turn unknown storage info into permission to overwrite",async()=>{
  m.rpc.mockImplementation(async(_name:string,args:{p_command:string})=>({error:null,data:args.p_command==="lookup"?{result:"reserved"}:{result:"reserved",files:[{id:fid,path:m.project.id+"/"+fid+".png"}]}}));
  m.info.mockResolvedValue({data:null,error:{statusCode:503}});
  expect(await consultationOperation({token:"synthetic-token"},request(),"prepare")).toEqual({kind:"storage_error"});expect(m.sign).not.toHaveBeenCalled();
 });
 it("requires an exact proved cleanup scope and never removes another project path",async()=>{
  m.rpc.mockResolvedValue({error:null,data:{result:"cleanup",paths:[op+"/"+fid+".png"]}});
  expect(await cleanupConsultationOperation({token:"synthetic-token"},request())).toBe(false);expect(m.remove).not.toHaveBeenCalled();
 });
 it("removes only proved exact cancelled never-issued reservation paths",async()=>{
  const path=m.project.id+"/"+fid+".png";
  m.rpc.mockImplementation(async(_name:string,args:{p_command:string})=>({error:null,data:args.p_command==="cleanup_scope"?{result:"cleanup",paths:[path]}:{result:"cleaned"}}));
  expect(await cleanupConsultationOperation({token:"synthetic-token"},request())).toBe(true);expect(m.remove).toHaveBeenCalledExactlyOnceWith([path]);expect(m.rpc).toHaveBeenCalledTimes(2);
 });
 it("rejects changed content under the frozen digest before touching the database",async()=>{
  expect(await consultationOperation({token:"synthetic-token"},{...request(),body:"changed"},"commit")).toEqual({kind:"invalid"});expect(m.rpc).not.toHaveBeenCalled();
 });
 function syntheticUploadToken(exp=Math.floor(Date.now()/1000)+7200){
  const payload={url:'natori-consultations/'+m.project.id+'/'+fid+'.png',upsert:false,exp};
  return 'synthetic.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.not-a-valid-signature';
 }
 type CredentialArgs={p_command:string;p_claim_token?:string|null;p_input?:{fileId?:string;expiresAt?:string}};
 function prepareCredentialRpc(registration:'ok'|'cancelled'|'unknown'='ok'){
  m.rpc.mockImplementation(async(_name:string,args:CredentialArgs)=>{
   commands.push(args.p_command);
   if(args.p_command==='lookup')return{error:null,data:{result:'reserved'}};
   if(args.p_command==='reserve')return{error:null,data:{result:'reserved',files:[{id:fid,path:m.project.id+'/'+fid+'.png'}]}};
   if(args.p_command==='credential_begin')return{error:null,data:{result:'credential_started',fileId:fid,issuer:args.p_claim_token}};
   if(args.p_command==='credential_finish')return registration==='unknown'?{error:{code:'synthetic-unconfirmed'},data:null}:{error:null,data:{result:'credential_registered',fileId:fid,issuer:args.p_claim_token,expose:registration==='ok'}};
   return{error:null,data:{result:'invalid'}};
  });
  m.info.mockResolvedValue({data:null,error:{statusCode:404}});
  m.sign.mockResolvedValue({data:{token:syntheticUploadToken()},error:null});
 }
 it('registers the actual later-issued expiry before exposing any signed upload token',async()=>{
  vi.useFakeTimers();const start=Date.now();vi.setSystemTime(start);prepareCredentialRpc();
  m.sign.mockImplementation(async()=>{
   expect(commands.at(-1)).toBe('credential_begin');vi.setSystemTime(start+6*60*1000);
   return{data:{token:syntheticUploadToken()},error:null};
  });
  const value=await consultationOperation({token:'synthetic-token'},request(),'prepare');
  expect(value.kind).toBe('prepared');expect(commands).toEqual(['lookup','reserve','credential_begin','credential_finish']);
  const registration=m.rpc.mock.calls.find((call:unknown[])=>((call[1] as CredentialArgs).p_command==='credential_finish'))?.[1] as CredentialArgs;
  expect(Date.parse(registration.p_input!.expiresAt!)).toBe(Math.floor((start+6*60*1000)/1000)*1000+7200000);
  expect(m.sign).toHaveBeenCalledWith(m.project.id+'/'+fid+'.png',{upsert:false});
 });
 it('withholds a signed credential when durable expiry registration is unconfirmed',async()=>{
  prepareCredentialRpc('unknown');expect(await consultationOperation({token:'synthetic-token'},request(),'prepare')).toEqual({kind:'unavailable'});
  expect(commands.at(-1)).toBe('credential_finish');expect(m.remove).not.toHaveBeenCalled();expect(m.schedule).not.toHaveBeenCalled();
 });
 it('records a cancelled pending issuer expiry without returning its credential',async()=>{
  prepareCredentialRpc('cancelled');expect(await consultationOperation({token:'synthetic-token'},request(),'prepare')).toEqual({kind:'cancelled'});
  expect(commands.at(-1)).toBe('credential_finish');expect(m.sign).toHaveBeenCalledTimes(1);expect(m.remove).not.toHaveBeenCalled();
 });
 it('cannot sign under a replacement issuer while the first signer is pending',async()=>{
  prepareCredentialRpc();const ordinary=m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation(async(name:string,args:CredentialArgs)=>args.p_command==='credential_begin'?{error:null,data:{result:'busy'}}:ordinary(name,args));
  expect(await consultationOperation({token:'synthetic-token'},request(),'prepare')).toEqual({kind:'busy'});expect(m.sign).not.toHaveBeenCalled();
 });
 it.each(['unparseable','wrong-object','upsert','expired'])('keeps unknown issuance protected and withholds %s credentials',async failure=>{
  prepareCredentialRpc();const payload={url:'natori-consultations/'+m.project.id+'/'+fid+'.png',upsert:false,exp:Math.floor(Date.now()/1000)+7200};
  if(failure==='wrong-object')payload.url='natori-consultations/another-project/another-file.png';
  if(failure==='upsert')payload.upsert=true;
  if(failure==='expired')payload.exp=Math.floor(Date.now()/1000)-1;
  m.sign.mockResolvedValue({error:null,data:{token:failure==='unparseable'?'synthetic-unparseable':'synthetic.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.not-a-valid-signature'}});
  expect(await consultationOperation({token:'synthetic-token'},request(),'prepare')).toEqual({kind:'storage_error'});
  expect(commands).not.toContain('credential_finish');expect(m.remove).not.toHaveBeenCalled();
 });
 it('leaves a signing failure pending rather than claiming that no remote credential exists',async()=>{
  prepareCredentialRpc();m.sign.mockResolvedValue({data:null,error:{statusCode:503}});
  expect(await consultationOperation({token:'synthetic-token'},request(),'prepare')).toEqual({kind:'storage_error'});
  expect(commands.at(-1)).toBe('credential_begin');expect(m.remove).not.toHaveBeenCalled();
 });
 it('reuses an already uploaded immutable object without issuing another credential',async()=>{
  prepareCredentialRpc();m.info.mockResolvedValue({data:{size:4,contentType:'image/png'},error:null});
  expect(await consultationOperation({token:'synthetic-token'},request(),'prepare')).toMatchObject({kind:'prepared',files:[{id:fid,uploaded:true}]});
  expect(commands).toEqual(['lookup','reserve']);expect(m.sign).not.toHaveBeenCalled();
 });
 it('keeps issued/unknown or referenced paths untouched when the DB refuses cleanup',async()=>{
  m.rpc.mockImplementation(async(_name:string,args:{p_command:string})=>{commands.push(args.p_command);return{error:null,data:{result:'protected'}};});
  expect(await cleanupConsultationOperation({token:'synthetic-token'},request())).toBe(false);
  expect(commands).toEqual(['cleanup_scope']);expect(m.remove).not.toHaveBeenCalled();expect(m.schedule).not.toHaveBeenCalled();
 });
 it('does not remove any path when the exact unissued cleanup proof is unconfirmed',async()=>{
  m.rpc.mockImplementation(async(_name:string,args:{p_command:string})=>{commands.push(args.p_command);return{error:{code:'synthetic-unconfirmed'},data:null};});
  expect(await cleanupConsultationOperation({token:'synthetic-token'},request())).toBe(false);
  expect(commands).toEqual(['cleanup_scope']);expect(m.remove).not.toHaveBeenCalled();
 });

});
