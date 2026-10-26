import { NextResponse } from "next/server";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { caseDashboardSystemMode } from "@/features/natori/server/caseDashboardPreview";
import { readCasePlanning } from "@/features/natori/server/caseScreenContext";
export const runtime = "nodejs",
  dynamic = "force-dynamic";
export const GET = withNatoriManagement(
  "case-planning.GET",
  false,
  async () => {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
    if ((await caseDashboardSystemMode()) === "off")
      return NextResponse.json(
        { error: "unavailable" },
        { status: 404, headers },
      );
    try {
      return NextResponse.json(await readCasePlanning(), { headers });
    } catch {
      return NextResponse.json(
        { error: "unavailable" },
        { status: 503, headers },
      );
    }
  },
);
