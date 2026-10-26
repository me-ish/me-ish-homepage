import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { z } from "zod";
import { caseAcceptanceConfigured } from "@/lib/caseAcceptanceEnvironment";
import { parseCaseReleaseTarget } from "../lib/caseReleaseTarget";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";
import { acceptanceRpc } from "./caseAcceptance";
import { acceptanceMailFingerprint } from "./caseAcceptanceMail";
import type { Json } from "@/types/supabase";
import type { NotificationPayload, NotificationSendResult } from "./acceptanceNotifications";
import { reconciliationFacts, type ReconciliationIdentity, type ReconciliationFacts } from "../lib/caseReconciliation";

type Bound = { target: string; owner: string; project: string; job: string; claim: string; connection: string; hash: string; credentialHash: string };
const sendScope = new AsyncLocalStorage<Bound | null>();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Mail fact reception is independent of entry/command/sender rollout flags.
 * The immutable deployment metadata must remain present when those flags stop.
 */
export function productionMailTarget() {
  if (!process.env.NATORI_CASE_PRODUCTION_MAIL_CONNECTION && !process.env.NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS) return null;
  const owner = resolveTrustedNatoriOwnerId();
  if (caseAcceptanceConfigured() || owner.kind !== "ok" || !process.env.NATORI_CASE_RELEASE_TARGET) throw Error("production_mail_target_invalid");
  return parseCaseReleaseTarget(process.env.NATORI_CASE_RELEASE_TARGET, {
    nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV, project: process.env.VERCEL_PROJECT_ID,
    owner: owner.ownerId, serverUrl: process.env.SUPABASE_URL, publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
export function productionMailWebhookSecrets(): Record<string, string> {
  return z.record(z.uuid(), z.string().regex(/^whsec_[A-Za-z0-9+/=]+$/).max(200)
    .refine(secret => Buffer.from(secret.slice(6), "base64").length >= 24))
    .refine(value => Object.keys(value).length > 0 && Object.keys(value).length <= 8)
    .parse(JSON.parse(process.env.NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS ?? "{}"));
}
function sendingTarget() {
  const target = productionMailTarget();
  if (!target) {
    // Publishing the workspace does not opt existing notification jobs into a
    // different mail contract. Only explicit mail configuration selects it.
    const sending = process.env.NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED;
    if (sending && sending !== "0") throw Error("production_mail_unconfigured");
    return null;
  }
  const connection = z.uuid().parse(process.env.NATORI_CASE_PRODUCTION_MAIL_CONNECTION);
  if (process.env.NATORI_CASE_PRODUCTION_MAIL_SENDING_ENABLED !== "1" || !productionMailWebhookSecrets()[connection]) throw Error("production_mail_stopped");
  const key = process.env.RESEND_API_KEY ?? "";
  if (!/^re_[A-Za-z0-9_]+$/.test(key)) throw Error("production_mail_unconfigured");
  return {target, connection, credentialHash: digest(key)};
}
const jobMailScope = z.object({provider_scope: z.string().nullable().optional(), provider_livemode: z.boolean().nullable().optional()});
export async function reserveProductionMail(owner: string, project: string, job: string, claim: string, payload: NotificationPayload, frozen: Json, prior?: unknown): Promise<Bound | null> {
  const c = sendingTarget();
  if (!c) {
    // Removing connection settings must not reroute a previously scoped job
    // through the existing sender. Acceptance has its own independent binding.
    if (!caseAcceptanceConfigured()) {
      // Claim returns the current DB composite, including columns newer than
      // the original generated notification type. Validate them at this boundary.
      const scope = jobMailScope.parse(prior ?? {});
      if (scope.provider_scope != null || scope.provider_livemode != null) throw Error("production_mail_scope_retained");
    }
    return null;
  }
  if (owner !== c.target.owner) throw Error("production_mail_owner_invalid");
  const hash = acceptanceMailFingerprint(payload);
  const result = z.object({allowed: z.literal(true), scope: z.string(), requestHash: z.string(), connection: z.uuid()}).parse(await acceptanceRpc("natori_case_production_mail_bind_v1", {
    p_connection: c.connection, p_owner: owner, p_project: project, p_job: job, p_claim: claim,
    p_ref: c.target.ref, p_origin: c.target.origin, p_credential_hash: c.credentialHash, p_request_hash: hash, p_payload: frozen,
  }));
  if (result.scope !== `resend/${c.connection}` || result.connection !== c.connection || result.requestHash !== hash) throw Error("production_mail_binding_unconfirmed");
  return {target: JSON.stringify(c.target), owner, project, job, claim, connection: c.connection, hash, credentialHash: c.credentialHash};
}
export function withProductionMail<T>(bound: Bound | null, execute: () => Promise<T>): Promise<T> { return sendScope.run(bound, execute); }
export async function productionMailTags(payload: NotificationPayload, key: string, credential = process.env.RESEND_API_KEY ?? ""): Promise<{name: string; value: string}[]> {
  const bound = sendScope.getStore(), current = sendingTarget();
  if (!current) { if (bound) throw Error("production_mail_unbound"); return []; }
  const matches = () => {
    const fresh = sendingTarget();
    return !!bound && !!fresh && JSON.stringify(fresh.target) === bound.target && fresh.connection === bound.connection
      && fresh.credentialHash === bound.credentialHash && digest(credential) === bound.credentialHash
      && key === `natori-notice/${bound.job}` && acceptanceMailFingerprint(payload) === bound.hash;
  };
  if (!bound || !matches()) throw Error("production_mail_unbound");
  if (await acceptanceRpc("natori_case_production_mail_send_v1", {p_connection: bound.connection, p_owner: bound.owner,
    p_project: bound.project, p_job: bound.job, p_claim: bound.claim, p_credential_hash: bound.credentialHash, p_request_hash: bound.hash}) !== true || !matches()) throw Error("production_mail_stale");
  return [{name: "natori_job", value: bound.job}, {name: "natori_connection", value: bound.connection}, {name: "natori_hash", value: bound.hash}];
}
export async function productionMailTransport(payload: NotificationPayload, key: string, execute: () => Promise<NotificationSendResult>) {
  await productionMailTags(payload, key);
  return execute();
}

/** Reads immutable signed evidence only; never searches provider messages or
 * substitutes the current sender key/connection for a historical unknown one.
 */
export async function inspectProductionMail(identity: ReconciliationIdentity, signal?: AbortSignal): Promise<ReconciliationFacts> {
  const unknown = (limit: "scope_missing" | "provider_unavailable" | "identity_mismatch" = "scope_missing"): ReconciliationFacts => ({
    state: "unknown", source: "provider_webhook", identity, checkedAt: new Date().toISOString(), complete: false, limits: [limit],
  });
  try {
    signal?.throwIfAborted();
    const target = productionMailTarget();
    if (!target || target.owner !== identity.owner || identity.mailEnvironment !== "production" || identity.livemode !== null
      || !identity.mailConnection || identity.mailRun || !identity.requestHash || !identity.payloadHash
      || identity.account !== `resend/${identity.mailConnection}`) return unknown();
    const proof = z.object({reference: z.string(), occurredAt: z.iso.datetime({offset: true}), requestHash: z.string(), payloadHash: z.string(),
      scope: z.string(), environment: z.literal("production"), connection: z.uuid(), owner: z.uuid(), ref: z.string(), origin: z.string()}).safeParse(
      await acceptanceRpc("natori_case_production_mail_evidence_v1", {p_owner: identity.owner, p_project: identity.project, p_job: identity.target, p_connection: identity.mailConnection}));
    signal?.throwIfAborted();
    if (!proof.success) return unknown("provider_unavailable");
    const p = proof.data;
    if (JSON.stringify(productionMailTarget()) !== JSON.stringify(target) || p.owner !== target.owner || p.ref !== target.ref || p.origin !== target.origin
      || p.scope !== identity.account || p.connection !== identity.mailConnection || p.requestHash !== identity.requestHash
      || p.payloadHash !== identity.payloadHash || (identity.reference && p.reference !== identity.reference)) return unknown("identity_mismatch");
    return reconciliationFacts.parse({state: "confirmed", source: "provider_webhook", identity, checkedAt: new Date().toISOString(), complete: true, limits: [],
      reference: p.reference, occurredAt: p.occurredAt, outcome: "accepted"});
  } catch { return unknown("provider_unavailable"); }
}
