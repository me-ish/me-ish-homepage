import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import { canonicalizeIntake, intakeHashSchema, intakeManifestSchema, intakeOperationIdSchema, intakeTextFields, isMassProductionIntake, type IntakeManifest, type IntakeTextFields } from "@/features/natori/lib/intakeOperation";
import { hashCanonicalIntake, lookupPublicIntakeOperation, settlePublicIntakeOperation, submitPublicIntakeOperation, type IntakeOperationResult } from "@/features/natori/server/publicIntakeOperationService";
import { loadPublicCommissionAvailability } from "@/features/natori/server/publicCommissionAvailability";
import { isPublicStructuredIntakeEnabled } from "@/features/natori/server/publicIntakeRollout";
import { recordPublicIntakeMetric } from "@/features/natori/server/publicIntakeMetrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const MAX_REQUEST_BYTES = 4_400_000;
const capabilitySchema = z.strictObject({ action: z.enum(["reconcile", "settle"]), operationId: intakeOperationIdSchema, requestHash: intakeHashSchema });

function fail(error: string, status: number, operationState = "unknown") {
  return NextResponse.json({ ok: false, error, operationState }, { status, headers: { "Cache-Control": "no-store" } });
}
function operationResponse(result: IntakeOperationResult) {
  if (result.kind === "completed") return NextResponse.json({ ...result.receipt, operationState: "completed" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  if (result.kind === "not_found" || result.kind === "failed") return fail("submission_uncommitted", 409, result.kind);
  if (result.kind === "conflict") return fail("operation_conflict", 409, "conflict");
  if (result.kind === "needs_review") return fail("operation_needs_review", 409, "needs_review");
  if (result.kind === "processing") return fail("operation_processing", 202, "processing");
  return fail(result.kind === "rejected" ? "submission_rejected" : "temporarily_unavailable", result.kind === "rejected" ? 409 : 503);
}

/** Real streaming limit also covers chunked/missing/lying content-length requests. */
async function boundedBody(req: Request): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_REQUEST_BYTES) { await reader.cancel(); return null; }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function POST(req: Request) {
  const csrfError = checkCsrf(req); if (csrfError) return csrfError;
  const originError = checkSameOrigin(req); if (originError) return originError;
  const length = req.headers.get("content-length");
  if (length !== null && (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > MAX_REQUEST_BYTES)) return fail("invalid_request", 400);
  const ip = getIpFromRequest(req);
  // Replay does not consume normal intake quota, but every capability lookup is abuse-limited.
  const abuse = await checkRateLimit(`natori-intake-check:${ip}`, { limit: 60, windowMs: 600_000 });
  if (!abuse.allowed) return rateLimitExceeded(abuse.retryAfterMs);
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data(?:;|$)/iu.test(contentType) && !/^application\/json(?:;|$)/iu.test(contentType)) return fail("invalid_request", 415);
  try {
    const bytes = await boundedBody(req); if (!bytes) return fail("invalid_request", 413);
    let fields: IntakeTextFields, files: File[] = [];
    if (/^application\/json/iu.test(contentType)) {
      const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return fail("invalid_request", 400);
      const raw = decoded as Record<string, unknown>;
      if (raw.action === "reconcile" || raw.action === "settle") {
        const capability = capabilitySchema.safeParse(raw);
        if (!capability.success) return fail("invalid_request", 400);
        const { action, operationId, requestHash } = capability.data;
        return operationResponse(await (action === "settle" ? settlePublicIntakeOperation : lookupPublicIntakeOperation)(operationId, requestHash));
      }
      if (raw.formVersion === "etorie-request-v1") return fail("invalid_request", 400);
      fields = {};
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string") fields[key] = value;
        else if (key === "options" && Array.isArray(value) && value.every(item => typeof item === "string")) fields.options = value;
      }
    } else {
      const form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
      fields = intakeTextFields(form);
      for (const [key, value] of form.entries()) if (typeof value !== "string") {
        if (key !== "refImages") return fail("invalid_request", 400);
        files.push(value);
      }
    }
    const operationId = intakeOperationIdSchema.safeParse(fields.operationId);
    if (!operationId.success) {
      recordPublicIntakeMetric("legacy_operation_id_missing");
      return NextResponse.json({ ok: false, error: "client_update_required", operationState: "unknown",
        guidance: "入力内容をコピーして保管し、保存済みの受付がないか公開連絡先へ確認してから、このページを更新してください。自動で再応募しないでください。" }, { status: 409 });
    }
    const declaredHash = intakeHashSchema.safeParse(fields.requestHash);
    if (!declaredHash.success) return fail("invalid_request", 400);
    if (typeof fields.website === "string" && fields.website.trim()) return NextResponse.json({ ok: true, success: true, spam: true, accepted: false });
    if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 4 * 1024 * 1024) return fail("invalid_request", 400);
    const manifest: IntakeManifest = [];
    for (const file of files) {
      if (file.size < 1 || file.size > 4 * 1024 * 1024) return fail("invalid_request", 400);
      const digest = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
      // Validate declared MIME and bytes independently in Storage preparation before any upload.
      const entry = intakeManifestSchema.element.parse({ digest, size: file.size, type: file.type });
      manifest.push(entry);
    }
    const canonical = canonicalizeIntake(fields, manifest);
    if (hashCanonicalIntake(canonical) !== declaredHash.data) return fail("request_hash_mismatch", 409, "conflict");
    const existing = await lookupPublicIntakeOperation(operationId.data, declaredHash.data);
    if (existing.kind !== "not_found" && existing.kind !== "processing") return operationResponse(existing);
    // Replay survives flag/admission closure. Only a genuinely new operation consumes the ordinary quota.
    if (existing.kind === "not_found") {
      const quota = await checkRateLimit(`natori-portfolio-contact:${ip}`, { limit: 3, windowMs: 600_000 });
      if (!quota.allowed) return rateLimitExceeded(quota.retryAfterMs);
    }
    if (fields.formVersion === "etorie-request-v1" && !isPublicStructuredIntakeEnabled()) return fail("temporarily_unavailable", 503);
    const availability = await loadPublicCommissionAvailability();
    if (availability.kind !== "ok") return fail("temporarily_unavailable", 503);
    if (!availability.commissionOpen || (isMassProductionIntake(canonical) && !availability.massProductionIllustrationOpen)) return fail("submission_rejected", 409);
    recordPublicIntakeMetric(fields.formVersion === "etorie-request-v1" ? "structured_operation_attempt" : "legacy_operation_attempt");
    return operationResponse(await submitPublicIntakeOperation(operationId.data, canonical, files));
  } catch {
    console.error("[natori-intake] request_rejected_or_unconfirmed");
    return fail("invalid_request", 400);
  }
}
