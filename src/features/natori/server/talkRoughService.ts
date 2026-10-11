import "server-only";

import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";
import { getClientProject } from "./consultationService";
import { ROUGH_COLUMNS, roughs } from "./talkRoughStore";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MarkRoughResult = "ok" | "already" | "not-found" | "invalid" | "closed" | "unavailable";

async function ownedOpenProject(projectId: string) {
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return null;
  const { data, error } = await supabaseAdmin().from("natori_projects").select("id, status, deleted_at")
    .eq("id", projectId).eq("user_id", ownerId).maybeSingle();
  return error ? null : data;
}

/** Staff marks one of their own messages with attachments as a rough. */
export async function markStaffRough(projectId: string, messageId: string): Promise<MarkRoughResult> {
  if (!UUID_RE.test(projectId) || !UUID_RE.test(messageId)) return "invalid";
  try {
    const project = await ownedOpenProject(projectId);
    if (!project || project.deleted_at) return "not-found";
    if (project.status === "closed") return "closed";
    const db = supabaseAdmin();
    const message = await db.from("natori_consultation_messages").select("id, sender")
      .eq("project_id", projectId).eq("id", messageId).maybeSingle();
    if (message.error || !message.data || message.data.sender !== "staff") return "not-found";
    const files = await db.from("natori_consultation_files").select("id", { count: "exact", head: true }).eq("message_id", messageId);
    if (files.error) return "unavailable";
    if (!files.count) return "invalid";
    const existing = await roughs().select(ROUGH_COLUMNS).eq("project_id", projectId).eq("message_id", messageId).maybeSingle();
    if (existing.error) return "unavailable";
    if (existing.data) return "already";
    const quotes = await db.from("natori_quotes").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    if (quotes.error) return "unavailable";
    const inserted = await roughs().insert({ project_id: projectId, message_id: messageId, before_quote: !quotes.count }).select(ROUGH_COLUMNS).maybeSingle();
    return inserted.error ? "unavailable" : "ok";
  } catch (error) {
    console.error("[natori-talk] rough mark failed", error instanceof Error ? error.message : "unknown");
    return "unavailable";
  }
}

/** Takes the mark off again; a rough the client already answered is a record and stays. */
export async function unmarkStaffRough(projectId: string, messageId: string): Promise<MarkRoughResult> {
  if (!UUID_RE.test(projectId) || !UUID_RE.test(messageId)) return "invalid";
  try {
    const project = await ownedOpenProject(projectId);
    if (!project || project.deleted_at) return "not-found";
    if (project.status === "closed") return "closed";
    const removed = await roughs().delete().eq("project_id", projectId).eq("message_id", messageId).is("client_ok_at", null).select("id");
    if (removed.error) return "unavailable";
    if (removed.data?.length) return "ok";
    const left = await roughs().select(ROUGH_COLUMNS).eq("project_id", projectId).eq("message_id", messageId).maybeSingle();
    if (left.error) return "unavailable";
    return left.data ? "already" : "not-found";
  } catch (error) {
    console.error("[natori-talk] rough unmark failed", error instanceof Error ? error.message : "unknown");
    return "unavailable";
  }
}

export type RoughOkResult = "ok" | "already" | "not-found" | "closed" | "unavailable";

/** Best effort: tells the staff inbox that a client answered a rough. The record stands even when this fails. */
async function notifyStaffOfOk(projectTitle: string, clientName: string, beforeQuote: boolean) {
  const to = process.env.NATORI_PORTFOLIO_CONTACT_TO?.trim();
  const from = process.env.NATORI_ORDER_MAIL_FROM?.trim();
  const key = process.env.RESEND_API_KEY;
  if (!to || !from || !key) return;
  try {
    const { error } = await new Resend(key).emails.send({
      from, to: [to], subject: `【ナトリ】${beforeQuote ? "参考ラフ" : "ラフ"}に「OK」がありました`,
      text: `${clientName} 様の案件「${projectTitle}」で、${beforeQuote ? "見積もり前の参考ラフ" : "ラフ"}に「このラフでOK」の連絡がありました。\n\n相談のやり取りで内容を確認できます。\nhttps://www.me-ish.art/natori/inquiries\n\n※これは制作を進めるための連絡で、見積もりの承認やお支払いではありません。`,
    });
    if (error) throw error;
  } catch (error) {
    console.error("[natori-talk] rough ok notice failed", error instanceof Error ? error.message : "unknown");
  }
}

/** The client of a consultation link answers one rough of their own project; the first OK is the record. */
export async function recordClientRoughOk(consultToken: string, roughId: string): Promise<RoughOkResult> {
  if (!UUID_RE.test(roughId)) return "not-found";
  try {
    const project = await getClientProject(consultToken);
    if (!project || project.deleted_at) return "not-found";
    if (project.status === "closed") return "closed";
    const updated = await roughs().update({ client_ok_at: new Date().toISOString() })
      .eq("id", roughId).eq("project_id", project.id).is("client_ok_at", null).select(ROUGH_COLUMNS).maybeSingle();
    if (updated.error) return "unavailable";
    if (updated.data) {
      await notifyStaffOfOk(project.title, project.client_name, updated.data.before_quote);
      return "ok";
    }
    const current = await roughs().select(ROUGH_COLUMNS).eq("project_id", project.id).eq("id", roughId).maybeSingle();
    if (current.error) return "unavailable";
    return current.data ? "already" : "not-found";
  } catch (error) {
    console.error("[natori-talk] rough ok failed", error instanceof Error ? error.message : "unknown");
    return "unavailable";
  }
}
