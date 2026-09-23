import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { estimateDraftSchema } from "@/features/natori/lib/estimateDraft";
import { getEstimateDraft, saveEstimateDraft } from "@/features/natori/server/estimateDraftService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(result: Awaited<ReturnType<typeof getEstimateDraft>>) {
  switch (result.kind) {
    case "ok": return NextResponse.json({ ok: true, draft: result.draft });
    case "not-found": return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "invalid-state": return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    case "conflict": return NextResponse.json({ error: "draft_changed" }, { status: 409 });
    case "db-error": return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return response(await getEstimateDraft(new URL(request.url).searchParams.get("projectId") ?? ""));
}

export async function PUT(request: Request) {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const input = body as Record<string, unknown>;
  if ("requestData" in input || "request_data" in input) return NextResponse.json({ error: "immutable_field" }, { status: 400 });
  if (typeof input.projectId !== "string" || !Number.isSafeInteger(input.revision) || Number(input.revision) < 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = estimateDraftSchema.safeParse({ agreedTerms: input.agreedTerms, items: input.items });
  if (!parsed.success) return NextResponse.json({ error: "invalid_draft" }, { status: 400 });
  return response(await saveEstimateDraft(input.projectId, Number(input.revision), parsed.data));
}
