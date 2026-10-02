import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canonicalIntakeJson, isMassProductionIntake, type CanonicalIntake } from "../lib/intakeOperation";
import { prepareIntakeReferenceImage, uploadIntakeReferenceImage } from "./intakeReferenceStorage";
import { resolvePublicIntakeOwnerId } from "./publicIntakeOwner";
import { scheduleAcceptanceNotifications } from "./scheduleAcceptanceNotifications";
import type { Json } from "@/types/supabase";

const receiptSchema = z.strictObject({ ok: z.literal(true), success: z.literal(true), accepted: z.literal(true), receipt: z.uuid(), notificationDelivery: z.literal("pending") });
export type IntakeReceipt = z.infer<typeof receiptSchema>;
const rowSchema = z.object({
  result: z.enum(["not_found", "conflict", "processing", "completed", "failed", "needs_review", "claimed", "busy", "rejected"]),
  replay_result: receiptSchema.nullable(), project_id: z.uuid().nullable(),
  reference_paths: z.array(z.string()).max(5).nullable(), notification_ids: z.array(z.uuid()).max(2),
});
export type IntakeOperationResult =
  | { kind: "completed"; receipt: IntakeReceipt }
  | { kind: "not_found" | "failed" | "rejected" | "conflict" | "processing" | "needs_review" | "unavailable" };

export const hashCanonicalIntake = (input: CanonicalIntake) => createHash("sha256").update(canonicalIntakeJson(input), "utf8").digest("hex");

/** Stable original-byte identity, represented as a v4-shaped private object ID for existing path validation. */
export function intakeReferenceFileId(operationId: string, index: number, digest: string): string {
  const bytes = createHash("sha256").update(`${operationId}/${index}/${digest}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readRow(data: unknown) {
  const parsed = z.array(rowSchema).length(1).safeParse(data);
  return parsed.success ? parsed.data[0] : null;
}
function publicResult(row: z.infer<typeof rowSchema> | null, operationId: string): IntakeOperationResult {
  if (!row) return { kind: "unavailable" };
  if (row.result === "completed") {
    return row.replay_result?.receipt === operationId && row.notification_ids.length === 2
      ? { kind: "completed", receipt: row.replay_result } : { kind: "unavailable" };
  }
  if (row.result === "claimed" || row.result === "busy") return { kind: "processing" };
  return { kind: row.result };
}

export async function lookupPublicIntakeOperation(operationId: string, requestHash: string): Promise<IntakeOperationResult> {
  const owner = resolvePublicIntakeOwnerId();
  if (owner.kind !== "ok") return { kind: "unavailable" };
  try {
    const result = await supabaseAdmin().rpc("natori_intake_lookup_v1", { p_owner_id: owner.ownerId, p_operation_id: operationId, p_request_hash: requestHash });
    if (result.error) return { kind: "unavailable" };
    return publicResult(readRow(result.data), operationId);
  } catch { console.error("[natori-intake] lookup_unconfirmed"); return { kind: "unavailable" }; }
}

export async function settlePublicIntakeOperation(operationId: string, requestHash: string): Promise<IntakeOperationResult> {
  const owner = resolvePublicIntakeOwnerId();
  if (owner.kind !== "ok") return { kind: "unavailable" };
  try {
    const result = await supabaseAdmin().rpc("natori_intake_settle_v1", { p_owner_id: owner.ownerId, p_operation_id: operationId, p_request_hash: requestHash });
    const settled = result.error ? { kind: "unavailable" as const } : publicResult(readRow(result.data), operationId);
    if (settled.kind === "failed") await cleanDefinitivelyFailedOperation(owner.ownerId, operationId, requestHash);
    return settled;
  } catch { return { kind: "unavailable" }; }
}

async function cleanDefinitivelyFailedOperation(ownerId: string, operationId: string, requestHash: string): Promise<void> {
  try {
    const result = await supabaseAdmin().rpc("natori_intake_cleanup_scope_v1", { p_owner_id: ownerId, p_operation_id: operationId, p_request_hash: requestHash });
    const parsed = z.array(z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/u)).max(5).safeParse(result.data);
    if (result.error || !parsed.success || parsed.data.length === 0) return;
    const removed = await supabaseAdmin().storage.from("natori-inquiry-refs").remove(parsed.data);
    if (removed.error) console.error("[natori-intake] scoped_cleanup_unconfirmed");
  } catch { console.error("[natori-intake] scoped_cleanup_unconfirmed"); }
}

/** The route supplies canonical server-reparsed fields and real-byte hashes, never a caller owner/path. */
export async function submitPublicIntakeOperation(operationId: string, input: CanonicalIntake, files: File[]): Promise<IntakeOperationResult> {
  const owner = resolvePublicIntakeOwnerId();
  if (owner.kind !== "ok") return { kind: "unavailable" };
  const requestHash = hashCanonicalIntake(input);
  const old = await lookupPublicIntakeOperation(operationId, requestHash);
  if (old.kind !== "not_found" && old.kind !== "processing") return old;
  const prepared: Buffer[] = [];
  // All conversion validation occurs before begin/upload, keeping invalid bytes out of the operation ledger.
  for (const file of files) {
    const converted = await prepareIntakeReferenceImage(file);
    if (converted.kind !== "ok") return { kind: "rejected" };
    prepared.push(converted.webp);
  }
  const claimToken = randomUUID();
  const fence = { p_owner_id: owner.ownerId, p_operation_id: operationId, p_request_hash: requestHash, p_claim_token: claimToken };
  try {
    const admin = supabaseAdmin();
    const begun = await admin.rpc("natori_intake_begin_v1", { ...fence, p_manifest: input.manifest,
      p_file_ids: input.manifest.map((file, index) => intakeReferenceFileId(operationId, index, file.digest)), p_mass_production: isMassProductionIntake(input) });
    const row = begun.error ? null : readRow(begun.data);
    if (!row) return await lookupPublicIntakeOperation(operationId, requestHash);
    if (row.result !== "claimed") return publicResult(row, operationId);
    const projectId = row.project_id, paths = row.reference_paths;
    if (!projectId || !paths || paths.length !== prepared.length || paths.some((path, index) => path !== `${projectId}/${intakeReferenceFileId(operationId, index, input.manifest[index].digest)}.webp`)) return { kind: "unavailable" };
    for (const [index, webp] of prepared.entries()) {
      const touch = await admin.rpc("natori_intake_touch_v1", fence);
      if (touch.error || touch.data !== true) return await lookupPublicIntakeOperation(operationId, requestHash);
      const uploaded = await uploadIntakeReferenceImage(paths[index], webp);
      if (uploaded.kind !== "ok") {
        if (uploaded.kind === "mismatch") {
          await admin.rpc("natori_intake_review_v1", fence);
          return await lookupPublicIntakeOperation(operationId, requestHash);
        }
        // Unknown Storage acceptance or a prior immutable object mismatch is retained for exact recovery/review.
        return { kind: "unavailable" };
      }
    }
    const touch = await admin.rpc("natori_intake_touch_v1", fence);
    if (touch.error || touch.data !== true) return await lookupPublicIntakeOperation(operationId, requestHash);
    const completed = await admin.rpc("natori_intake_finish_v1", { ...fence,
      p_client_name: input.submission.clientName, p_client_email: input.submission.clientEmail,
      p_request_data: input.submission.requestData as unknown as Json, p_reference_links: input.referenceLinks,
      p_mass_production: isMassProductionIntake(input) });
    if (completed.error) {
      // Even a 4xx on retry cannot prove a previous request did not commit. Resolve the ledger before cleanup.
      return await lookupPublicIntakeOperation(operationId, requestHash);
    }
    const result = publicResult(readRow(completed.data), operationId);
    if (result.kind === "completed") {
      const stored = readRow(completed.data);
      if (stored) scheduleAcceptanceNotifications(stored.notification_ids);
    } else if (result.kind === "failed") await cleanDefinitivelyFailedOperation(owner.ownerId, operationId, requestHash);
    return result;
  } catch {
    console.error("[natori-intake] submission_unconfirmed");
    return await lookupPublicIntakeOperation(operationId, requestHash);
  }
}
