import "server-only";
import { caseAcceptanceConfigured } from "@/lib/caseAcceptanceEnvironment";
import { parseCaseReleaseTarget } from "../lib/caseReleaseTarget";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";

export function caseReleaseConfigured(): boolean {
  return Boolean(process.env.NATORI_CASE_RELEASE_ENABLED || process.env.NATORI_CASE_RELEASE_TARGET);
}

/** Default OFF. Revalidate on every admission; never infer production from NODE_ENV alone. */
export function assertCaseReleaseTarget() {
  // An explicit OFF is not a malformed opt-in. Keep ordinary legacy access and
  // its persistent DB holds intact when this new profile is disabled.
  if (process.env.NATORI_CASE_RELEASE_ENABLED === "0") return null;
  if (!caseReleaseConfigured()) return null;
  const owner = resolveTrustedNatoriOwnerId();
  if (process.env.NATORI_CASE_RELEASE_ENABLED !== "1" || !process.env.NATORI_CASE_RELEASE_TARGET
    || caseAcceptanceConfigured() || owner.kind !== "ok") throw Error("case_release_target_invalid");
  return parseCaseReleaseTarget(process.env.NATORI_CASE_RELEASE_TARGET, {
    nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV,
    project: process.env.VERCEL_PROJECT_ID, owner: owner.ownerId,
    serverUrl: process.env.SUPABASE_URL, publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
