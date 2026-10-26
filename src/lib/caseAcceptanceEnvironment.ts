import {
  parseCaseAcceptanceTarget,
  type CaseAcceptanceTarget,
} from "@/features/natori/lib/caseAcceptanceTarget";

// Only nonsecret target metadata is shared with the browser. Next inlines the
// public marker at build time; the server marker must match that exact build.
export function publicAcceptanceTarget(
  observe = false,
): CaseAcceptanceTarget | null {
  const raw = process.env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET;
  return raw
    ? parseCaseAcceptanceTarget(
        raw,
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        Date.now(),
        observe,
      )
    : null;
}
export function caseAcceptanceConfigured(): boolean {
  return Boolean(
    process.env.NATORI_CASE_ACCEPTANCE_TARGET ||
      process.env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET,
  );
}
export function assertServerAcceptanceTarget(
  observe = false,
): CaseAcceptanceTarget | null {
  if (!caseAcceptanceConfigured()) return null;
  const raw = process.env.NATORI_CASE_ACCEPTANCE_TARGET;
  if (
    !raw ||
    raw !== process.env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET ||
    process.env.VERCEL_ENV === "production"
  )
    throw Error("acceptance_target_invalid");
  const target = publicAcceptanceTarget(observe);
  if (
    !target ||
    process.env.SUPABASE_URL !== process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (target.profile === "hosted" &&
      (process.env.VERCEL_ENV !== "preview" ||
        process.env.VERCEL_PROJECT_ID !== target.project)) ||
    (target.profile === "local" && Boolean(process.env.VERCEL_ENV))
  )
    throw Error("acceptance_target_invalid");
  return target;
}
export function assertAcceptanceLegacyMailDisabled(): void {
  if (caseAcceptanceConfigured()) {
    assertServerAcceptanceTarget();
    throw Error("acceptance_legacy_transport_disabled");
  }
}
