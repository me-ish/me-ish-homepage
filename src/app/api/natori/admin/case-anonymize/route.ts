import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
// api/natori/admin/case-anonymize/route.ts
// 案件の依頼者情報の匿名化：状態の読み取りと「今すぐ匿名化」。業務ロジックは caseAnonymizationService。
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { anonymizeNatoriCaseNow, readNatoriCaseAnonymization } from "@/features/natori/server/caseAnonymizationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
const invalid = () => NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore });

export const GET = withNatoriManagement("case-anonymize.GET", false, async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) return unauthorized();
  const projectId = z.uuid().safeParse(new URL(request.url).searchParams.get("projectId"));
  if (!projectId.success) return invalid();
  const status = await readNatoriCaseAnonymization(projectId.data);
  if (!status) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  return NextResponse.json({ status }, { headers: noStore });
});

// 取り消せない操作なので、画面の確認を通った合図（confirm）が無い呼び出しは受け付けない。
const body = z.strictObject({ projectId: z.uuid(), confirm: z.literal("anonymize") });

export const POST = withNatoriManagement("case-anonymize.POST", true, async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) return unauthorized();
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const outcome = await anonymizeNatoriCaseNow(parsed.data.projectId);
  switch (outcome.kind) {
    case "applied":
    case "already":
      return NextResponse.json({ ok: true, result: outcome.kind, label: outcome.label, filesRemoved: outcome.filesRemoved }, { headers: noStore });
    case "not-found":
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    case "not-eligible":
    case "too-early":
    case "busy":
      return NextResponse.json({ error: outcome.kind }, { status: 409, headers: noStore });
    case "invalid":
      return invalid();
    case "db-error":
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers: noStore });
  }
});
