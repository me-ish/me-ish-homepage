import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ConsultationOverview } from "@/features/natori/types/consultation";
import { z } from "zod";
import { roughRpcSucceeded } from "./roughRpcResponse";

const stamp = z.string().refine(value => Number.isFinite(Date.parse(value))).nullable();
const count = z.number().int().nonnegative().safe();
const overviewRow = z.object({ project_id: z.string().min(1), latest_message_id: z.string().min(1).nullable(),
  latest_sender: z.enum(["staff", "client"]).nullable(), latest_message_at: stamp,
  notification_failed: count, notification_pending: count, rough_ok_pending: count,
  latest_rough_ok_id: z.uuid().nullable(), latest_rough_ok_at: stamp,
}).refine(row => (row.rough_ok_pending === 0) === (row.latest_rough_ok_id === null && row.latest_rough_ok_at === null)
  && (row.rough_ok_pending === 0 || (row.latest_rough_ok_id !== null && row.latest_rough_ok_at !== null))
  && ((row.latest_message_id === null && row.latest_sender === null && row.latest_message_at === null)
    || (row.latest_message_id !== null && row.latest_sender !== null && row.latest_message_at !== null)));

/** Caller supplies only owner-filtered project IDs; RPC repeats the owner check. */
export async function loadConsultationOverviews(ownerId: string, projectIds: string[]): Promise<Map<string, ConsultationOverview> | null> {
  const result = new Map<string, ConsultationOverview>();
  try {
    for (let offset = 0; offset < projectIds.length; offset += 100) {
      const ids = projectIds.slice(offset, offset + 100);
      const response: unknown = await supabaseAdmin().rpc("natori_consultation_overview_v2", { p_owner_id: ownerId, p_project_ids: ids });
      if (!roughRpcSucceeded(response)) throw new Error("overview_unavailable");
      const parsed = z.array(overviewRow).safeParse(response.data);
      if (!parsed.success || parsed.data.length !== ids.length) throw new Error("overview_unavailable");
      for (const row of parsed.data) {
        if (result.has(row.project_id) || !ids.includes(row.project_id)) throw new Error("overview_invalid");
        result.set(row.project_id, { latestMessageId: row.latest_message_id, latestSender: row.latest_sender,
          latestMessageAt: row.latest_message_at, notificationFailed: row.notification_failed, notificationPending: row.notification_pending,
          roughOkPending: row.rough_ok_pending, latestRoughOkId: row.latest_rough_ok_id, latestRoughOkAt: row.latest_rough_ok_at });
      }
    }
    return result;
  } catch {
    // An unavailable projection must not look like an empty conversation.
    console.error("[natori-consultation-overview] overview unavailable");
    return null;
  }
}
