import "server-only";

import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { getSiteUrl } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";
import { extractClientEmailFromNote } from "@/features/natori/lib/orderMail";
import { parseInquiryNote } from "@/features/natori/lib/inquiryNoteView";
import type { Json } from "@/types/supabase";

const TOKEN_RE = /^[A-Za-z0-9_-]{30,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FROM = process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>";
const REPLY_TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";

export type ProjectRow = { id: string; user_id: string; title: string; client_name: string; client_email: string | null; note: string | null; request_data: Json | null; status: string; deleted_at: string | null };
type MessageRow = { id: string; project_id: string; sender: string; body: string; notification_status: string; created_at: string; attachment_count?: number | null };
import type { ConsultationFile, ConsultationMessage } from "@/features/natori/types/consultation";
export type { ConsultationFile, ConsultationMessage } from "@/features/natori/types/consultation";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function asMessage(row: MessageRow, files: ConsultationFile[]): ConsultationMessage {
  return { id: row.id, sender: row.sender as "staff" | "client", body: row.body, notificationStatus: row.notification_status, createdAt: row.created_at, files };
}

async function getProject(projectId: string, ownerId?: string): Promise<ProjectRow | null> {
  const admin = supabaseAdmin();
  let query = admin.from("natori_projects")
    .select("id, user_id, title, client_name, client_email, note, request_data, status, deleted_at")
    .eq("id", projectId);
  if (ownerId) query = query.eq("user_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[natori-consultation] project lookup failed", error);
    return null;
  }
  return data as ProjectRow | null;
}

export async function getClientProject(token: string): Promise<ProjectRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data, error } = await supabaseAdmin().from("natori_consultation_access")
    .select("project_id")
    .eq("token_hash", hash(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return getProject(data.project_id);
}

async function getMessages(projectId: string): Promise<ConsultationMessage[] | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("natori_consultation_messages")
    .select("id, project_id, sender, body, notification_status, created_at, attachment_count")
    .eq("project_id",projectId).order("created_at",{ascending:true}).order("id",{ascending:true});
  if(error){console.error("[natori-consultation] message_list_unavailable");return null;}
  const {data:fileRows,error:fileError}=await admin.from("natori_consultation_files")
    .select("id, message_id, storage_path, file_name, size_bytes").eq("project_id",projectId);
  if(fileError)console.error("[natori-consultation] file_list_unavailable");
  const signed=await Promise.all((fileRows??[]).map(async file=>{
    let url:string|null=null;
    try{const signed=await admin.storage.from("natori-consultations").createSignedUrl(file.storage_path,600,{download:file.file_name});
      if(!signed.error&&signed.data)url=signed.data.signedUrl;
    }catch{console.error("[natori-consultation] file_link_unavailable");}
    return{messageId:file.message_id,file:{id:file.id,name:file.file_name,sizeBytes:file.size_bytes,url,exists:true as const,acquisitionState:url?"ready" as const:"unavailable" as const}};
  }));
  const byMessage=new Map<string,ConsultationFile[]>();
  for(const entry of signed)byMessage.set(entry.messageId,[...(byMessage.get(entry.messageId)??[]),entry.file]);
  return ((data??[]) as MessageRow[]).map(row=>{
    const files=byMessage.get(row.id)??[];
    return{...asMessage(row,files),filesState:fileError?"unavailable" as const:"ready" as const,
      attachmentsExist:fileError?(typeof row.attachment_count==="number"?row.attachment_count>0:null):files.length>0};
  });
}

export async function getStaffConsultation(projectId: string) {
  if (!UUID_RE.test(projectId)) return null;
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return null;
  const project = await getProject(projectId, ownerId);
  if (!project) return null;
  const messages = await getMessages(projectId);
  return messages === null ? null : { project, messages };
}

export async function getClientConsultation(token: string) {
  const project = await getClientProject(token);
  if (!project) return null;
  const messages = await getMessages(project.id);
  const { data: referenceRows, error: referenceError } = await supabaseAdmin()
    .from("natori_inquiry_reference_files").select("id, storage_path")
    .eq("project_id", project.id).order("created_at", { ascending: true });
  if (referenceError) console.error("[natori-consultation] initial reference list failed", referenceError);
  const initialFiles = await Promise.all((referenceRows??[]).map(async(row,index)=>{
    let url:string|null=null;
    try{const signed=await supabaseAdmin().storage.from("natori-inquiry-refs").createSignedUrl(row.storage_path,600,{download:true});
      if(!signed.error&&signed.data)url=signed.data.signedUrl;
    }catch{console.error("[natori-consultation] initial_file_link_unavailable");}
    return{id:row.id,name:"受付時の資料 "+(index+1),url,exists:true as const,acquisitionState:url?"ready" as const:"unavailable" as const};
  }));
  const request = project.request_data;
  const initialInquiry = request && typeof request === "object" && !Array.isArray(request) && typeof request.message === "string"
    ? request.message
    : parseInquiryNote(project.note).message || parseInquiryNote(project.note).details;
  return messages === null ? null : { title: project.title, clientName: project.client_name, initialInquiry, initialFiles, initialFilesState:referenceError?"unavailable" as const:"ready" as const, messages, closed: project.status === "closed" || Boolean(project.deleted_at) };
}

export type SendConsultationResult="ok"|"notification-failed"|"not-found"|"invalid"|"db-error"|"update-required";
/** Old text-only clients must update; they cannot create an unkeyed message. */
export async function sendStaffConsultation(_projectId:string,_body:string):Promise<SendConsultationResult>{return "update-required";}
export async function sendClientConsultation(_token:string,_body:string):Promise<SendConsultationResult>{return "update-required";}
/** Notification retry reuses durable evidence and never inserts a message or replaces a live token. */
export async function retryStaffConsultationNotification(projectId:string,messageId:string):Promise<SendConsultationResult>{
 if(!UUID_RE.test(projectId)||!UUID_RE.test(messageId))return "invalid";
 const ownerId=await resolveNatoriOwnerId();if(!ownerId)return "not-found";
 const project=await getProject(projectId,ownerId);if(!project||project.deleted_at||project.status==="closed")return "not-found";
 const message=await supabaseAdmin().from("natori_consultation_messages").select("id,notification_id").eq("project_id",projectId).eq("id",messageId).eq("sender","staff").maybeSingle();
 if(message.error||!message.data)return "not-found";
 const {queueLegacyConsultationNotice}=await import("./consultationOperationService");
 const id=message.data.notification_id??await queueLegacyConsultationNotice(projectId,messageId);
 if(!id)return "notification-failed";
 const {retryAcceptanceNotification}=await import("./notificationManagement");
 return await retryAcceptanceNotification(id)?"ok":"notification-failed";
}

/** An expired link can only send a replacement link to the project's saved email. */
export async function renewClientConsultationLink(token: string): Promise<"ok" | "not-found" | "throttled" | "mail-error"> {
  if (!TOKEN_RE.test(token)) return "not-found";
  const admin = supabaseAdmin();
  const { data: oldLink, error: lookupError } = await admin.from("natori_consultation_access")
    .select("id, project_id, created_at, renewed_at")
    .eq("token_hash", hash(token))
    .maybeSingle();
  if (lookupError || !oldLink) return "not-found";
  if (new Date(oldLink.created_at).getTime() < Date.now() - 90 * 86400000) return "not-found";
  const project = await getProject(oldLink.project_id);
  const clientEmail = project?.client_email ?? extractClientEmailFromNote(project?.note);
  if (!project || project.deleted_at || project.status === "closed" || !clientEmail) return "not-found";
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  if (oldLink.renewed_at && oldLink.renewed_at > cutoff) return "throttled";
  // The conditional update ensures concurrent requests for the same link do
  // not send multiple emails. No conversation content is returned here.
  let claim = admin.from("natori_consultation_access")
    .update({ renewed_at: new Date().toISOString() }).eq("id", oldLink.id);
  claim = oldLink.renewed_at ? claim.eq("renewed_at", oldLink.renewed_at) : claim.is("renewed_at", null);
  const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
  if (claimError || !claimed) return "throttled";
  const newToken = randomBytes(32).toString("base64url");
  const { error: insertError } = await admin.from("natori_consultation_access").insert({
    project_id: project.id,
    token_hash: hash(newToken),
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  if (insertError) {
    console.error("[natori-consultation] renewal insert failed", insertError);
    return "mail-error";
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return "mail-error";
  try {
    const { error: mailError } = await new Resend(key).emails.send({
      from: FROM, to: [clientEmail], replyTo: REPLY_TO,
      subject: "【ナトリ】相談ページの新しいリンク",
      text: `${project.client_name} 様\n\n相談ページの新しいリンクをお送りします。\n${getSiteUrl()}/natori/consult/${newToken}\n\nこのリンクの有効期間は30日です。`,
    });
    if (mailError) throw mailError;
  } catch (mailError) {
    console.error("[natori-consultation] renewal email failed", mailError);
    return "mail-error";
  }
  return "ok";
}
