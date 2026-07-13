// api/natori/admin/page-events/route.ts
// ダッシュボードのクリック解析パネル向け集計。
import { NextResponse } from "next/server";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { summarizeNatoriPageEvents } from "@/features/natori/server/pageEventsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await summarizeNatoriPageEvents();
  if (!summary) {
    return NextResponse.json({ error: "Failed to summarize events" }, { status: 500 });
  }
  return NextResponse.json(summary);
}
