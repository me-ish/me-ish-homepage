import { z } from "zod";

export const reconciliationKind = z.enum(["price", "link", "mail", "payment", "stop"]);
export type ReconciliationKind = z.infer<typeof reconciliationKind>;
export const reconciliationIdentity = z.object({
  owner: z.uuid(), project: z.uuid(), target: z.uuid(), quote: z.uuid().nullable(),
  account: z.string().nullable(), livemode: z.boolean().nullable(), amount: z.number().int().nullable(),
  currency: z.literal("jpy"), purpose: z.string(), key: z.string(),
  scope: z.literal("platform").optional(), attempt: z.uuid().optional(), generation: z.number().int().optional(), requestHash: z.string().optional(), mailEnvironment: z.enum(["acceptance", "production"]).optional(), mailRun: z.uuid().optional(), mailConnection: z.uuid().optional(),
  price: z.string().nullable().optional(), link: z.string().nullable().optional(),
  reference: z.string().nullable().optional(), payloadHash: z.string().nullable().optional(),
}).strict();
export type ReconciliationIdentity = z.infer<typeof reconciliationIdentity>;
export const reconciliationFacts = z.object({
  state: z.enum(["confirmed", "unknown", "unavailable", "mismatch"]),
  source: z.enum(["provider_retrieval","provider_webhook"]), identity: reconciliationIdentity,
  checkedAt: z.iso.datetime(), complete: z.boolean(),
  // Only bounded codes/references, never message bodies, addresses, keys or capability URLs.
  limits: z.array(z.enum(["not_found", "pagination", "multiple", "history_expired", "scope_missing", "provider_unavailable", "identity_mismatch", "sessions_unresolved"])).max(8),
  reference: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/).optional(),
  outcome: z.enum(["created", "active", "accepted", "paid", "stopped"]).optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(), price: z.string().regex(/^price_[A-Za-z0-9]+$/).optional(),
  url: z.string().regex(/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/).optional(),
  link: z.string().regex(/^plink_[A-Za-z0-9]+$/).optional(),
  paymentIntent: z.string().regex(/^pi_[A-Za-z0-9]+$/).optional(), sessionsSafe: z.boolean().optional(),
}).strict();
export type ReconciliationFacts = z.infer<typeof reconciliationFacts>;

export const reconciliationCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("inspect"), projectId: z.uuid(), id: z.uuid(), kind: reconciliationKind, target: z.uuid(), revision: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal("stop-old-link"), projectId: z.uuid(), id: z.uuid(), kind: z.literal("stop"), target: z.uuid(), revision: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal("apply-evidence"), projectId: z.uuid(), id: z.uuid(), evidenceId: z.uuid(), resolutionId: z.uuid(), confirmed: z.literal(true) }).strict(),
]);
export const reconciliationView = z.object({
  selectedNotice:z.uuid().optional(),
  result: z.literal("ok"), revision: z.string(),
  operations: z.array(z.object({ id: z.uuid(), action: z.string(), status: z.string(), reconciliation_id: z.uuid().nullable() })),
  notifications: z.array(z.object({ id: z.uuid(), purpose: z.string(), status: z.string(), attempt_no: z.number() })),
  mailEvents:z.array(z.object({job_id:z.uuid(),event_type:z.string(),occurred_at:z.string(),received_at:z.string()})).default([]),
  jobs: z.array(z.object({ id: z.uuid(), kind: reconciliationKind, target_id: z.uuid(), state: z.string(), generation: z.number(), created_at: z.string(), evidence_id: z.uuid().nullable(), facts: reconciliationFacts.nullable(), resolution_id: z.uuid().nullable() })),
});
export type ReconciliationView = z.infer<typeof reconciliationView>;

/** Acquiring a result is not accepting it. Negative/incomplete results never unlock. */
export function evidenceCanApply(kind: ReconciliationKind, facts: ReconciliationFacts): boolean {
  if (facts.state !== "confirmed" || !facts.complete || facts.limits.length || !facts.reference
    || !facts.identity.account || (facts.identity.livemode === null && !(kind === "mail" && facts.identity.mailEnvironment && facts.source === "provider_webhook"))) return false;
  if (kind === "price") return facts.outcome === "created" && /^price_[A-Za-z0-9]+$/.test(facts.reference);
  if (kind === "link" || kind === "stop") return /^plink_[A-Za-z0-9]+$/.test(facts.reference) && !!facts.price && !!facts.url
    && (kind === "link" ? facts.outcome === "active" : facts.outcome === "stopped" && facts.sessionsSafe === true);
  if (kind === "mail") return facts.outcome === "accepted" && !!facts.occurredAt && !!facts.identity.payloadHash
    && facts.identity.livemode === null && facts.source === "provider_webhook" && !!facts.identity.requestHash
    && (facts.identity.mailEnvironment === "acceptance" ? !!facts.identity.mailRun
      : facts.identity.mailEnvironment === "production" && !!facts.identity.mailConnection);
  return facts.outcome === "paid" && /^cs_[A-Za-z0-9_]+$/.test(facts.reference) && !!facts.link && !!facts.paymentIntent;
}
