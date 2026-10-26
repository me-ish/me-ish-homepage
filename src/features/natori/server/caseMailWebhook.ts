import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import { acceptanceRpc } from "./caseAcceptance";
import { productionMailTarget, productionMailWebhookSecrets } from "./caseProductionMail";

const tags = z.union([
  z.record(z.string(), z.string()),
  z.array(z.object({ name: z.string(), value: z.string() })),
]);
const eventSchema = z.object({
  type: z.enum([
    "email.sent",
    "email.delivered",
    "email.bounced",
    "email.complained",
    "email.failed",
    "email.delivery_delayed",
  ]),
  created_at: z.iso.datetime({ offset: true }),
  data: z.object({
    email_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    tags,
  }),
});
export function verifyCaseMailSignature(
  raw: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
): string {
  const id = headers.get("svix-id") ?? "",
    stamp = headers.get("svix-timestamp") ?? "",
    signatures = headers.get("svix-signature") ?? "";
  if (
    !/^[A-Za-z0-9_-]{1,200}$/.test(id) ||
    !/^\d{10}$/.test(stamp) ||
    Math.abs(now / 1000 - Number(stamp)) > 300 ||
    !secret.startsWith("whsec_") ||
    signatures.length > 2048
  )
    throw Error("webhook_signature_invalid");
  const key = Buffer.from(secret.slice(6), "base64");
  if (key.length < 24) throw Error("webhook_configuration");
  const expected = createHmac("sha256", key)
    .update(`${id}.${stamp}.${raw}`)
    .digest();
  const valid = signatures
    .split(" ")
    .slice(0, 8)
    .some((value) => {
      if (!value.startsWith("v1,")) return false;
      const actual = Buffer.from(value.slice(3), "base64");
      return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
      );
    });
  if (!valid) throw Error("webhook_signature_invalid");
  return id;
}
export async function receiveCaseMailWebhook(
  raw: string,
  headers: Headers,
  call = acceptanceRpc,
) {
  const target = assertServerAcceptanceTarget(true);
  const production = target ? null : productionMailTarget();
  if (!target && !production) throw Error("webhook_not_configured");
  let id = "";
  const verifiedConnections = new Set<string>();
  if (target) id = verifyCaseMailSignature(raw, headers, process.env.NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET ?? "");
  else {
    for (const [connection, secret] of Object.entries(productionMailWebhookSecrets())) {
      try { id = verifyCaseMailSignature(raw, headers, secret); verifiedConnections.add(connection); }
      catch (error) { if (!(error instanceof Error) || error.message !== "webhook_signature_invalid") throw error; }
    }
    if (!verifiedConnections.size) throw Error("webhook_signature_invalid");
  }
  const parsed = eventSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw Error("webhook_payload_invalid");
  const event = parsed.data;
  const entries = Array.isArray(event.data.tags)
    ? event.data.tags
    : Object.entries(event.data.tags).map(([name, value]) => ({ name, value }));
  if (new Set(entries.map((t) => t.name)).size !== entries.length)
    throw Error("webhook_tags_invalid");
  const map = Object.fromEntries(entries.map((t) => [t.name, t.value]));
  const job = z.uuid().parse(map.natori_job),
    hash = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(map.natori_hash);
  if (production) {
    const connection = z.uuid().parse(map.natori_connection);
    if (!verifiedConnections.has(connection) || map.natori_run) throw Error("webhook_scope_invalid");
    return z.object({ result: z.enum(["recorded", "duplicate", "unmatched", "conflict"]) }).parse(
      await call("natori_case_production_mail_event_v1", {
        p_connection: connection, p_event: id, p_body_hash: createHash("sha256").update(raw).digest("hex"),
        p_job: job, p_request_hash: hash, p_provider: event.data.email_id, p_type: event.type, p_occurred: event.created_at,
        p_ref: production.ref, p_origin: production.origin,
      }));
  }
  if (!target) throw Error("webhook_not_configured");
  const run = z.uuid().parse(map.natori_run);
  if (run !== target.run) throw Error("webhook_scope_invalid");
  const scope = process.env.NATORI_CASE_ACCEPTANCE_MAIL_SCOPE;
  if (!scope) throw Error("webhook_not_configured");
  return z
    .object({
      result: z.enum(["recorded", "duplicate", "unmatched", "conflict"]),
    })
    .parse(
      await call("natori_case_mail_event_v1", {
        p_run: run,
        p_scope: scope,
        p_event: id,
        p_body_hash: createHash("sha256").update(raw).digest("hex"),
        p_job: job,
        p_request_hash: hash,
        p_provider: event.data.email_id,
        p_type: event.type,
        p_occurred: event.created_at,
      }),
    );
}
