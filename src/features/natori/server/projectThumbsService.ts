import "server-only";

// Management thumbnails never become public portfolio assets.
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";

const BUCKET = "natori-management-assets";
const LEGACY_BUCKET = "natori-portfolio";
const FOLDER = "project-thumbs";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

function thumbPath(ownerId: string, projectId: string): string {
  return `${FOLDER}/${ownerId}/${projectId}.webp`;
}

/** 更新のたびに URL を変え、差し替え後も古いキャッシュが見えないようにする */
function versionedManagementUrl(projectId: string, version: string): string {
  return `/api/natori/admin/project-thumbs/${encodeURIComponent(projectId)}?v=${encodeURIComponent(version)}`;
}

export type ListProjectThumbsResult =
  | { kind: "ok"; thumbs: Record<string, string> }
  | { kind: "storage-error" };

/** projectId → 認可済み取得APIのURL のマップを返す */
export async function listNatoriProjectThumbs(): Promise<ListProjectThumbsResult> {
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "ok", thumbs: {} };
  const admin = supabaseAdmin();
  const { data: projects, error: projectError } = await admin
    .from("natori_projects")
    .select("id")
    .eq("user_id", ownerId);
  if (projectError) return { kind: "storage-error" };
  const allowedIds = new Set(
    (projects ?? []).map((project) => String(project.id)),
  );
  const [privateFiles, legacyFiles] = await Promise.all([
    admin.storage.from(BUCKET).list(`${FOLDER}/${ownerId}`, { limit: 1000 }),
    admin.storage.from(LEGACY_BUCKET).list(FOLDER, { limit: 1000 }),
  ]);
  if (privateFiles.error || legacyFiles.error) {
    console.error("[natori-project-thumbs] list unavailable");
    return { kind: "storage-error" };
  }
  const thumbs: Record<string, string> = {};
  for (const item of [
    ...(legacyFiles.data ?? []),
    ...(privateFiles.data ?? []),
  ]) {
    if (!item.name.endsWith(".webp")) continue;
    const projectId = item.name.slice(0, -".webp".length);
    if (!allowedIds.has(projectId)) continue;
    thumbs[projectId] = versionedManagementUrl(
      projectId,
      item.updated_at ?? "",
    );
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
  file: File,
): Promise<UploadProjectThumbResult> {
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) return { kind: "invalid-type" };
  if (file.size > IMAGE_MAX_BYTES) return { kind: "too-large" };

  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input)
    .rotate() // EXIF回転を反映
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();

  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "upload-error" };
  const admin = supabaseAdmin();
  const { data: project, error: projectError } = await admin
    .from("natori_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (projectError || !project) return { kind: "upload-error" };
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(thumbPath(ownerId, projectId), webp, {
      contentType: "image/webp",
      cacheControl: "0",
      upsert: true,
    });
  if (error) {
    console.error("[natori-project-thumbs] upload failed", error);
    return { kind: "upload-error" };
  }
  return {
    kind: "ok",
    url: versionedManagementUrl(projectId, String(Date.now())),
  };
}

/** サムネイルを削除する（案件削除時のクリーンアップ用。無ければ何もしない） */
export async function deleteNatoriProjectThumb(
  projectId: string,
): Promise<void> {
  const ownerId = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const { error } = await admin.storage
    .from(BUCKET)
    .remove([thumbPath(ownerId, projectId)]);
  if (error) {
    // 存在しない場合も含めてベストエフォート。失敗しても呼び出し元は止めない
    console.error("[natori-project-thumbs] delete failed", error);
  }
}

async function isMissingThumbnail(error: unknown): Promise<boolean> {
  // The pinned Storage SDK wraps download failures without parsing their JSON.
  // HTTP 400 alone also covers authorization and backend failures.
  if (
    typeof error !== "object" || error === null ||
    !("name" in error) || error.name !== "StorageUnknownError" ||
    !("originalError" in error) || !(error.originalError instanceof Response)
  ) return false;
  const response = error.originalError;
  if (response.status !== 400 && response.status !== 404) return false;
  try {
    const body: unknown = await response.clone().json();
    return (
      typeof body === "object" && body !== null &&
      "statusCode" in body && (body.statusCode === "404" || body.statusCode === 404) &&
      "code" in body && body.code === "NoSuchKey"
    );
  } catch {
    return false;
  }
}

/** Re-authorize the owned project on every image GET; no signed URL/CDN bearer. */
export async function readNatoriProjectThumb(
  projectId: string,
): Promise<Blob | null> {
  const ownerId = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const { data: project, error } = await admin
    .from("natori_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw new Error("Project thumbnail authorization unavailable");
  if (!project) return null;
  const downloaded = await admin.storage
    .from(BUCKET)
    .download(thumbPath(ownerId, projectId));
  if (downloaded.error) {
    if (!(await isMissingThumbnail(downloaded.error)))
      throw new Error("Thumbnail download unavailable");
    // Read compatibility is authenticated and owner-scoped. Direct legacy URLs
    // remain a separate migration/CDN gate; no URL is returned and no object moved.
    const legacy = await admin.storage
      .from(LEGACY_BUCKET)
      .download(`${FOLDER}/${projectId}.webp`);
    if (legacy.error) {
      if (await isMissingThumbnail(legacy.error)) return null;
      throw new Error("Thumbnail download unavailable");
    }
    const rechecked = await admin
      .from("natori_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", ownerId)
      .maybeSingle();
    if (rechecked.error)
      throw new Error("Project thumbnail authorization unavailable");
    return rechecked.data ? legacy.data : null;
  }
  if (!downloaded.data) return null;
  const rechecked = await admin
    .from("natori_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (rechecked.error)
    throw new Error("Project thumbnail authorization unavailable");
  return rechecked.data ? downloaded.data : null;
}
