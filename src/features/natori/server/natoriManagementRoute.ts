import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { NatoriManagementError, resolveNatoriManagementContext } from "@/features/natori/server/natoriOwner";
import { natoriManagementScope } from "@/features/natori/server/natoriManagementScope";
import { acceptanceManagementRequestAllowed } from "./caseAcceptance";
import {checkCsrf} from "@/lib/auth/csrf";
import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import { assertCaseSystemAdmission, CaseSystemHeld } from "./caseSystemHold";
import {caseWorkspaceReadAvailable} from "./caseWorkspaceRead";
import {assertCaseReleaseTarget} from "./caseRelease";
import {currentNatoriFlow} from "./caseCurrentFlow";
import {caseDashboardPreviewMode} from "./caseDashboardPreview";

/** Only these handlers bind and recheck the revision in their durable claim.
 * A body flag never authorizes order-mail or any other old business endpoint.
 */
async function currentQuoteCommand(operation:string,args:unknown[]):Promise<boolean>{
 if(!["structured-quote.POST","quote-notification.POST"].includes(operation)||!currentNatoriFlow()||caseDashboardPreviewMode()!=="interactive")return false;
 const request=args.find((v):v is Request=>v instanceof Request);
 const body:unknown=await request?.clone().json().catch(()=>null);
 return !!body&&typeof body==="object"&&"workspaceRevision" in body&&typeof body.workspaceRevision==="string"&&/^[a-f0-9]{64}$/.test(body.workspaceRevision);
}

/** Only this exact legacy route has a pure POST receipt branch. Its retry
 * selector precedes action in the handler, so it must never get this exemption.
 */
async function receiptLookup(operation:string,args:unknown[]):Promise<boolean>{
 if(operation!=="consultation.POST")return false;
 const request=args.find((v):v is Request=>v instanceof Request);if(!request)return false;
 const body:unknown=await request.clone().json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return false;
 const value=body as Record<string,unknown>;
 return (value.action==="lookup"||value.action==="inspect")&&typeof value.projectId==="string"&&"operation" in value&&typeof value.retryMessageId!=="string";
}

// Canonical workspace commands validate current revisions/evidence. A stale old
// business tab cannot regain older progress/send behavior merely by resuming.
// Profile/pricing/events/assets/draft editors are administrative operations.
// Consultation operations and immutable delivery-file routes are also reused by
// the workspace; their frozen operation/issuer/manifest guards remain canonical.
const legacyBusiness = /^(?:projects|external-inquiry|order-mail|payment-link|structured-quote|quote-notification|project-links|notifications|notification-verification)\.(?:POST|PATCH|PUT|DELETE)$/;

/** Authentication/configuration errors must never look like an empty dataset. */
export function withNatoriManagement<Args extends unknown[]>(
  operation: string,
  mutation: boolean,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      const release = assertCaseReleaseTarget();
      const request = args.find((v): v is Request => v instanceof Request);
      if (release && request && new URL(request.url).origin !== release.origin) throw Error("case_release_target_invalid");
    } catch { return NextResponse.json({error:"case_release_target_invalid"}, {status:503,headers:{"Cache-Control":"no-store"}}); }
    let acceptance=false;try { acceptance=Boolean(assertServerAcceptanceTarget(true)); } catch { return NextResponse.json({ error: "acceptance_target_invalid" }, { status: 503 }); }
    try {
      const context = await resolveNatoriManagementContext();
      return await natoriManagementScope.run(context, async () => {
        if(acceptance&&mutation){const request=args.find((v):v is Request=>v instanceof Request);if(request){const csrf=checkCsrf(request);if(csrf)return csrf;}}
        if(!await acceptanceManagementRequestAllowed(operation,args,mutation))return NextResponse.json({error:"acceptance_project_denied"},{status:404});
        // New workspace command rollout is separate from entry/read and send.
        // The persistent system hold remains the authority across legacy APIs,
        // senders and in-flight facts; this flag never resumes that hold.
        if (mutation && operation.startsWith("case-") && operation !== "case-system.POST"
          && assertCaseReleaseTarget()
          && (process.env.NATORI_CASE_RELEASE_COMMANDS_ENABLED !== "1"
            || process.env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED !== "1")) {
          return NextResponse.json({error:"case_release_read_only"},{status:503,headers:{"Cache-Control":"no-store"}});
        }
        // Closed workspace production gates return before new DB access.
        // Exact administrative stop/resume route: not a business command. Auth, CSRF,
        // acceptance target and handler schema/CAS/review checks still apply.
        if(mutation&&operation!=="case-system.POST"&&(!operation.startsWith("case-")||caseWorkspaceReadAvailable())&&!await receiptLookup(operation,args)){
          try{await assertCaseSystemAdmission(legacyBusiness.test(operation)&&!await currentQuoteCommand(operation,args)?"legacy-command":"command",context.ownerId);}
          catch(error){if(error instanceof CaseSystemHeld)return NextResponse.json({error:"natori_system_held",resultUnchanged:true},{status:503,headers:{"Cache-Control":"no-store"}});throw error;}
        }
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
      if(error instanceof CaseSystemHeld)return NextResponse.json({error:"natori_system_held",resultUnconfirmed:true},{status:503,headers:{"Cache-Control":"no-store"}});
      if (!(error instanceof NatoriManagementError)) throw error;
      return NextResponse.json(
        { error: error.message, code: error.code === "unauthorized" ? "unauthorized" : "natori_owner_unavailable" },
        { status: error.code === "unauthorized" ? 401 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
