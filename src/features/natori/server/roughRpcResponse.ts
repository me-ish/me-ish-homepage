import "server-only";

/** Missing/malformed envelopes cannot prove a successful database operation. */
export function roughRpcSucceeded(value: unknown): value is { data: unknown; error: null } {
  return !!value && typeof value === "object" && "data" in value && "error" in value && value.error === null;
}
