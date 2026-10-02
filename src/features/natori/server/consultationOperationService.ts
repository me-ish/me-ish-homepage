import "server-only";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {z} from "zod";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {getSiteUrl} from "@/lib/constants";
import {resolveNatoriOwnerId} from "./natoriOwner";
import {getClientProject,getStaffConsultation,type ProjectRow} from "./consultationService";
import {extractClientEmailFromNote} from "../lib/orderMail";
import {staffConsultationHref} from "../lib/consultationOverview";
import {canonicalConsultationOperation,consultationOperationSchema,type ConsultationOperation} from "../lib/consultationOperation";
import {sealDeliveryNotification} from "./deliveryNotificationPayload";
import {scheduleAcceptanceNotifications} from "./scheduleAcceptanceNotifications";
import type {Json} from "@/types/supabase";
export type ConsultationActor={projectId:string;token?:never}|{token:string;projectId?:never};
type Context={project:ProjectRow;sender:"staff"|"client";ownerId:string|null;accessHash:string|null};
const fileRow=z.object({id:z.uuid(),path:z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf|mp3|m4a|wav)$/i),fileName:z.string().optional(),mimeType:z.string().optional(),sizeBytes:z.number().optional(),sha256:z.string().optional()});
const outcome=z.object({result:z.string(),messageId:z.uuid().optional(),notificationId:z.uuid().optional(),operationId:z.uuid().optional(),requestHash:z.string().optional(),files:z.array(fileRow).max(10).optional(),paths:z.array(z.string()).max(10).optional(),fileId:z.uuid().optional(),issuer:z.uuid().optional(),expose:z.boolean().optional()});
type Outcome=z.infer<typeof outcome>;
export type ConsultationOperationResult=
 |{kind:"committed";messageId:string;notificationId:string;operationId:string;requestHash:string}
 |{kind:"prepared";files:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]}
 |{kind:"reserved"|"verifying"|"cancelled"|"busy"|"not_found"|"invalid"|"conflict"|"too_many"|"storage_error"|"unavailable"|"configuration"|"protected"|"cleanup"};
export function hashConsultationOperation(request:ConsultationOperation):string{return createHash("sha256").update(canonicalConsultationOperation(request),"utf8").digest("hex");}
async function context(actor:ConsultationActor):Promise<Context|null>{
 if("token" in actor&&actor.token){const project=await getClientProject(actor.token);return project?{project,sender:"client",ownerId:null,accessHash:createHash("sha256").update(actor.token).digest("hex")}:null;}
 if(!actor.projectId)return null;
 const ownerId=await resolveNatoriOwnerId(),view=await getStaffConsultation(actor.projectId);
 return ownerId&&view?.project.user_id===ownerId?{project:view.project,sender:"staff",ownerId,accessHash:null}:null;
}
async function rpc(ctx:Context,request:ConsultationOperation,command:string,input:Json={},claim?:string):Promise<Outcome|null>{
 const result=await supabaseAdmin().rpc("natori_consultation_operation_v1",{p_project_id:ctx.project.id,p_sender:ctx.sender,p_operation_id:request.operationId,p_request_hash:request.requestHash,p_command:command,p_owner_id:ctx.ownerId,p_access_hash:ctx.accessHash,p_input:input,p_claim_token:claim??null});
 if(result.error){console.error("[natori-consultation-operation] transaction_unconfirmed");return null;}
 const parsed=outcome.safeParse(result.data);return parsed.success?parsed.data:null;
}
function result(row:Outcome|null):ConsultationOperationResult{
 if(!row)return{kind:"unavailable"};
 if(row.result==="committed")return row.messageId&&row.notificationId&&row.operationId&&row.requestHash?{kind:"committed",messageId:row.messageId,notificationId:row.notificationId,operationId:row.operationId,requestHash:row.requestHash}:{kind:"unavailable"};
 if(["reserved","verifying","cancelled","busy","not_found","invalid","conflict","too_many","protected","cleanup"].includes(row.result))return{kind:row.result as Exclude<ConsultationOperationResult["kind"],"prepared"|"committed"|"storage_error"|"unavailable"|"configuration">};
 return{kind:"unavailable"};
}
function notice(ctx:Context){
 const p=ctx.project,recipient=ctx.sender==="staff"?(p.client_email??extractClientEmailFromNote(p.note)):process.env.NATORI_PORTFOLIO_CONTACT_TO?.trim();
 const from=process.env.NATORI_ORDER_MAIL_FROM?.trim(),replyTo=process.env.NATORI_PORTFOLIO_CONTACT_TO?.trim();
 if(!recipient||!z.email().safeParse(recipient).success||!from||!replyTo||!z.email().safeParse(replyTo).success)throw new Error("configuration");
 const expiresAt=new Date(Date.now()+30*86400000).toISOString(),token=ctx.sender==="staff"?randomBytes(32).toString("base64url"):null;
 const url=getSiteUrl()+(token?"/natori/consult/"+token:staffConsultationHref(p.id));
 const payload={from,to:[recipient],reply_to:replyTo,subject:("【相談の返信】"+p.client_name+" 様 / "+p.title).replace(/[\r\n]/g," ").slice(0,200),text:[ctx.sender==="staff"?"相談ページに返信が届きました。以下のページで内容を確認し、ご返信ください。":"依頼者から相談ページに返信が届きました。管理画面で確認してください。","",url,"","メールへの直接返信は相談履歴へ自動では反映されません。相談ページからご返信ください。"].join("\n"),headers:{"X-Meish-Template":"natori-consultation"}};
 return{noticePayload:sealDeliveryNotification(payload,expiresAt),noticeAccessHash:token?createHash("sha256").update(token).digest("hex"):null,noticeExpiresAt:token?expiresAt:null};
}
/** Only decode this server-issued upload credential's expiry; never log or store its raw value. */
function credentialExpiry(token:string,path:string):string|null{
 try{
  const parts=token.split('.');if(parts.length!==3||!parts[1])return null;
  const parsed=z.object({exp:z.number().int().positive().safe(),url:z.literal('natori-consultations/'+path),upsert:z.literal(false)}).safeParse(JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')));
  if(!parsed.success)return null;const time=parsed.data.exp*1000;
  return Number.isFinite(time)&&time> Date.now()&&time<=8640000000000000?new Date(time).toISOString():null;
 }catch{return null;}
}
function valid(input:unknown):ConsultationOperation|null{
 const parsed=consultationOperationSchema.safeParse(input);
 return parsed.success&&hashConsultationOperation(parsed.data)===parsed.data.requestHash?parsed.data:null;
}
export async function consultationOperation(actor:ConsultationActor,input:unknown,action:"prepare"|"commit"|"lookup"|"cancel"):Promise<ConsultationOperationResult>{
 const request=valid(input);if(!request)return{kind:"invalid"};
 try{
  const ctx=await context(actor);if(!ctx)return{kind:"not_found"};
  const current=await rpc(ctx,request,"lookup"),known=result(current);
  if(known.kind==="committed"){scheduleAcceptanceNotifications([known.notificationId]);return known;}
  if(action==="lookup")return known;
  if(action==="cancel")return result(await rpc(ctx,request,"cancel"));
  if(known.kind==="cancelled"||known.kind==="conflict"||known.kind==="unavailable")return known;
  if(action==="prepare"){
   let evidence:ReturnType<typeof notice>|null=null;
   if(known.kind==="not_found"){try{evidence=notice(ctx);}catch{return{kind:"configuration"};}}
   const row=await rpc(ctx,request,"reserve",{body:request.body.trim(),files:request.files,...(evidence??{})} as Json);
   if(row?.result!=="reserved"||!row.files)return result(row);
   const files:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]=[];
   for(const reserved of row.files){
    const descriptor=request.files.find(file=>file.id===reserved.id);if(!descriptor||!reserved.path.startsWith(ctx.project.id+"/"))return{kind:"unavailable"};
    const found=await supabaseAdmin().storage.from("natori-consultations").info(reserved.path);
    if(found.data&&!found.error){if(found.data.size!==descriptor.sizeBytes||found.data.contentType!==descriptor.mimeType)return{kind:"storage_error"};files.push({id:reserved.id,path:reserved.path,uploaded:true});continue;}
    const error=found.error;
    const missing=error&&(("statusCode" in error&&String(error.statusCode)==="404")||("status" in error&&String(error.status)==="404"));
    if(!missing)return{kind:"storage_error"};
    // The durable issuer is never replaced by another prepare. A lost signer/registration
    // stays protected from cleanup; fixed timeouts cannot prove a remote credential absent.
    const issuer=randomUUID(),started=await rpc(ctx,request,'credential_begin',{fileId:reserved.id},issuer);
    if(started?.result!=='credential_started'||started.fileId!==reserved.id||started.issuer!==issuer)return result(started);
    const signed=await supabaseAdmin().storage.from("natori-consultations").createSignedUploadUrl(reserved.path,{upsert:false});
    if(signed.error||!signed.data)return{kind:"storage_error"};
    const expiresAt=credentialExpiry(signed.data.token,reserved.path);if(!expiresAt)return{kind:"storage_error"};
    const registered=await rpc(ctx,request,'credential_finish',{fileId:reserved.id,expiresAt},issuer);
    if(registered?.result!=='credential_registered'||registered.fileId!==reserved.id||registered.issuer!==issuer)return result(registered);
    if(registered.expose!==true)return{kind:"cancelled"};
    files.push({id:reserved.id,path:reserved.path,uploaded:false,uploadToken:signed.data.token});
   }
   return{kind:"prepared",files};
  }
  const token=randomUUID(),claimed=await rpc(ctx,request,"claim",{},token);
  if(claimed?.result!=="claimed"||!claimed.files)return result(claimed);
  try{
   if(claimed.files.length!==request.files.length)throw new Error("manifest_mismatch");
   for(const reserved of claimed.files){
    const descriptor=request.files.find(file=>file.id===reserved.id);
    if(!descriptor||descriptor.fileName!==reserved.fileName||descriptor.mimeType!==reserved.mimeType||descriptor.sizeBytes!==reserved.sizeBytes||descriptor.sha256!==reserved.sha256)throw new Error("manifest_mismatch");
    if((await rpc(ctx,request,"renew",{},token))?.result!=="renewed")throw new Error("stale");
    const object=await supabaseAdmin().storage.from("natori-consultations").info(reserved.path);
    if(object.error||object.data?.size!==descriptor.sizeBytes||object.data?.contentType!==descriptor.mimeType)throw new Error("storage_verification");
    const bytes=await supabaseAdmin().storage.from("natori-consultations").download(reserved.path);
    if(bytes.error||!bytes.data||bytes.data.size!==descriptor.sizeBytes)throw new Error("storage_verification");
    const digest=createHash("sha256").update(Buffer.from(await bytes.data.arrayBuffer())).digest("hex");
    if(digest!==descriptor.sha256)throw new Error("storage_verification");
   }
   if((await rpc(ctx,request,"renew",{},token))?.result!=="renewed")throw new Error("stale");
   const committed=result(await rpc(ctx,request,"commit",{verified:true},token));
   if(committed.kind==="committed")scheduleAcceptanceNotifications([committed.notificationId]);return committed;
  }catch{await rpc(ctx,request,"release",{},token);return{kind:"storage_error"};}
 }catch{console.error("[natori-consultation-operation] request_unconfirmed");return{kind:"unavailable"};}
}
/** Only exact cancelled, never-issued reservations without live lease/references may remove objects. Issued or unknown credentials require reviewed provider quiescence; elapsed expiry alone cannot prove it. No scan and no reservation delete. */
export async function cleanupConsultationOperation(actor:ConsultationActor,input:unknown):Promise<boolean>{
 const request=valid(input);if(!request)return false;const ctx=await context(actor);if(!ctx)return false;
 const proof=await rpc(ctx,request,"cleanup_scope");if(proof?.result!=="cleanup"||!proof.paths)return false;
 const pattern=new RegExp("^"+ctx.project.id+"/[a-f0-9-]{36}\\.(jpg|jpeg|png|webp|pdf|mp3|m4a|wav)$","i");
 if(!proof.paths.every(path=>pattern.test(path)))return false;
 if(proof.paths.length){const removed=await supabaseAdmin().storage.from("natori-consultations").remove(proof.paths);if(removed.error)return false;}
 return(await rpc(ctx,request,"cleanup_done",{paths:proof.paths}))?.result==="cleaned";
}

/** The first explicit retry of a pre-operation staff message freezes one legacy notification atomically. */
export async function queueLegacyConsultationNotice(projectId:string,messageId:string):Promise<string|null>{
 try{
  const ctx=await context({projectId});if(!ctx)return null;
  const evidence=notice(ctx);
  const queued=await supabaseAdmin().rpc("natori_consultation_legacy_notice_v1",{p_owner_id:ctx.ownerId!,p_project_id:projectId,p_message_id:messageId,p_payload:evidence.noticePayload,p_access_hash:evidence.noticeAccessHash,p_expires_at:evidence.noticeExpiresAt});
  if(queued.error||!queued.data)return null;scheduleAcceptanceNotifications([queued.data]);return queued.data;
 }catch{console.error("[natori-consultation-operation] legacy_notice_unconfirmed");return null;}
}

