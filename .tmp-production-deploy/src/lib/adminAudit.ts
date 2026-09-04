// src/lib/adminAudit.ts
// Fire-and-forget admin audit logger
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminAction =
  | "mark_paid"
  | "mark_batch_paid"
  | "export_csv"
  | "approve_entry"
  | "reject_entry"
  | "sync_display_ready";

interface LogParams {
  adminEmail: string;
  action: AdminAction;
  resourceType: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
}

/**
 * Log an admin action to the audit table.
 * Fire-and-forget: never throws, never blocks the main flow.
 */
export function logAdminAction(params: LogParams): void {
  try {
    const admin = supabaseAdmin();
    (admin as any)
      .from("admin_audit_log")
      .insert({
        admin_email: params.adminEmail,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId ?? null,
        detail: params.detail ?? {},
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          console.error("[adminAudit] insert failed:", error.message);
        }
      });
  } catch (e) {
    console.error("[adminAudit] unexpected error:", e);
  }
}
