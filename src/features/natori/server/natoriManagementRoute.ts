import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { NatoriManagementError, resolveNatoriManagementContext } from "@/features/natori/server/natoriOwner";
import { natoriManagementScope } from "@/features/natori/server/natoriManagementScope";

/** Authentication/configuration errors must never look like an empty dataset. */
export function withNatoriManagement<Args extends unknown[]>(
  operation: string,
  mutation: boolean,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      const context = await resolveNatoriManagementContext();
      return await natoriManagementScope.run(context, async () => {
        const requestId = mutation ? randomUUID() : null;
        const audit = (phase: "started" | "responded" | "threw", status?: number) => {
          if (!mutation) return;
          // No body, customer name/email, cookies, query string, or capability URLs.
          console.info("[natori-management-operation]", {
            requestId, operation, phase, status,
            ownerId: context.ownerId, operator: context.operator,
          });
        };
        audit("started");
        try {
          const result = await handler(...args);
          audit("responded", result.status);
          return result;
        } catch (error) {
          audit("threw");
          throw error;
        }
      });
    } catch (error) {
      if (!(error instanceof NatoriManagementError)) throw error;
      return NextResponse.json(
        { error: error.message, code: error.code === "unauthorized" ? "unauthorized" : "natori_owner_unavailable" },
        { status: error.code === "unauthorized" ? 401 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
