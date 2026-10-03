"use client";
import { z } from "zod";
import { canonicalIntakeJson, canonicalizeIntake, intakeHashSchema, intakeManifestSchema, intakeOperationIdSchema, intakeTextFields, type IntakeTextFields } from "../lib/intakeOperation";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

const savedSchema = z.strictObject({
  operationId: intakeOperationIdSchema, requestHash: intakeHashSchema,
  fields: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  manifest: intakeManifestSchema,
});
export type FrozenIntakeOperation = z.infer<typeof savedSchema>;
export type IntakeClientResult =
  | { kind: "completed"; receipt: string }
  | { kind: "processing" | "not_found" | "failed" | "conflict" | "needs_review" | "unknown"; retryAfter?: number };

async function sha256(bytes: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
}
export async function intakeFileManifest(files: File[]) {
  return intakeManifestSchema.parse(await Promise.all(files.map(async file => ({
    digest: await sha256(await file.arrayBuffer()), size: file.size, type: file.type,
  }))));
}
export async function createFrozenIntakeOperation(fields: IntakeTextFields, files: File[]): Promise<FrozenIntakeOperation> {
  const manifest = await intakeFileManifest(files);
  const canonical = canonicalizeIntake(fields, manifest);
  const requestHash = await sha256(new TextEncoder().encode(canonicalIntakeJson(canonical)));
  return { operationId: crypto.randomUUID(), requestHash, fields: structuredClone(fields), manifest };
}
export function frozenIntakeFromForm(form: FormData, files: File[]) {
  return createFrozenIntakeOperation(intakeTextFields(form), files);
}
export function saveFrozenIntakeOperation(key: string, operation: FrozenIntakeOperation): void {
  // Fail before sending if a reload-safe record cannot be written. No silent memory-only fallback.
  sessionStorage.setItem(key, JSON.stringify(savedSchema.parse(operation)));
}
export function loadFrozenIntakeOperation(key: string): FrozenIntakeOperation | null {
  const encoded = sessionStorage.getItem(key);
  if (!encoded) return null;
  const parsed = savedSchema.safeParse(JSON.parse(encoded));
  if (!parsed.success) throw new Error("saved_operation_invalid");
  return parsed.data;
}
export function clearFrozenIntakeOperation(key: string): void { sessionStorage.removeItem(key); }

const DRAFTS_KEY = "natori-intake-original-answers-v1";
const RECEIPTS_KEY = "natori-intake-receipts-v1";
const receiptSchema = z.strictObject({ receipt: intakeOperationIdSchema, clientEmail: z.string() });
export type IntakeReceipt = z.infer<typeof receiptSchema>;
export function loadIntakeOriginalAnswers(): FrozenIntakeOperation[] {
  const encoded = sessionStorage.getItem(DRAFTS_KEY);
  return encoded ? z.array(savedSchema).parse(JSON.parse(encoded)) : [];
}
export function preserveIntakeOriginalAnswers(operation: FrozenIntakeOperation): FrozenIntakeOperation[] {
  const drafts = loadIntakeOriginalAnswers();
  if (!drafts.some(draft => draft.operationId === operation.operationId)) drafts.push(savedSchema.parse(operation));
  sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  return drafts;
}
export function confirmIntakeOriginalAnswers(operationId: string): FrozenIntakeOperation[] {
  const drafts = loadIntakeOriginalAnswers().filter(draft => draft.operationId !== operationId);
  sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  return drafts;
}
export function loadIntakeReceipts(): IntakeReceipt[] {
  const encoded = sessionStorage.getItem(RECEIPTS_KEY);
  return encoded ? z.array(receiptSchema).parse(JSON.parse(encoded)) : [];
}
/** Explicit new-request action: recheck completion and durably retain A before releasing its active slot. */
export async function retireCompletedIntakeOperation(key: string, receipt: string, isCurrent: () => boolean = () => true): Promise<IntakeReceipt[] | null> {
  const operation = loadFrozenIntakeOperation(key);
  if (!isCurrent() || !operation || operation.operationId !== receipt) return null;
  const checked = await recoverFrozenIntakeOperation(operation);
  if (!isCurrent() || checked.kind !== "completed" || checked.receipt !== receipt) return null;
  const current = loadFrozenIntakeOperation(key);
  if (!current || current.operationId !== operation.operationId || current.requestHash !== operation.requestHash) return null;
  const receipts = loadIntakeReceipts();
  if (!receipts.some(item => item.receipt === receipt)) receipts.push(receiptSchema.parse({ receipt,
    clientEmail: typeof operation.fields.email === "string" ? operation.fields.email : "" }));
  // Storage failure keeps the original active record; never reset a form without the receipt saved.
  sessionStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  confirmIntakeOriginalAnswers(receipt);
  clearFrozenIntakeOperation(key);
  return receipts;
}


async function parseResult(response: Response, operationId: string): Promise<IntakeClientResult> {
  const decoded: unknown = await response.json().catch(() => null);
  const parsed = z.object({ operationState: z.string().optional(), accepted: z.boolean().optional(), receipt: z.uuid().optional() }).safeParse(decoded);
  if (parsed.success && parsed.data.operationState === "completed" && parsed.data.accepted === true && parsed.data.receipt === operationId) return { kind: "completed", receipt: operationId };
  const state = parsed.success ? parsed.data.operationState : null;
  const retry = Number(response.headers.get("Retry-After"));
  const retryAfter = response.status === 429 && Number.isFinite(retry) && retry > 0 ? Math.min(Math.ceil(retry), 3600) : undefined;
  if (state === "processing" || state === "not_found" || state === "failed" || state === "conflict" || state === "needs_review") return { kind: state, ...(retryAfter ? { retryAfter } : {}) };
  return { kind: "unknown", ...(retryAfter ? { retryAfter } : {}) };
}

export async function checkFrozenIntakeOperation(operation: FrozenIntakeOperation, action: "reconcile" | "settle" = "reconcile"): Promise<IntakeClientResult> {
  try {
    const response = await fetch("/api/natori/portfolio/contact", { method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ action, operationId: operation.operationId, requestHash: operation.requestHash }) });
    return await parseResult(response, operation.operationId);
  } catch { return { kind: "unknown" }; }
}

/** A tombstone safely fences a delayed original POST before telling the user editing is possible. */
export async function recoverFrozenIntakeOperation(operation: FrozenIntakeOperation): Promise<IntakeClientResult> {
  const checked = await checkFrozenIntakeOperation(operation);
  return checked.kind === "not_found" ? checkFrozenIntakeOperation(operation, "settle") : checked;
}

export async function sendFrozenIntakeOperation(operation: FrozenIntakeOperation, files: File[]): Promise<IntakeClientResult> {
  const manifest = await intakeFileManifest(files);
  if (canonicalIntakeJson(manifest) !== canonicalIntakeJson(operation.manifest)) throw new Error("attachment_reselect_required");
  const canonical = canonicalizeIntake(operation.fields, manifest);
  const hash = await sha256(new TextEncoder().encode(canonicalIntakeJson(canonical)));
  if (hash !== operation.requestHash) throw new Error("saved_operation_invalid");
  const form = new FormData();
  for (const [key, value] of Object.entries(operation.fields)) {
    if (key === "operationId" || key === "requestHash") continue;
    for (const item of Array.isArray(value) ? value : [value]) form.append(key, item);
  }
  form.set("operationId", operation.operationId); form.set("requestHash", operation.requestHash);
  for (const file of files) form.append("refImages", file);
  try {
    const response = await fetch("/api/natori/portfolio/contact", { method: "POST", headers: { ...CSRF_HEADERS }, body: form });
    return await parseResult(response, operation.operationId);
  } catch { return { kind: "unknown" }; }
}
