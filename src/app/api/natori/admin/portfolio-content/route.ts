import { NextResponse } from "next/server";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { loadPortfolioEditorState } from "@/features/natori/server/portfolioSiteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const GET = withNatoriManagement("portfolio-content.GET",false,async () => {
  try {
    return NextResponse.json(await loadPortfolioEditorState(),{headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
  } catch {
    return NextResponse.json({error:"Failed to load content"},{status:500,headers:{"Cache-Control":"private, no-store"}});
  }
});
