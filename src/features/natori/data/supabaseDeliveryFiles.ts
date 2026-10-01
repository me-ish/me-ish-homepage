// features/natori/data/supabaseDeliveryFiles.ts
// ラフ確認・納品ファイルのブラウザ側データアクセス。
// 一覧・削除は admin API 経由。アップロードは admin API で署名URLを発行し、
// ブラウザから Supabase Storage へ直接上げる（Vercel のボディ制限を通らない）。
import { createClient } from "@/lib/supabase/client";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import type { DeliveryFileState } from "../types/delivery";
import { DELIVERY_MAX_BYTES, DELIVERY_MAX_SIZE_LABEL } from "../lib/deliveryIntegrity";
import { consultationUploadEndpoint } from "../lib/consultationUploadEndpoint";

const BUCKET = "natori-deliveries";

export type NatoriDeliveryFolder = "rough" | "final";

export type NatoriDeliveryFileView = {
  id: string;
  folder: NatoriDeliveryFolder;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  state?: DeliveryFileState;
  published?: boolean;
};

export async function fetchNatoriDeliveryFiles(
  projectId: string
): Promise<NatoriDeliveryFileView[]> {
  const res = await fetch(
    `/api/natori/admin/delivery-files?projectId=${encodeURIComponent(projectId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch delivery files (${res.status})`);
  const json = (await res.json()) as { files?: NatoriDeliveryFileView[] };
  return json.files ?? [];
}

export async function uploadNatoriDeliveryFile(
  projectId: string,
  folder: NatoriDeliveryFolder,
  file: File
): Promise<void> {
  if (file.size > DELIVERY_MAX_BYTES) {
    throw new Error(`ファイルは1つ${DELIVERY_MAX_SIZE_LABEL}までです`);
  }
  // 1) 署名URLの発行（台帳への行追加もここで行われる）
  const signRes = await fetch("/api/natori/admin/delivery-files", {
    method: "POST",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      folder,
      fileName: file.name,
      sizeBytes: file.size,
      fileId: crypto.randomUUID(),
      contentType: file.type || "application/octet-stream",
    }),
  });
  const signJson = (await signRes.json().catch(() => null)) as {
    ok?: boolean;
    path?: string;
    token?: string;
    fileId?: string;
    error?: string;
    requiresFinalize?: boolean;
  } | null;
  if (!signRes.ok || !signJson?.ok || !signJson.path || !signJson.token) {
    throw new Error(signJson?.error ?? `Failed to prepare upload (${signRes.status})`);
  }

  // 2) ブラウザから Supabase Storage へ直接アップロード
  const supabase = createClient();
  if (signJson.requiresFinalize && file.size > 6 * 1024 * 1024) {
    const { Upload } = await import("tus-js-client");
    const path = signJson.path;
    const token = signJson.token;
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, { endpoint: consultationUploadEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
        headers: { "x-signature": token }, chunkSize: 6 * 1024 * 1024, retryDelays: [0, 1000, 3000],
        uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
        metadata: { bucketName: BUCKET, objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
        onError: () => reject(new Error("アップロードの完了を確認できません。ファイル一覧から再確認してください。")), onSuccess: () => resolve(),
      });
      upload.start();
    });
  } else {
    const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(signJson.path, signJson.token, file,
      { contentType: file.type || "application/octet-stream" });
    if (error) throw new Error("アップロードの完了を確認できません。ファイル一覧から再確認してください。");
  }
  // A lost response may follow a successful upload. Keep the reservation for read-only retry/finalize.
  if (signJson.requiresFinalize && signJson.fileId) await verifyNatoriDeliveryFile(signJson.fileId);
}

export async function verifyNatoriDeliveryFile(fileId: string): Promise<void> {
  const response = await fetch("/api/natori/admin/delivery-files", { method: "PATCH",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ fileId }) });
  if (!response.ok) throw new Error("ファイルの保存を確認できません。一覧の「再確認」を押してください。");
}

export async function deleteNatoriDeliveryFileById(fileId: string): Promise<void> {
  const res = await fetch("/api/natori/admin/delivery-files", {
    method: "DELETE",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) throw new Error(`Failed to delete file (${res.status})`);
}
