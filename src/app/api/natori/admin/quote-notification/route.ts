import {caseDashboardPreviewMode} from "@/features/natori/server/caseDashboardPreview";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { checkCsrf } from "@/lib/auth/csrf";
import { renotifyStructuredQuote } from "@/features/natori/server/structuredQuoteService";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = withNatoriManagement("quote-notification.POST", true, async (request: Request) => {
  const csrf = checkCsrf(request); if (csrf) return csrf;
  const parsed = z.strictObject({ quoteId: z.uuid(), operationId: z.uuid(),workspaceRevision:z.string().regex(/^[a-f0-9]{64}$/).optional() }).safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if(parsed.data.workspaceRevision&&caseDashboardPreviewMode()!=="interactive")return NextResponse.json({error:"workspace_unavailable"},{status:409});
  const result = await renotifyStructuredQuote(parsed.data.quoteId,parsed.data.operationId,parsed.data.workspaceRevision);
  if (result.kind === "ok") return NextResponse.json({ ok: true, ...result });
  return NextResponse.json({ error: result.kind, ...("reason" in result ? { reason: result.reason } : {}),
    resultUnconfirmed:result.kind==="result-unconfirmed",retryable: result.kind === "db-error" }, { status: result.kind === "not-found" ? 404 : result.kind === "db-error" ? 503 : 409 });
});
