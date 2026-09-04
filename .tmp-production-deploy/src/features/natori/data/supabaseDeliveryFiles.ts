// features/natori/data/supabaseDeliveryFiles.ts
// ラフ確認・納品ファイルのブラウザ側データアクセス。
// 一覧・削除は admin API 経由。アップロードは admin API で署名URLを発行し、
// ブラウザから Supabase Storage へ直接上げる（Vercel のボディ制限を通らない）。
import { createClient } from "@/lib/supabase/client";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

const BUCKET = "natori-deliveries";

export type NatoriDeliveryFolder = "rough" | "final";

export type NatoriDeliveryFileView = {
  id: string;
  folder: NatoriDeliveryFolder;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
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
  // 1) 署名URLの発行（台帳への行追加もここで行われる）
  const signRes = await fetch("/api/natori/admin/delivery-files", {
    method: "POST",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      folder,
      fileName: file.name,
      sizeBytes: file.size,
    }),
  });
  const signJson = (await signRes.json().catch(() => null)) as {
    ok?: boolean;
    path?: string;
    token?: string;
    fileId?: string;
    error?: string;
  } | null;
  if (!signRes.ok || !signJson?.ok || !signJson.path || !signJson.token) {
    throw new Error(signJson?.error ?? `Failed to prepare upload (${signRes.status})`);
  }

  // 2) ブラウザから Supabase Storage へ直接アップロード
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(signJson.path, signJson.token, file);
  if (error) {
    // 実体が上がらなかった台帳行は消しておく（ベストエフォート）
    if (signJson.fileId) {
      await deleteNatoriDeliveryFileById(signJson.fileId).catch(() => {});
    }
    throw new Error(error.message || "アップロードに失敗しました");
  }
}

export async function deleteNatoriDeliveryFileById(fileId: string): Promise<void> {
  const res = await fetch("/api/natori/admin/delivery-files", {
    method: "DELETE",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) throw new Error(`Failed to delete file (${res.status})`);
}
