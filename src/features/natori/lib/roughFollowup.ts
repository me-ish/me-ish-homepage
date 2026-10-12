import { z } from "zod";

const stamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
/** Validate the owner-only read before it can show an all-clear or an acknowledgement button. */
export const staffRoughOkSchema = z.object({ id: z.uuid(), messageId: z.uuid(), beforeQuote: z.boolean(), okAt: stamp,
  acknowledgedAt: stamp.nullable(), notificationId: z.uuid().nullable(),
  notificationStatus: z.enum(["pending", "sending", "sent", "failed", "unknown"]).nullable(),
  notificationAttemptNo: z.number().int().min(1).max(5).nullable(), notificationSentAt: stamp.nullable(),
  retryAvailable: z.boolean(), reviewRequired: z.boolean(),
}).refine(row => row.notificationId === null
  ? row.notificationStatus === null && row.notificationAttemptNo === null && row.notificationSentAt === null && !row.retryAvailable && !row.reviewRequired
  : row.notificationStatus !== null && row.notificationAttemptNo !== null)
  .refine(row => (row.notificationStatus === "sent" ? row.notificationSentAt !== null && !row.retryAvailable : row.notificationSentAt === null)
    && (!row.reviewRequired || !row.retryAvailable) && (!row.acknowledgedAt || Date.parse(row.acknowledgedAt) >= Date.parse(row.okAt)));

export const staffRoughOkListSchema = z.array(staffRoughOkSchema).refine(rows => new Set(rows.map(row => row.id)).size === rows.length);

export function roughOkSignature(rows: { id: string; acknowledgedAt: string | null }[]): string {
  return rows.map(row => `${row.id}/${row.acknowledgedAt ?? "pending"}`).sort().join(",");
}
