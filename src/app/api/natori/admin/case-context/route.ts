import { NextResponse } from "next/server";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { caseDashboardSystemMode } from "@/features/natori/server/caseDashboardPreview";
import { readCaseContext } from "@/features/natori/server/caseScreenContext";
import { z } from "zod";
export const runtime = "nodejs",
  dynamic = "force-dynamic";
export const GET = withNatoriManagement(
  "case-context.GET",
  false,
  async (request: Request) => {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
    if ((await caseDashboardSystemMode()) === "off")
      return NextResponse.json(
        { error: "unavailable" },
        { status: 404, headers },
      );
    const id = new URL(request.url).searchParams.get("projectId");
    if (!z.uuid().safeParse(id).success)
      return NextResponse.json({ error: "invalid" }, { status: 400, headers });
    try {
      const result = await readCaseContext(id!);
      return NextResponse.json(result ?? { error: "not_found" }, {
        status: result ? 200 : 404,
        headers,
      });
    } catch {
      return NextResponse.json(
        { error: "unavailable" },
        { status: 503, headers },
      );
    }
  },
);
