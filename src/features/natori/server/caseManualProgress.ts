import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CaseManualProgress } from "../types/caseWorkspace";

// The work-records table predates the generated Supabase types (the codebase
// otherwise reaches it only through the snapshot SQL), so this one read goes
// through a minimal structural view of the query builder and validates rows.
type ManualProgressQuery = PromiseLike<{ data: unknown; error: unknown }>;
type ManualProgressClient = {
  from: (table: "natori_case_work_records") => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => {
        in: (column: string, values: string[]) => {
          order: (column: string, options: { ascending: boolean }) => ManualProgressQuery;
        };
      };
    };
  };
};

const manualRow = z.object({
  project_id: z.uuid(), kind: z.enum(["manual_delivery", "manual_receipt"]),
  created_at: z.string(), data: z.unknown(),
});
type ManualRow = z.infer<typeof manualRow>;

const occurredAt = (row: ManualRow): string => {
  const data = row.data !== null && typeof row.data === "object" ? row.data as Record<string, unknown> : {};
  const occurred = typeof data.occurredAt === "string" ? data.occurredAt : null;
  return occurred !== null && Number.isFinite(Date.parse(occurred)) ? occurred : row.created_at;
};

/**
 * Latest staff work record per project and kind for the off-system delivery /
 * receipt marks. Display enrichment only: any failure returns what was read
 * so far (or nothing) and never fails the workspace read itself.
 */
export async function readCaseManualProgress(projectIds: readonly string[]): Promise<Map<string, CaseManualProgress>> {
  const result = new Map<string, CaseManualProgress>();
  if (projectIds.length === 0) return result;
  try {
    const admin = supabaseAdmin() as unknown as ManualProgressClient;
    const { data, error } = await admin.from("natori_case_work_records")
      .select("project_id,kind,created_at,data")
      .in("project_id", [...projectIds])
      .in("kind", ["manual_delivery", "manual_receipt"])
      .order("created_at", { ascending: true });
    const rows = z.array(manualRow).safeParse(data);
    if (error || !rows.success) return result;
    for (const row of rows.data) {
      const entry = result.get(row.project_id) ?? { delivery: null, receipt: null };
      // Rows arrive oldest first; the latest record of each kind wins.
      if (row.kind === "manual_delivery") entry.delivery = occurredAt(row);
      else entry.receipt = occurredAt(row);
      result.set(row.project_id, entry);
    }
  } catch { return result; }
  return result;
}
