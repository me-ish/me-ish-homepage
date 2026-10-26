import "server-only";
import { z } from "zod";
import {caseSystemReviewSchema, type CaseSystemControlInput} from "../lib/caseSystemControl";
import {resolveNatoriManagementContext} from "./natoriOwner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";
import { caseAcceptanceMailSuppressed } from "./caseNoMailAcceptance";

const stateSchema = z.object({
  owner: z.uuid(), generation: z.number().int().nonnegative().safe(),
  armed: z.boolean(), commandsHeld: z.boolean(), sendersHeld: z.boolean(),
  readOnly: z.boolean(),
});
export type CaseSystemHold = z.infer<typeof stateSchema>;
export class CaseSystemHeld extends Error {
  constructor() { super("natori_system_held"); }
}

/** The initial rollout must remain closed even while the SQL guard is absent or
 * installed without an owner hold. Keep `managed` on read-only rollback too.
 * This is a restriction only; it cannot authorize an operation or settle a fact.
 */
function bootstrapPhase(): "managed" | undefined {
  const phase = process.env.NATORI_CASE_BOOTSTRAP_PHASE;
  if (phase === "managed") return phase;
  if (phase || process.env.NATORI_CASE_RELEASE_ENABLED === "1") throw new CaseSystemHeld();
  return undefined;
}

/** No UI flag/cache: removing an entry flag must not erase a persisted hold.
 * This is admission only. An already admitted external request can still finish.
 * This helper does not settle jobs, erase payloads, change keys, or retry anything.
 */
export async function readCaseSystemHold(owner: string): Promise<CaseSystemHold> {
  const call = supabaseAdmin().rpc.bind(supabaseAdmin()) as unknown as (
    name: string, args: {p_owner: string}, options: {get: true},
  ) => PromiseLike<{data: unknown; error: unknown}>;
  const value = await call("natori_case_system_status_v1", {p_owner: owner}, {get: true});
  if (value.error) throw new CaseSystemHeld();
  const state = stateSchema.safeParse(value.data);
  if (!state.success || state.data.owner !== owner) throw new CaseSystemHeld();
  return state.data;
}

export async function assertCaseSystemAdmission(kind: "command"|"legacy-command"|"sender"|"legacy-sender", owner?: string): Promise<void> {
  const phase = bootstrapPhase();
  // Direct legacy transports cannot carry the durable production mail binding.
  // Retained mail metadata must keep this fence active even with the UI OFF.
  if (kind === "legacy-sender" && (caseAcceptanceMailSuppressed() || process.env.NATORI_CASE_RELEASE_ENABLED === "1"
    || process.env.NATORI_CASE_PRODUCTION_MAIL_CONNECTION
    || process.env.NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS)) throw new CaseSystemHeld();
  const target = owner ? {kind: "ok" as const, ownerId: owner} : resolveTrustedNatoriOwnerId();
  if (target.kind !== "ok") throw new CaseSystemHeld();
  try {
    if (phase === "managed") {
      const state = await readCaseSystemHold(target.ownerId);
      if (!state.armed || state.generation < 1) throw new CaseSystemHeld();
    }
    const admin = supabaseAdmin();
    const call = admin.rpc.bind(admin) as unknown as (
      name: string, args: {p_owner: string;p_kind: string},
    ) => PromiseLike<{data: unknown; error: unknown}>;
    const value = await call("natori_case_system_admit_v1", {p_owner: target.ownerId,p_kind:kind});
    if (value.error || value.data !== true) throw new CaseSystemHeld();
  } catch { throw new CaseSystemHeld(); }
}

/** Review is local evidence only; zero rows never proves a provider did not run. */
export async function readCaseSystemReview(owner: string) {
  const admin = supabaseAdmin();
  const call = admin.rpc.bind(admin) as unknown as (
    name: string, args: {p_owner: string}, options: {get: true},
  ) => PromiseLike<{data: unknown; error: unknown}>;
  const result = await call("natori_case_system_review_v1", {p_owner: owner}, {get: true});
  const parsed = caseSystemReviewSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.owner !== owner) throw new CaseSystemHeld();
  return parsed.data;
}

/** Target and operator come from the authenticated request scope, never JSON. */
export async function controlCaseSystem(input: CaseSystemControlInput) {
  const {ownerId, operator} = await resolveNatoriManagementContext();
  if (input.action.startsWith("resume-")) {
    const phase = bootstrapPhase();
    if (phase === "managed") {
      const state = await readCaseSystemHold(ownerId);
      if (!state.armed || state.generation < 1) throw new CaseSystemHeld();
    }
  }
  const admin = supabaseAdmin();
  const call = admin.rpc.bind(admin) as unknown as (
    name: string, args: Record<string, unknown>,
  ) => PromiseLike<{data: unknown; error: unknown}>;
  const result = await call("natori_case_system_control_v2", {
    p_owner: ownerId, p_action: input.action, p_generation: input.generation,
    p_actor: operator, p_review: input.revision, p_acknowledge_prior: input.acknowledgePrior,
  });
  const parsed = z.object({result: z.enum(["saved","stale","review_stale","fresh_review_required","commands_held","invalid_request"]),
    generation: z.number().int().nonnegative().safe().optional(), priorRequestsMayComplete: z.literal(true).optional()}).safeParse(result.data);
  if (result.error || !parsed.success) throw new CaseSystemHeld();
  return parsed.data;
}
