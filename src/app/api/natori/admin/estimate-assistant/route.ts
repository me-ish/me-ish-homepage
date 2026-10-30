import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";
import { runEstimateAssistant } from "@/features/natori/server/estimateAssistantService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Rebuilds the estimate draft from the request and the talk. Never issues or sends anything. */
export const POST = withNatoriManagement("estimate-assistant.POST", true, async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.projectId !== "string" || !Number.isSafeInteger(input.revision) || Number(input.revision) < 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const result = await runEstimateAssistant(await resolveNatoriOwnerId(), input.projectId, Number(input.revision));
  switch (result.kind) {
    case "ok": return NextResponse.json({ ok: true, draft: result.draft });
    case "disabled": return NextResponse.json({ error: "assistant_disabled" }, { status: 404 });
    case "not-found": return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "invalid-state": return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    case "conflict": case "skipped": return NextResponse.json({ error: "draft_changed" }, { status: 409 });
    case "unreadable": return NextResponse.json({ error: "request_unreadable" }, { status: 422 });
    case "ai-error": case "db-error": return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
});
