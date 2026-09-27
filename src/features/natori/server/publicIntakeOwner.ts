import "server-only";
import { resolveTrustedNatoriOwnerId, type TrustedNatoriOwnerResult } from "@/features/natori/server/trustedNatoriOwner";

export type PublicIntakeOwnerResult = TrustedNatoriOwnerResult;

/** Public intake shares only the trusted owner setting, never management credentials. */
export function resolvePublicIntakeOwnerId(): PublicIntakeOwnerResult {
  const result = resolveTrustedNatoriOwnerId();
  if (result.kind !== "ok") console.error(`[natori-public-intake] owner ${result.kind}`);
  return result;
}
