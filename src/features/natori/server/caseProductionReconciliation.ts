import "server-only";
import { z } from "zod";
import { assertCaseReleaseTarget } from "./caseRelease";
import { createProductionReconciliationProvider } from "./caseReconciliationAdapter";
import { inspectProductionMail } from "./caseProductionMail";

/** Uses the recorded identity only. Missing historical scope is never backfilled
 * from the current credential, and there is no provider search for unknown mail.
 */
export function productionReconciliationProvider(beforeMutation?: () => Promise<void>) {
  const target = assertCaseReleaseTarget();
  if (!target || process.env.NATORI_CASE_RECONCILIATION_ENABLED !== "1") return null;
  const marker = JSON.stringify(target);
  const account = process.env.NATORI_CASE_RECONCILIATION_STRIPE_ACCOUNT ?? "";
  const context = async (owner: string, project: string) => {
    const current = assertCaseReleaseTarget();
    if (!current || JSON.stringify(current) !== marker || owner !== current.owner
      || !z.uuid().safeParse(project).success
      || process.env.NATORI_CASE_RECONCILIATION_ENABLED !== "1"
      || process.env.NATORI_STRIPE_MODE !== "live"
      || (process.env.NATORI_CASE_RECONCILIATION_STRIPE_ACCOUNT ?? "") !== account) return null;
    return {
      account: /^acct_[A-Za-z0-9]+$/.test(account) ? account : "",
      active: process.env.NATORI_CASE_RECONCILIATION_STOP_ENABLED === "1"
        && process.env.NATORI_CASE_RELEASE_COMMANDS_ENABLED === "1"
        && process.env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED === "1",
    };
  };
  const stripe = createProductionReconciliationProvider({
    context, fetch: globalThis.fetch,
    key: () => process.env.STRIPE_SECRET_KEY ?? "", beforeMutation,
    // Resend has no Stripe-style livemode proof. Its separate connection-bound
    // signed inbox is inspected below; never manufacture a live boolean here.
    mail: async () => null,
  });
  return {inspect: (kind: Parameters<typeof stripe.inspect>[0], identity: Parameters<typeof stripe.inspect>[1], signal?: AbortSignal) =>
    kind === "mail" ? inspectProductionMail(identity, signal) : stripe.inspect(kind, identity, signal), stopOldLink: stripe.stopOldLink};
}
