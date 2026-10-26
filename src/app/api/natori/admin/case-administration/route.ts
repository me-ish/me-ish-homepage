import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { caseDashboardPreviewMode } from "@/features/natori/server/caseDashboardPreview";
import {
  readCaseAdministration,
  lookupCaseAdministration,
  commandCaseAdministration,
} from "@/features/natori/server/caseAdministration";
export const runtime = "nodejs",
  dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export const GET = withNatoriManagement(
  "case-administration.GET",
  false,
  async (request: Request) => {
    if (caseDashboardPreviewMode() === "off")
      return NextResponse.json(
        { error: "unavailable" },
        { status: 404, headers },
      );
    const p = new URL(request.url).searchParams,
      project = p.get("projectId"),
      operation = p.get("operationId"),
      notice=p.get("notificationId");
    if (
      (!project && !operation) ||
      (notice&&(!project||!z.uuid().safeParse(notice).success)) ||
      (project && !z.uuid().safeParse(project).success) ||
      (operation && !z.uuid().safeParse(operation).success)
    )
      return NextResponse.json({ error: "invalid" }, { status: 400, headers });
    try {
      const view = project ? await readCaseAdministration(project,notice??undefined) : null,
        receipt = operation ? await lookupCaseAdministration(operation) : null;
      if (project && (!view || (receipt && receipt.projectId !== project)))
        return NextResponse.json(
          { error: "not_found" },
          { status: 404, headers },
        );
      return NextResponse.json({ view, receipt }, { headers });
    } catch {
      return NextResponse.json(
        { error: "read_unavailable" },
        { status: 503, headers },
      );
    }
  },
);
export const POST = withNatoriManagement(
  "case-administration.POST",
  true,
  async (request: Request) => {
    const csrf = checkCsrf(request);
    if (csrf) return csrf;
    if (caseDashboardPreviewMode() !== "interactive")
      return NextResponse.json(
        { error: "unavailable" },
        { status: 404, headers },
      );
    try {
      return NextResponse.json(
        await commandCaseAdministration(await request.json()),
        { headers },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof z.ZodError ? "invalid" : "result_unconfirmed",
        },
        { status: error instanceof z.ZodError ? 400 : 503, headers },
      );
    }
  },
);
