import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { getStaffConsultation, retryStaffConsultationNotification, sendStaffConsultation } from "@/features/natori/server/consultationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const result = await getStaffConsultation(projectId);
  return result ? NextResponse.json({ messages: result.messages }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const input = await request.json().catch(() => null) as { projectId?: unknown; body?: unknown; retryMessageId?: unknown } | null;
  if (typeof input?.projectId !== "string") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = typeof input.retryMessageId === "string"
    ? await retryStaffConsultationNotification(input.projectId, input.retryMessageId)
    : typeof input.body === "string" ? await sendStaffConsultation(input.projectId, input.body) : "invalid";
  if (result === "invalid") return NextResponse.json({ error: "本文は1〜4000文字で入力してください" }, { status: 400 });
  if (result === "not-found") return NextResponse.json({ error: "案件または依頼者メールが見つかりません" }, { status: 404 });
  if (result === "db-error") return NextResponse.json({ error: "相談内容を保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, notificationFailed: result === "notification-failed" });
}
