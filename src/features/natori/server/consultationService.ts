import "server-only";

import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { getSiteUrl } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import { sendNatoriNoticeMail } from "@/features/natori/server/orderMailService";
import { extractClientEmailFromNote } from "@/features/natori/lib/orderMail";
import { parseInquiryNote } from "@/features/natori/lib/inquiryNoteView";
import type { Json } from "@/types/supabase";

const TOKEN_RE = /^[A-Za-z0-9_-]{30,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FROM = process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>";
const REPLY_TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";

type ProjectRow = { id: string; user_id: string; title: string; client_name: string; client_email: string | null; note: string | null; request_data: Json | null; status: string; deleted_at: string | null };
type MessageRow = { id: string; project_id: string; sender: string; body: string; notification_status: string; created_at: string };
export type ConsultationMessage = { id: string; sender: "staff" | "client"; body: string; notificationStatus: string; createdAt: string };

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function asMessage(row: MessageRow): ConsultationMessage {
  return { id: row.id, sender: row.sender as "staff" | "client", body: row.body, notificationStatus: row.notification_status, createdAt: row.created_at };
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

async function getClientProject(token: string): Promise<ProjectRow | null> {
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
  const { data, error } = await supabaseAdmin().from("natori_consultation_messages")
    .select("id, project_id, sender, body, notification_status, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.error("[natori-consultation] message list failed", error);
    return null;
  }
  return ((data ?? []) as MessageRow[]).map(asMessage);
}

export async function getStaffConsultation(projectId: string) {
  if (!UUID_RE.test(projectId)) return null;
  const ownerId = await resolveNatoriActingUserId();
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
  const request = project.request_data;
  const initialInquiry = request && typeof request === "object" && !Array.isArray(request) && typeof request.message === "string"
    ? request.message
    : parseInquiryNote(project.note).message || parseInquiryNote(project.note).details;
  return messages === null ? null : { title: project.title, clientName: project.client_name, initialInquiry, messages, closed: project.status === "closed" || Boolean(project.deleted_at) };
}

export type SendConsultationResult = "ok" | "notification-failed" | "not-found" | "invalid" | "db-error";

export async function sendStaffConsultation(projectId: string, body: string): Promise<SendConsultationResult> {
  if (!UUID_RE.test(projectId) || !body.trim() || body.length > 4000) return "invalid";
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return "not-found";
  const project = await getProject(projectId, ownerId);
  if (!project || project.deleted_at || project.status === "closed") return "not-found";
  const clientEmail = project.client_email ?? extractClientEmailFromNote(project.note);
  if (!clientEmail) return "not-found";

  // Insert the message and access link before email. On a mail failure the
  // message remains visible as failed; retry never creates a duplicate message.
  const token = randomBytes(32).toString("base64url");
  const { data: access, error: accessError } = await supabaseAdmin().from("natori_consultation_access")
    .insert({ project_id: project.id, token_hash: hash(token), expires_at: new Date(Date.now() + 30 * 86400000).toISOString() })
    .select("id")
    .single();
  if (accessError || !access) {
    console.error("[natori-consultation] access insert failed", accessError);
    return "db-error";
  }
  const { data: message, error } = await supabaseAdmin().from("natori_consultation_messages")
    .insert({ project_id: project.id, sender: "staff", body: body.trim() })
    .select("id")
    .single();
  if (error || !message) {
    console.error("[natori-consultation] staff message insert failed", error);
    return "db-error";
  }

  const apiKey = process.env.RESEND_API_KEY;
  let sent = false;
  if (apiKey) {
    try {
      const { error: mailError } = await new Resend(apiKey).emails.send({
        from: FROM, to: [clientEmail], replyTo: REPLY_TO,
        subject: `【ナトリ】ご相談への返信：${project.title}`.replace(/[\r\n]/g, " ").slice(0, 200),
        text: `${project.client_name} 様\n\nナトリからご相談への返信が届きました。\n以下のページで内容をご確認・ご返信いただけます。\n\n${getSiteUrl()}/natori/consult/${token}\n\nこのリンクの有効期間は30日です。ご返信は相談ページからお願いします。`,
      });
      if (mailError) console.error("[natori-consultation] client notification failed", mailError);
      sent = !mailError;
    } catch (mailError) {
      console.error("[natori-consultation] client notification failed", mailError);
    }
  }
  const { error: updateError } = await supabaseAdmin().from("natori_consultation_messages")
    .update({ notification_status: sent ? "sent" : "failed" }).eq("id", message.id);
  if (updateError) console.error("[natori-consultation] notification status update failed", updateError);
  return sent ? "ok" : "notification-failed";
}

export async function sendClientConsultation(token: string, body: string): Promise<SendConsultationResult> {
  if (!TOKEN_RE.test(token) || !body.trim() || body.length > 4000) return "invalid";
  const project = await getClientProject(token);
  if (!project || project.deleted_at || project.status === "closed") return "not-found";
  const { data: message, error } = await supabaseAdmin().from("natori_consultation_messages")
    .insert({ project_id: project.id, sender: "client", body: body.trim() })
    .select("id")
    .single();
  if (error || !message) {
    console.error("[natori-consultation] client message insert failed", error);
    return "db-error";
  }
  let sent = false;
  try {
    sent = await sendNatoriNoticeMail(
      `【相談返信】${project.client_name} 様 / ${project.title}`.replace(/[\r\n]/g, " ").slice(0, 200),
      `${project.client_name} 様から相談への返信が届きました。\n\n管理画面でご確認ください。\n${getSiteUrl()}/natori/inquiries?project=${project.id}`
    );
  } catch (mailError) {
    console.error("[natori-consultation] staff notification failed", mailError);
  }
  const { error: updateError } = await supabaseAdmin().from("natori_consultation_messages")
    .update({ notification_status: sent ? "sent" : "failed" }).eq("id", message.id);
  if (updateError) console.error("[natori-consultation] notification status update failed", updateError);
  return sent ? "ok" : "notification-failed";
}

/** Re-send a failed staff notification without inserting another conversation message. */
export async function retryStaffConsultationNotification(projectId: string, messageId: string): Promise<SendConsultationResult> {
  if (!UUID_RE.test(projectId) || !UUID_RE.test(messageId)) return "invalid";
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return "not-found";
  const project = await getProject(projectId, ownerId);
  if (!project || project.deleted_at || project.status === "closed") return "not-found";
  const clientEmail = project.client_email ?? extractClientEmailFromNote(project.note);
  if (!clientEmail) return "not-found";
  const admin = supabaseAdmin();
  const { data: message, error: lookupError } = await admin.from("natori_consultation_messages")
    .select("id")
    .eq("id", messageId).eq("project_id", projectId).eq("sender", "staff").eq("notification_status", "failed")
    .maybeSingle();
  if (lookupError || !message) return "not-found";
  const token = randomBytes(32).toString("base64url");
  const { error: accessError } = await admin.from("natori_consultation_access")
    .insert({ project_id: projectId, token_hash: hash(token), expires_at: new Date(Date.now() + 30 * 86400000).toISOString() });
  if (accessError) {
    console.error("[natori-consultation] retry access insert failed", accessError);
    return "db-error";
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "notification-failed";
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM, to: [clientEmail], replyTo: REPLY_TO,
      subject: `【ナトリ】ご相談への返信：${project.title}`.replace(/[\r\n]/g, " ").slice(0, 200),
      text: `${project.client_name} 様\n\nナトリからご相談への返信が届きました。\n以下のページで内容をご確認・ご返信いただけます。\n\n${getSiteUrl()}/natori/consult/${token}\n\nこのリンクの有効期間は30日です。ご返信は相談ページからお願いします。`,
    });
    if (error) throw error;
  } catch (mailError) {
    console.error("[natori-consultation] retry notification failed", mailError);
    return "notification-failed";
  }
  const { error: updateError } = await admin.from("natori_consultation_messages")
    .update({ notification_status: "sent" }).eq("id", messageId);
  if (updateError) {
    console.error("[natori-consultation] retry status update failed", updateError);
    return "db-error";
  }
  return "ok";
}
