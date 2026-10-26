import "server-only";
import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";

/** Any malformed opt-in also suppresses transport; it never enables a fallback. */
export function caseAcceptanceMailSuppressed(): boolean {
  const value = process.env.NATORI_CASE_ACCEPTANCE_NO_MAIL;
  return Boolean(value && value !== "0");
}

/** Eligibility only. The owner/project/run budget is checked by acceptanceContext. */
export function caseNoMailAcceptanceEnabled(observe = false): boolean {
  if (!caseAcceptanceMailSuppressed()) return false;
  if (process.env.NATORI_CASE_ACCEPTANCE_NO_MAIL !== "1"
    || !assertServerAcceptanceTarget(observe)
    || process.env.NATORI_NOTIFICATION_SENDING_ENABLED !== "0"
    || process.env.RESEND_API_KEY
    || process.env.NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET
    || process.env.NATORI_CASE_PRODUCTION_MAIL_CONNECTION
    || process.env.NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS
    || (process.env.NATORI_CASE_RELEASE_ENABLED && process.env.NATORI_CASE_RELEASE_ENABLED !== "0")) {
    throw Error("acceptance_no_mail_invalid");
  }
  return true;
}

export function assertAcceptanceMailNotSuppressed(): void {
  if (caseAcceptanceMailSuppressed()) throw Error("acceptance_mail_disabled");
}
