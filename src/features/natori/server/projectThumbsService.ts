import "server-only";

// 実績（案件）のサムネイル画像。DB カラムを増やさず、公開バケット
// natori-portfolio の `project-thumbs/{projectId}.webp` という
// パス規約で管理する（案件IDから一意に引ける）。
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "natori-portfolio";
const FOLDER = "project-thumbs";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

function thumbPath(projectId: string): string {
  return `${FOLDER}/${projectId}.webp`;
}

/** 更新のたびに URL を変え、差し替え後も古いキャッシュが見えないようにする */
function versionedPublicUrl(projectId: string, version: string): string {
  const admin = supabaseAdmin();
  const { data } = admin.storage.from(BUCKET).getPublicUrl(thumbPath(projectId));
  return `${data.publicUrl}?v=${encodeURIComponent(version)}`;
}

export type ListProjectThumbsResult =
  | { kind: "ok"; thumbs: Record<string, string> }
  | { kind: "storage-error" };

/** projectId → 公開URL のマップを返す */
export async function listNatoriProjectThumbs(): Promise<ListProjectThumbsResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(BUCKET).list(FOLDER, {
    limit: 1000,
  });
  if (error) {
    console.error("[natori-project-thumbs] list failed", error);
    return { kind: "storage-error" };
  }
  const thumbs: Record<string, string> = {};
  for (const item of data ?? []) {
    if (!item.name.endsWith(".webp")) continue;
    const projectId = item.name.slice(0, -".webp".length);
    thumbs[projectId] = versionedPublicUrl(projectId, item.updated_at ?? "");
  }
  return { kind: "ok", thumbs };
}

export type UploadProjectThumbResult =
  | { kind: "ok"; url: string }
  | { kind: "invalid-type" }
  | { kind: "too-large" }
  | { kind: "upload-error" };

/** 画像を webp に変換して案件サムネイルとして保存（既存は上書き） */
export async function uploadNatoriProjectThumb(
  projectId: string,
  file: File
): Promise<UploadProjectThumbResult> {
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) return { kind: "invalid-type" };
  if (file.size > IMAGE_MAX_BYTES) return { kind: "too-large" };

  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input)
    .rotate() // EXIF回転を反映
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();

  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(BUCKET).upload(thumbPath(projectId), webp, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) {
    console.error("[natori-project-thumbs] upload failed", error);
    return { kind: "upload-error" };
  }
  return { kind: "ok", url: versionedPublicUrl(projectId, String(Date.now())) };
}

/** サムネイルを削除する（案件削除時のクリーンアップ用。無ければ何もしない） */
export async function deleteNatoriProjectThumb(projectId: string): Promise<void> {
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(BUCKET).remove([thumbPath(projectId)]);
  if (error) {
    // 存在しない場合も含めてベストエフォート。失敗しても呼び出し元は止めない
    console.error("[natori-project-thumbs] delete failed", error);
  }
}
