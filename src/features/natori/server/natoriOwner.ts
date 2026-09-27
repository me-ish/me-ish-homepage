import "server-only";
import { resolveNatoriOperator } from "@/features/natori/server/requireNatoriAdmin";
import { resolveTrustedNatoriOwnerId } from "@/features/natori/server/trustedNatoriOwner";
import { natoriManagementScope, type NatoriManagementContext } from "@/features/natori/server/natoriManagementScope";

export const NATORI_OWNER_UNRESOLVED_MESSAGE =
  "管理対象の設定を確認できません。案件は変更していません。管理者に連絡してください。";

export class NatoriManagementError extends Error {
  constructor(public readonly code: "unauthorized" | "owner-unconfigured" | "owner-invalid") {
    super(code === "unauthorized" ? "Unauthorized" : NATORI_OWNER_UNRESOLVED_MESSAGE);
    this.name = "NatoriManagementError";
  }
}

export async function resolveNatoriManagementContext(): Promise<NatoriManagementContext> {
  const scoped = natoriManagementScope.getStore();
  if (scoped) return scoped;
  const operator = await resolveNatoriOperator();
  if (!operator) throw new NatoriManagementError("unauthorized");
  const owner = resolveTrustedNatoriOwnerId();
  if (owner.kind !== "ok") throw new NatoriManagementError(`owner-${owner.kind}`);
  return { ownerId: owner.ownerId, operator };
}

/** Authorized manager's target owner, independent of the operator's login ID. */
export async function resolveNatoriOwnerId(): Promise<string> {
  return (await resolveNatoriManagementContext()).ownerId;
}
