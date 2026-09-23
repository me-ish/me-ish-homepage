import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { finishConsultationUpload, signConsultationUpload } from "@/features/natori/server/consultationFilesService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Input = { action?: unknown; projectId?: unknown; token?: unknown; path?: unknown; fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown };

export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const raw = await request.json().catch(() => null) as Input | null;
  if (!raw || typeof raw.fileName !== "string" || typeof raw.mimeType !== "string" || typeof raw.sizeBytes !== "number") {
    return NextResponse.json({ error: "ファイル情報が不正です" }, { status: 400 });
  }
  const actor = typeof raw.projectId === "string" && raw.token === undefined
    ? { projectId: raw.projectId }
    : typeof raw.token === "string" && raw.projectId === undefined ? { token: raw.token } : null;
  if (!actor) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if ("projectId" in actor && !(await canUseNatoriManagement())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const file = { ...actor, fileName: raw.fileName, mimeType: raw.mimeType, sizeBytes: raw.sizeBytes };

  if (raw.action === "sign") {
    const result = await signConsultationUpload(file);
    if (result.kind === "invalid") return NextResponse.json({ error: "対応していない形式または容量です" }, { status: 400 });
    if (result.kind === "not-found") return NextResponse.json({ error: "相談を開けません" }, { status: 404 });
    if (result.kind === "too-many") return NextResponse.json({ error: "添付の上限に達しました。共有URLをご利用ください" }, { status: 409 });
    if (result.kind === "storage-error") return NextResponse.json({ error: "アップロードを準備できませんでした" }, { status: 500 });
    if (result.kind !== "ok") return NextResponse.json({ error: "アップロードを準備できませんでした" }, { status: 500 });
    return NextResponse.json({ path: result.path, uploadToken: result.uploadToken });
  }
  if (raw.action === "finish" && typeof raw.path === "string") {
    const result = await finishConsultationUpload({ ...file, path: raw.path });
    if (result === "invalid") return NextResponse.json({ error: "ファイル情報が不正です" }, { status: 400 });
    if (result === "not-found") return NextResponse.json({ error: "相談を開けません" }, { status: 404 });
    if (result === "storage-error") return NextResponse.json({ error: "アップロードを確認できませんでした" }, { status: 400 });
    if (result === "db-error") return NextResponse.json({ error: "添付を保存できませんでした" }, { status: 500 });
    return NextResponse.json({ ok: true, notificationFailed: result === "notification-failed" });
  }
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
