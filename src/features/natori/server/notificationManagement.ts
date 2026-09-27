import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { acceptanceOutboxEnabled, notificationSendingEnabled, dispatchAcceptanceNotification } from "./acceptanceNotifications";
import type { NatoriNotificationList, NatoriNotificationSummary } from "../types/notifications";

export async function listAcceptanceNotifications(): Promise<NatoriNotificationList> {
  if (!acceptanceOutboxEnabled()) return { enabled: false, sendingEnabled: false, notifications: [], truncated: false };
  const ownerId = await resolveNatoriOwnerId();
  const { data, error } = await supabaseAdmin().from("natori_notification_jobs")
    .select("id,notification_key,project_id,purpose,status,attempt_no,claim_count,lease_expires_at,send_started_at,retry_after,sent_at,created_at,natori_projects!inner(user_id,title)")
    .eq("natori_projects.user_id", ownerId).order("created_at", { ascending: false }).limit(101);
  if (error) throw new Error("notification_read_failed");
  const groups = new Map<string, NatoriNotificationSummary>();
  for (const row of (data ?? []).slice(0, 100)) {
    const previous = groups.get(row.notification_key);
    if (previous) {
      if (row.sent_at && (!previous.lastSentAt || row.sent_at > previous.lastSentAt)) previous.lastSentAt = row.sent_at;
      continue;
    }
    const reviewRequired = row.claim_count >= 8 || (row.status === "failed" && row.attempt_no >= 5)
      || (row.status !== "sent" && row.status !== "failed" && !!row.send_started_at && Date.parse(row.send_started_at) <= Date.now() - 23 * 3600000);
    groups.set(row.notification_key, {
      id: row.id, projectId: row.project_id, projectTitle: row.natori_projects.title ?? "案件",
      purpose: row.purpose, status: row.status, attemptNo: row.attempt_no, lastSentAt: row.sent_at,
      reviewRequired,
      retryAvailable: !reviewRequired && row.status !== "sent"
        && (!row.lease_expires_at || Date.parse(row.lease_expires_at) <= Date.now())
        && (!row.retry_after || Date.parse(row.retry_after) <= Date.now()),
    });
  }
  return { enabled: true, sendingEnabled: notificationSendingEnabled(), notifications: [...groups.values()], truncated: (data?.length ?? 0) > 100 };
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
