import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ConsultationOverview } from "@/features/natori/types/consultation";

/** Caller supplies only owner-filtered project IDs; RPC repeats the owner check. */
export async function loadConsultationOverviews(ownerId: string, projectIds: string[]): Promise<Map<string, ConsultationOverview> | null> {
  const result = new Map<string, ConsultationOverview>();
  try {
    for (let offset = 0; offset < projectIds.length; offset += 100) {
      const ids = projectIds.slice(offset, offset + 100);
      const { data, error } = await supabaseAdmin().rpc("natori_consultation_overview_v1", { p_owner_id: ownerId, p_project_ids: ids });
      if (error || !data || data.length !== ids.length) throw new Error("overview_unavailable");
      for (const row of data) {
        if (result.has(row.project_id) || !ids.includes(row.project_id) || (row.latest_sender !== null && row.latest_sender !== "staff" && row.latest_sender !== "client")) throw new Error("overview_invalid");
        result.set(row.project_id, { latestMessageId: row.latest_message_id, latestSender: row.latest_sender,
          latestMessageAt: row.latest_message_at, notificationFailed: row.notification_failed, notificationPending: row.notification_pending });
      }
    }
    return result;
  } catch {
    // An unavailable projection must not look like an empty conversation.
    console.error("[natori-consultation-overview] overview unavailable");
    return null;
  }
}
