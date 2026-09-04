// api/natori/admin/delivery-files/route.ts
// ラフ確認・納品ファイルの台帳操作（一覧 / アップロード署名 / 削除）。
// 実体のアップロードはブラウザから Supabase Storage へ直接行う
// （POST はその署名URLを発行するだけ。Vercel のボディ制限を通らない）。
// 業務ロジックは deliveryService に集約（route は薄く）。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  DELIVERY_MAX_FILE_BYTES,
  deleteNatoriDeliveryFile,
  listNatoriDeliveryFiles,
  signNatoriDeliveryUpload,
} from "@/features/natori/server/deliveryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const files = await listNatoriDeliveryFiles(projectId);
  if (!files) {
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
  return NextResponse.json({ files });
}

export async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const payload = (await request.json().catch(() => null)) as {
    projectId?: unknown;
    folder?: unknown;
    fileName?: unknown;
    sizeBytes?: unknown;
  } | null;
  const projectId = typeof payload?.projectId === "string" ? payload.projectId.trim() : "";
  const folder = payload?.folder;
  const fileName = typeof payload?.fileName === "string" ? payload.fileName.trim() : "";
  const sizeBytes = Number(payload?.sizeBytes);

  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  if (folder !== "rough" && folder !== "final") {
    return NextResponse.json({ error: "folder must be rough or final" }, { status: 400 });
  }
  if (!fileName || fileName.length > 200) {
    return NextResponse.json({ error: "fileName is required (max 200)" }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "sizeBytes must be positive" }, { status: 400 });
  }

  const result = await signNatoriDeliveryUpload({ projectId, folder, fileName, sizeBytes });
  switch (result.kind) {
    case "not-found":
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    case "too-large":
      return NextResponse.json(
        { error: `ファイルは1つ${Math.round(DELIVERY_MAX_FILE_BYTES / 1024 / 1024)}MBまでです` },
        { status: 400 }
      );
    case "too-many-files":
      return NextResponse.json({ error: "ファイル数の上限に達しています" }, { status: 400 });
    case "storage-error":
    case "db-error":
      return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 });
    case "ok":
      return NextResponse.json({
        ok: true,
        fileId: result.fileId,
        path: result.path,
        token: result.token,
      });
  }
}

export async function DELETE(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const payload = (await request.json().catch(() => null)) as { fileId?: unknown } | null;
  const fileId = typeof payload?.fileId === "string" ? payload.fileId.trim() : "";
  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });

  const ok = await deleteNatoriDeliveryFile(fileId);
  if (!ok) return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
