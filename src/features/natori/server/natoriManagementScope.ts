import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export type NatoriOperator =
  | { kind: "auth-user"; userId: string }
  | { kind: "shared-key"; userId: null };

export type NatoriManagementContext = { ownerId: string; operator: NatoriOperator };

// Request-local only: never keep one user's authorization in a process-wide cache.
export const natoriManagementScope = new AsyncLocalStorage<NatoriManagementContext>();
