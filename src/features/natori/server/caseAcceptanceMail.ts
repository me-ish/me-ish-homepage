import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  assertServerAcceptanceTarget,
  caseAcceptanceConfigured,
} from "@/lib/caseAcceptanceEnvironment";
import { acceptanceContext, acceptanceRpc } from "./caseAcceptance";
import { assertAcceptanceMailNotSuppressed } from "./caseNoMailAcceptance";
import type { Json } from "@/types/supabase";
import type {
  NotificationPayload,
  NotificationSendResult,
} from "./acceptanceNotifications";

type Bound = {
  owner: string;
  project: string;
  job: string;
  claim: string;
  key: string;
  hash: string;
  scope: string;
  run: string;
};
const sendScope = new AsyncLocalStorage<Bound>();
export function acceptanceMailFingerprint(
  payload: NotificationPayload,
): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
export function caseMailLink(path: string): string {
  return (
    (assertServerAcceptanceTarget(true)?.origin ?? "https://www.me-ish.art") +
    path
  );
}
export async function reserveAcceptanceMail(
  owner: string,
  project: string,
  job: string,
  claim: string,
  payload: NotificationPayload,
  frozen: Json,
): Promise<Bound | null> {
  assertAcceptanceMailNotSuppressed();
  if (!caseAcceptanceConfigured()) return null;
  const context = await acceptanceContext(owner, project, true);
  if (!context || payload.bcc?.length || payload.to.length !== 1)
    throw Error("acceptance_mail_denied");
  assertAcceptanceMailLinks(payload.text, context.origin, context.paymentUrl);
  /* frozen links are validated before reservation */
  const hash = acceptanceMailFingerprint(payload);
  const result = z
    .object({ allowed: z.literal(true), scope: z.string(), hash: z.string() })
    .parse(
      await acceptanceRpc("natori_case_acceptance_mail_v1", {
        p_run: context.target.run,
        p_owner: owner,
        p_project: project,
        p_job: job,
        p_claim: claim,
        p_hash: hash,
        p_to: payload.to[0],
        p_sender: payload.from,
        p_reply: payload.reply_to,
        p_origin: context.origin,
        p_payload: frozen,
      }),
    );
  if (result.scope !== context.scope || result.hash !== hash)
    throw Error("acceptance_mail_unconfirmed");
  return {
    owner,
    project,
    job,
    claim,
    key: `natori-notice/${job}`,
    hash,
    scope: context.scope,
    run: context.target.run,
  };
}
export function assertAcceptanceMailLinks(
  text: string,
  origin: string,
  paymentUrl?: string | null,
): void {
  for (const raw of text.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    const u = new URL(raw);
    if (u.username || u.password || (u.origin !== origin && raw !== paymentUrl))
      throw Error("acceptance_mail_link_invalid");
  }
}
export async function withAcceptanceMail<T>(
  bound: Bound | null,
  execute: () => Promise<T>,
): Promise<T> {
  assertAcceptanceMailNotSuppressed();
  return bound ? sendScope.run(bound, execute) : execute();
}
export async function acceptanceMailTags(
  payload: NotificationPayload,
  key: string,
): Promise<{ name: string; value: string }[]> {
  assertAcceptanceMailNotSuppressed();
  if (!caseAcceptanceConfigured()) return [];
  const bound = sendScope.getStore();
  if (
    !bound ||
    bound.key !== key ||
    bound.hash !== acceptanceMailFingerprint(payload)
  )
    throw Error("acceptance_mail_unbound");
  const context = await acceptanceContext(bound.owner, bound.project, true);
  if (
    !context ||
    context.scope !== bound.scope ||
    context.target.run !== bound.run
  )
    throw Error("acceptance_mail_stopped");
  if (
    (await acceptanceRpc("natori_case_acceptance_send_v1", {
      p_run: bound.run,
      p_job: bound.job,
      p_claim: bound.claim,
      p_hash: bound.hash,
    })) !== true
  )
    throw Error("acceptance_mail_stale");
  return [
    { name: "natori_job", value: bound.job },
    { name: "natori_run", value: bound.run },
    { name: "natori_hash", value: bound.hash },
  ];
}
export async function acceptanceTransport(
  payload: NotificationPayload,
  key: string,
  execute: () => Promise<NotificationSendResult>,
) {
  await acceptanceMailTags(payload, key); // Injected transports obey the same last-moment fence.
  return execute();
}
