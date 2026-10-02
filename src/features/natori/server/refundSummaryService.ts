import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NatoriRefundSummary } from "../types/refunds";
import { refundLedgerReadEnabled } from "./paymentEventService";

export async function loadNatoriRefundSummaries(ownerId: string, projectIds: string[]): Promise<Map<string, NatoriRefundSummary> | null | undefined> {
  if (!refundLedgerReadEnabled()) return undefined;
  const summaries = new Map<string, NatoriRefundSummary>();
  try {
    for (let offset = 0; offset < projectIds.length; offset += 100) {
      const ids = projectIds.slice(offset, offset + 100);
      const { data, error } = await supabaseAdmin().rpc("natori_refund_summaries_v1", { p_owner_id: ownerId, p_project_ids: ids });
      if (error || !data || data.length !== ids.length) throw new Error("refund_summary_unavailable");
      for (const row of data) {
        const value = row.summary;
        if (!value || typeof value !== "object" || Array.isArray(value) || value.available !== true
          || !ids.includes(row.project_id) || summaries.has(row.project_id)
          || typeof value.originalMapped !== "boolean"
          || (value.confirmedAmount !== null && (typeof value.confirmedAmount !== "number" || !Number.isSafeInteger(value.confirmedAmount) || value.confirmedAmount < 0))
          || typeof value.pendingCount !== "number" || !Number.isSafeInteger(value.pendingCount) || value.pendingCount < 0
          || typeof value.reviewCount !== "number" || !Number.isSafeInteger(value.reviewCount) || value.reviewCount < 0) throw new Error("refund_summary_invalid");
        summaries.set(row.project_id, { available: true, originalMapped: value.originalMapped, confirmedAmount: value.confirmedAmount,
          pendingCount: value.pendingCount, reviewCount: value.reviewCount });
      }
    }
    return summaries;
  } catch {
    console.error("[natori-refund-summary] refund ledger unavailable");
    return null;
  }
}
