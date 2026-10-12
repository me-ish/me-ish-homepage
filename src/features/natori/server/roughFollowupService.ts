import "server-only";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { dispatchAcceptanceNotification, notificationSendingEnabled } from "./acceptanceNotifications";
import { staffRoughOkListSchema } from "../lib/roughFollowup";
import type { StaffRoughOk } from "../types/consultation";
import { roughRpcSucceeded } from "./roughRpcResponse";

const uuid = z.uuid();
const stamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
const count = z.number().int().nonnegative().safe();
const listRow = z.object({ rough_id: uuid, message_id: uuid, before_quote: z.boolean(), client_ok_at: stamp,
  acknowledged_at: stamp.nullable(), notification_id: uuid.nullable(),
  notification_status: z.enum(["pending", "sending", "sent", "failed", "unknown"]).nullable(),
  notification_attempt_no: count.min(1).max(5).nullable(), notification_sent_at: stamp.nullable(),
  notification_claim_count: count.max(8).nullable(), notification_lease_expires_at: stamp.nullable(),
  notification_send_started_at: stamp.nullable(), notification_retry_after: stamp.nullable(),
}).refine(row => row.notification_id === null
  ? row.notification_status === null && row.notification_attempt_no === null && row.notification_claim_count === null
    && row.notification_sent_at === null && row.notification_lease_expires_at === null && row.notification_send_started_at === null && row.notification_retry_after === null
  : row.notification_status !== null && row.notification_attempt_no !== null && row.notification_claim_count !== null)
  .refine(row => row.notification_status === "sent" ? row.notification_sent_at !== null : row.notification_sent_at === null);

/** The owning project's read is mandatory for business state; unavailable is never an empty list. */
export async function loadStaffRoughOks(ownerId: string, projectId: string): Promise<StaffRoughOk[] | null> {
  try {
    const response: unknown = await supabaseAdmin().rpc("natori_rough_ok_list_v1", { p_owner_id: ownerId, p_project_id: projectId });
    if (!roughRpcSucceeded(response)) return null;
    const parsed = z.array(listRow).safeParse(response.data);
    if (!parsed.success) return null;
    const rows = parsed.data.map(row => {
      const leaseActive = !!row.notification_lease_expires_at && Date.parse(row.notification_lease_expires_at) > Date.now();
      const reviewRequired = (row.notification_claim_count ?? 0) >= 8 || (row.notification_status === "failed" && (row.notification_attempt_no ?? 0) >= 5)
        || (row.notification_status !== "sent" && row.notification_status !== "failed" && !!row.notification_send_started_at && Date.parse(row.notification_send_started_at) <= Date.now() - 23 * 3600000);
      return { id: row.rough_id, messageId: row.message_id, beforeQuote: row.before_quote, okAt: row.client_ok_at,
        acknowledgedAt: row.acknowledged_at, notificationId: row.notification_id,
        notificationStatus: row.notification_status === "sending" && !leaseActive ? "unknown" as const : row.notification_status,
        notificationAttemptNo: row.notification_attempt_no, notificationSentAt: row.notification_sent_at, reviewRequired,
        retryAvailable: !!row.notification_id && !reviewRequired && row.notification_status !== "sent" && !leaseActive
          && (!row.notification_retry_after || Date.parse(row.notification_retry_after) <= Date.now()),
      };
    });
    const safe = staffRoughOkListSchema.safeParse(rows);
    return safe.success ? safe.data : null;
  } catch {
    console.error("[natori-rough-followup] list unavailable");
    return null;
  }
}

export type RoughAcknowledgeResult = "ok" | "already" | "not-found" | "not-ok" | "closed" | "unavailable";
export async function acknowledgeStaffRoughOk(projectId: string, roughId: string): Promise<RoughAcknowledgeResult> {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(roughId).success) return "not-found";
  try {
    const ownerId = await resolveNatoriOwnerId();
    if (!ownerId) return "not-found";
    const response: unknown = await supabaseAdmin().rpc("natori_acknowledge_rough_ok_v1", { p_owner_id: ownerId, p_project_id: projectId, p_rough_id: roughId });
    if (!roughRpcSucceeded(response)) return "unavailable";
    const parsed = z.array(z.object({ result: z.enum(["acknowledged", "already_acknowledged", "not_found", "not_ok", "closed"]), acknowledged_at: stamp.nullable() })).length(1).safeParse(response.data);
    if (!parsed.success) return "unavailable";
    const row = parsed.data[0];
    if (row.result === "acknowledged" || row.result === "already_acknowledged") return row.acknowledged_at ? row.result === "acknowledged" ? "ok" : "already" : "unavailable";
    if (row.acknowledged_at) return "unavailable";
    return row.result === "not_found" ? "not-found" : row.result === "not_ok" ? "not-ok" : "closed";
  } catch {
    console.error("[natori-rough-followup] acknowledgement unavailable");
    return "unavailable";
  }
}

/** Retry only the existing rough job; this never acknowledges or queues a historical OK. */
export async function retryStaffRoughOkNotification(projectId: string, roughId: string): Promise<boolean> {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(roughId).success || !notificationSendingEnabled()) return false;
  try {
    const ownerId = await resolveNatoriOwnerId();
    if (!ownerId) return false;
    const response: unknown = await supabaseAdmin().rpc("natori_retry_rough_ok_notification_v1", { p_owner_id: ownerId, p_project_id: projectId, p_rough_id: roughId });
    if (!roughRpcSucceeded(response)) return false;
    const parsed = uuid.safeParse(response.data);
    if (!parsed.success) return false;
    await dispatchAcceptanceNotification(parsed.data, true);
    return true;
  } catch { return false; }
}
