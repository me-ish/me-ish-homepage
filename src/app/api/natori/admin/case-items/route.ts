import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
// api/natori/admin/case-items/route.ts
// 案件の品目の読み書き。業務ロジックは caseItemsService に集約し、ここは HTTP の出入りだけ。
// 認証・同一オリジン・CSRF は参考リンクの API と同じ。
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  addNatoriCaseItem,
  countNatoriCaseItemsByProject,
  listLinkableCaseItems,
  deleteNatoriCaseItem,
  listNatoriCaseItems,
  updateNatoriCaseItem,
  type CaseItemsResult,
} from "@/features/natori/server/caseItemsService";
import { NATORI_CASE_ITEM_MAX, caseItemCreate, caseItemDelete, caseItemUpdate } from "@/features/natori/lib/caseItems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function respond(result: CaseItemsResult) {
  switch (result.kind) {
    case "ok":
      return NextResponse.json({ ok: true, items: result.items }, { headers: noStore });
    case "not-found":
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    case "project-archived":
      return NextResponse.json({ error: "project_archived" }, { status: 409, headers: noStore });
    case "item-limit-exceeded":
      return NextResponse.json({ error: "item_limit_exceeded", limit: NATORI_CASE_ITEM_MAX }, { status: 409, headers: noStore });
    case "conflict":
      return NextResponse.json({ error: "conflict" }, { status: 409, headers: noStore });
    case "db-error":
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers: noStore });
  }
}

async function guard(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  return null;
}

async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T | null> {
  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = schema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

const invalid = () => NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore });

export const GET = withNatoriManagement("case-items.GET", false, async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const params = new URL(request.url).searchParams;
  if (params.get("linkable") === "1") {
    const items = await listLinkableCaseItems();
    if (!items) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers: noStore });
    return NextResponse.json({ items }, { headers: noStore });
  }
  if (params.get("counts") === "1") {
    const counts = await countNatoriCaseItemsByProject();
    if (!counts) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers: noStore });
    return NextResponse.json({ counts }, { headers: noStore });
  }
  const projectId = z.uuid().safeParse(params.get("projectId"));
  if (!projectId.success) return invalid();
  return respond(await listNatoriCaseItems(projectId.data));
});

export const POST = withNatoriManagement("case-items.POST", true, async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const body = await readBody(request, caseItemCreate);
  if (!body) return invalid();
  return respond(await addNatoriCaseItem(body.projectId, body.item));
});

export const PATCH = withNatoriManagement("case-items.PATCH", true, async function PATCH(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const body = await readBody(request, caseItemUpdate);
  if (!body) return invalid();
  return respond(await updateNatoriCaseItem(body.projectId, body.itemId, body.expectedUpdatedAt, body.item));
});

export const DELETE = withNatoriManagement("case-items.DELETE", true, async function DELETE(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const body = await readBody(request, caseItemDelete);
  if (!body) return invalid();
  return respond(await deleteNatoriCaseItem(body.projectId, body.itemId, body.expectedUpdatedAt));
});
