import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { acceptanceOutboxEnabled, notificationSendingEnabled, dispatchAcceptanceNotification } from "./acceptanceNotifications";
import type { NatoriNotificationList, NatoriNotificationSummary } from "../types/notifications";

export async function listAcceptanceNotifications(offset = 0): Promise<NatoriNotificationList> {
  if (!acceptanceOutboxEnabled()) return { enabled: false, sendingEnabled: false, notifications: [], truncated: false, offset: 0 };
  const ownerId = await resolveNatoriOwnerId();
  const { data, error } = await supabaseAdmin().rpc("natori_notification_list_v1", { p_owner_id: ownerId, p_offset: offset });
  if (error) throw new Error("notification_read_failed");
  const notifications: NatoriNotificationSummary[] = [];
  for (const row of (data ?? []).slice(0, 50)) {
    const reviewRequired = row.claim_count >= 8 || (row.status === "failed" && row.attempt_no >= 5)
      || (row.status !== "sent" && row.status !== "failed" && !!row.send_started_at && Date.parse(row.send_started_at) <= Date.now() - 23 * 3600000);
    notifications.push({
      id: row.id, projectId: row.project_id, projectTitle: row.project_title ?? "案件",
      purpose: row.purpose,
      status: row.status === "sending" && (!row.lease_expires_at || Date.parse(row.lease_expires_at) <= Date.now()) ? "unknown" : row.status,
      attemptNo: row.attempt_no, lastSentAt: row.last_sent_at,
      reviewRequired,
      retryAvailable: !reviewRequired && row.status !== "sent"
        && (!row.lease_expires_at || Date.parse(row.lease_expires_at) <= Date.now())
        && (!row.retry_after || Date.parse(row.retry_after) <= Date.now()),
    });
  }
  return { enabled: true, sendingEnabled: notificationSendingEnabled(), notifications, truncated: (data?.length ?? 0) > 50, offset };
}

export async function retryAcceptanceNotification(id: string): Promise<boolean> {
  if (!acceptanceOutboxEnabled() || !notificationSendingEnabled()) return false;
  const ownerId = await resolveNatoriOwnerId();
  const { data, error } = await supabaseAdmin().rpc("natori_notification_retry_v1", { p_id: id, p_owner_id: ownerId });
  if (error) throw new Error("notification_retry_failed");
  if (!data) return false;
  await dispatchAcceptanceNotification(data, true);
  return true;
}
