import "server-only";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type TrustedNatoriOwnerResult =
  | { kind: "ok"; ownerId: string }
  | { kind: "unconfigured" }
  | { kind: "invalid" };

/** Data ownership only. This is not authorization to use management services. */
export function resolveTrustedNatoriOwnerId(): TrustedNatoriOwnerResult {
  const configured = process.env.NATORI_OWNER_USER_ID?.trim().toLowerCase() ?? "";
  if (!configured) return { kind: "unconfigured" };
  if (!UUID_PATTERN.test(configured)) return { kind: "invalid" };
  return { kind: "ok", ownerId: configured };
}
