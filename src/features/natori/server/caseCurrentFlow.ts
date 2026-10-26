import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { caseAcceptanceConfigured } from "@/lib/caseAcceptanceEnvironment";
import { assertCaseSystemAdmission } from "./caseSystemHold";

/** The already deployed dispatch choices. This does not enable any integrity flag. */
export function currentNatoriFlow(): boolean {
  return !caseAcceptanceConfigured()
    && !process.env.NATORI_CASE_PRODUCTION_MAIL_CONNECTION && !process.env.NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS
    && ["NATORI_QUOTE_INTEGRITY_ENABLED", "NATORI_PAYMENT_LINK_INTEGRITY_ENABLED", "NATORI_PAYMENT_INTEGRITY_ENABLED"]
      .every(k => process.env[k] === undefined || process.env[k] === "0");
}
export const currentFlowManaged = () => currentNatoriFlow() && process.env.NATORI_CASE_BOOTSTRAP_PHASE === "managed";

const operationSchema = z.object({
  id: z.string(), kind: z.string(), status: z.enum(["running", "completed", "unknown"]),
  response: z.record(z.string(), z.unknown()).nullable(), quote_id: z.string().nullable(),
  sent_at: z.string().nullable(), created_at: z.string(), version:z.number().int().positive().nullable().optional(),
});
export type CurrentOperation = z.infer<typeof operationSchema>;
type Scope = { owner: string; project: string; id: string };
const scope = new AsyncLocalStorage<Scope>();
export const hasCurrentFlowOperation = () => scope.getStore() !== undefined;
export const currentFlowOperationId = () => scope.getStore()?.id;

export function currentRequestHash(value: unknown): string {
  const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
    : v !== null && typeof v === "object" ? `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`
    : JSON.stringify(v) ?? "null";
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export async function currentFlowRpc(name: string, args: Record<string, unknown>, read = false): Promise<unknown> {
  const call = supabaseAdmin().rpc.bind(supabaseAdmin()) as unknown as (
    name: string, args: Record<string, unknown>, options?: { get: true },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const { data, error } = await call(name, args, read ? { get: true } : undefined);
  if (error) throw Error("current_flow_result_unconfirmed");
  return data;
}
export async function readCurrentOperation(owner: string, project: string, id?: string, kind?: string) {
  const data = await currentFlowRpc("natori_case_current_read_v1", { p_owner: owner, p_project: project,
    ...(id === undefined ? {} : { p_id: id }), ...(kind === undefined ? {} : { p_kind: kind }) }, true);
  return data === null ? null : operationSchema.parse(data);
}

/** A lost claim response never starts a provider call. A duplicate claim only reads.
 * Once execution starts, no timeout permits re-entry, even beyond provider key retention.
 */
export async function runCurrentOperation<T extends { kind: string }>(input: Scope & {
  kind: "payment" | "quote_issue" | "quote_renotify"; revision: string; request: unknown;
}, execute: () => Promise<T>): Promise<T | { kind: "result-unconfirmed" } | { kind: "rejected"; reason: string }> {
  if (!currentNatoriFlow()) return { kind: "rejected", reason: "current_flow_unavailable" };
  const claim = z.object({ result: z.string(), operation: operationSchema.optional() }).parse(await currentFlowRpc(
    "natori_case_current_claim_v1", { p_owner: input.owner, p_project: input.project, p_id: input.id,
      p_kind: input.kind, p_revision: input.revision, p_hash: currentRequestHash(input.request) }));
  if (claim.result !== "claimed") {
    if (claim.result === "existing" && claim.operation?.status === "completed" && claim.operation.response) return claim.operation.response as T;
    if (claim.result === "existing" || claim.result === "busy") return { kind: "result-unconfirmed" };
    return { kind: "rejected", reason: claim.result };
  }
  return scope.run(input, async () => {
    try {
      const result = await execute();
      // SQL will retain unknown if an external effect started without a recorded result.
      const saved = z.object({ status: z.string() }).parse(await currentStep("finish", { response: result }));
      return saved.status === "completed" ? result : { kind: "result-unconfirmed" };
    } catch {
      // Preserve the claim and effect markers. Do not log requests or provider errors.
      try { await currentStep("unknown", {}); } catch { /* The durable running row is also unresolved. */ }
      return { kind: "result-unconfirmed" };
    }
  });
}

export async function currentStep(action: string, input: Record<string, unknown>): Promise<unknown> {
  const s = scope.getStore();
  if (!s) throw Error("current_flow_scope_missing");
  return currentFlowRpc("natori_case_current_step_v1", { p_owner: s.owner, p_project: s.project, p_id: s.id, p_action: action, p_input: input });
}
export async function currentEffectStart(effect: string): Promise<void> {
  if (!scope.getStore()) { await assertCaseSystemAdmission("legacy-sender"); return; }
  await assertCaseSystemAdmission("sender", scope.getStore()!.owner);
  const result = await currentStep("start", { effect });
  if (result !== true) throw Error("current_flow_effect_blocked");
}
export async function currentEffectRecorded(effect: string, result?: Record<string, unknown>): Promise<void> {
  if (scope.getStore() && await currentStep("record", { effect, ...(result ? {result} : {}) }) !== true) throw Error("current_flow_effect_unconfirmed");
}
export async function currentMailStart(input: { quoteId: string; to: string; amount: number; subject: string; body: string; link?: string; kind: "payment" | "estimate" }): Promise<void> {
  if (!scope.getStore()) throw Error("current_flow_scope_missing");
  await assertCaseSystemAdmission("sender", scope.getStore()!.owner);
  if (await currentStep("mail_start", input) !== true) throw Error("current_flow_mail_blocked");
}
export async function currentMailAccepted(providerId: string): Promise<void> {
  if (!providerId || await currentStep("mail_accepted", { providerId }) !== true) throw Error("current_flow_mail_result_unconfirmed");
}
