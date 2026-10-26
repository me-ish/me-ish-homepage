import "server-only";
import {acceptanceProjectAllowed} from "./caseAcceptance";

import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";
import { getClientProject } from "./consultationService";
import { ROUGH_COLUMNS, roughs } from "./talkRoughStore";
import { scheduleAcceptanceNotifications } from "./scheduleAcceptanceNotifications";
import { roughRpcSucceeded } from "./roughRpcResponse";

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
    if (!project || project.deleted_at || !await acceptanceProjectAllowed(project.id,true)) return "not-found";
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
    if (!project || project.deleted_at || !await acceptanceProjectAllowed(project.id,true)) return "not-found";
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
const TOKEN_RE = /^[A-Za-z0-9_-]{30,64}$/;
const timestamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
const okResponse = z.array(z.object({ result: z.enum(["ok", "already_ok", "not_found", "closed"]),
  rough_id: z.uuid().nullable(), project_id: z.uuid().nullable(), client_ok_at: timestamp.nullable(), notification_ids: z.array(z.uuid()).max(1) })).length(1);

/** The client of a consultation link answers one rough of their own project; the first OK is the record. */
export async function recordClientRoughOk(consultToken: string, roughId: string): Promise<RoughOkResult> {
  if (!UUID_RE.test(roughId) || !TOKEN_RE.test(consultToken)) return "not-found";
  try {
    const project = await getClientProject(consultToken);
    if (!project || project.deleted_at || !await acceptanceProjectAllowed(project.id,true)) return "not-found";
    // This transaction repeats the capability/project/rough checks and commits the OK with its job.
    const response: unknown = await supabaseAdmin().rpc("natori_record_rough_ok_v1", {
      p_project_id: project.id, p_rough_id: roughId, p_token_hash: createHash("sha256").update(consultToken).digest("hex"),
    });
    if (!roughRpcSucceeded(response)) return "unavailable";
    const parsed = okResponse.safeParse(response.data);
    if (!parsed.success) return "unavailable";
    const row = parsed.data[0];
    if (row.result === "not_found" || row.result === "closed") {
      if (row.notification_ids.length || (row.result === "not_found" && row.client_ok_at)
        || (row.result === "closed" && (row.rough_id !== roughId || row.project_id !== project.id))) return "unavailable";
      return row.result === "closed" ? "closed" : "not-found";
    }
    if (row.rough_id !== roughId || row.project_id !== project.id || !row.client_ok_at || (row.result === "ok" && row.notification_ids.length !== 1)) return "unavailable";
    // A repeated OK recovers the same unresolved job; no provider operation runs in this response.
    try { scheduleAcceptanceNotifications(row.notification_ids); }
    catch { console.error("[natori-talk] rough ok scheduling interrupted"); }
    return row.result === "ok" ? "ok" : "already";
  } catch {
    console.error("[natori-talk] rough ok unavailable");
    return "unavailable";
  }
}
