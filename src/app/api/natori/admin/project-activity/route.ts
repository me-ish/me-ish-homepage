import { NextResponse } from "next/server";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { listNatoriProjectActivity } from "@/features/natori/server/projectActivityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  if (!PROJECT_ID_RE.test(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const activity = await listNatoriProjectActivity(projectId);
  if (!activity) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ activity });
}
