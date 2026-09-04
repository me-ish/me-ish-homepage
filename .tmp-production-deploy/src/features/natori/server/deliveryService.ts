import "server-only";

// features/natori/server/deliveryService.ts
// 納品フロー（ラフ確認・納品ファイル・納品ページ・受け取り確認）。
//
// - ファイル実体は非公開バケット natori-deliveries に置き、台帳は
//   natori_delivery_files。ダウンロードは常に署名URL経由。
// - アップロードは Vercel の 4.5MB ボディ制限を避けるため、署名付き
//   アップロードURLを発行してブラウザから Supabase Storage へ直接上げる。
// - 納品ページのトークンは quoteAcceptService と同じ思想:
//   SHA-256 ハッシュのみ保存・再送で無効化・確定は必ず POST。
import { createHash, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendNatoriNoticeMail } from "@/features/natori/server/orderMailService";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";

const BUCKET = "natori-deliveries";
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export const DELIVERY_MAX_FILES_PER_FOLDER = 10;
export const DELIVERY_MAX_FILE_BYTES = 200 * 1024 * 1024; // 200MB
/** 納品ページを開くたびに発行するダウンロードURLの有効秒数（1時間） */
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

export type NatoriDeliveryFolder = "rough" | "final";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ------------------------------------------------------------------
   ファイル台帳（管理画面用）
------------------------------------------------------------------- */

export type NatoriDeliveryFile = {
  id: string;
  folder: NatoriDeliveryFolder;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
};

type FileRow = {
  id: string;
  project_id: string;
  folder: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
};

function toFileView(row: FileRow): NatoriDeliveryFile {
  return {
    id: row.id,
    folder: row.folder as NatoriDeliveryFolder,
    fileName: row.file_name,
    sizeBytes: Number(row.size_bytes) || 0,
    createdAt: row.created_at,
  };
}

export async function listNatoriDeliveryFiles(
  projectId: string
): Promise<NatoriDeliveryFile[] | null> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return null;
  const admin = supabaseAdmin();
  const { data: ownedProject, error: ownerError } = await admin
    .from("natori_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (ownerError || !ownedProject) return null;
  const { data, error } = await admin
    .from("natori_delivery_files")
    .select("id, project_id, folder, storage_path, file_name, size_bytes, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[natori-delivery] file list failed", error);
    return null;
  }
  return ((data as FileRow[] | null) ?? []).map(toFileView);
}

export type SignDeliveryUploadResult =
  | { kind: "ok"; fileId: string; path: string; token: string }
  | { kind: "not-found" }
  | { kind: "too-many-files" }
  | { kind: "too-large" }
  | { kind: "storage-error" }
  | { kind: "db-error" };

/**
 * ブラウザ直アップロード用の署名URLを発行し、台帳に行を作る。
 * storage のキーは ASCII の uuid + 拡張子（日本語ファイル名の互換問題を回避。
 * 依頼者に見せる元のファイル名は台帳に保存する）。
 */
export async function signNatoriDeliveryUpload(input: {
  projectId: string;
  folder: NatoriDeliveryFolder;
  fileName: string;
  sizeBytes: number;
}): Promise<SignDeliveryUploadResult> {
  if (input.sizeBytes > DELIVERY_MAX_FILE_BYTES) return { kind: "too-large" };

  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const admin = supabaseAdmin();
  const { data: project, error: projectError } = await admin
    .from("natori_projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (projectError) {
    console.error("[natori-delivery] project lookup failed", projectError);
    return { kind: "db-error" };
  }
  if (!project) return { kind: "not-found" };

  const { count, error: countError } = await admin
    .from("natori_delivery_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", input.projectId)
    .eq("folder", input.folder);
  if (countError) {
    console.error("[natori-delivery] file count failed", countError);
    return { kind: "db-error" };
  }
  if ((count ?? 0) >= DELIVERY_MAX_FILES_PER_FOLDER) return { kind: "too-many-files" };

  const extMatch = input.fileName.match(/\.([A-Za-z0-9]{1,10})$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
  const path = `${input.projectId}/${input.folder}/${randomUUID()}${ext}`;

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !signed) {
    console.error("[natori-delivery] signed upload url failed", signError);
    return { kind: "storage-error" };
  }

  const { data: inserted, error: insertError } = await admin
    .from("natori_delivery_files")
    .insert({
      project_id: input.projectId,
      folder: input.folder,
      storage_path: path,
      file_name: input.fileName.slice(0, 200),
      size_bytes: Math.max(0, Math.round(input.sizeBytes)),
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("[natori-delivery] file record insert failed", insertError);
    return { kind: "db-error" };
  }

  return { kind: "ok", fileId: inserted.id as string, path, token: signed.token };
}

export async function deleteNatoriDeliveryFile(fileId: string): Promise<boolean> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return false;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_delivery_files")
    .select("id, project_id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error) {
    console.error("[natori-delivery] file lookup failed", error);
    return false;
  }
  if (!data) return true; // 既に無い

  const { data: ownedProject, error: ownerError } = await admin
    .from("natori_projects")
    .select("id")
    .eq("id", data.project_id as string)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (ownerError || !ownedProject) return false;

  // 実体の削除はベストエフォート（失敗しても台帳は消して見た目を揃える）
  const { error: removeError } = await admin.storage
    .from(BUCKET)
    .remove([data.storage_path as string]);
  if (removeError) {
    console.error("[natori-delivery] storage remove failed (ignored)", removeError);
  }

  const { error: deleteError } = await admin
    .from("natori_delivery_files")
    .delete()
    .eq("id", fileId);
  if (deleteError) {
    console.error("[natori-delivery] file record delete failed", deleteError);
    return false;
  }
  return true;
}

/**
 * ラフ提出メール本文に差し込む署名URL行を作る（orderMailService から使用）。
 * ファイルが無い場合は null。
 */
export async function buildRoughFileLinkLines(
  projectId: string,
  ttlSeconds: number
): Promise<string[] | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_delivery_files")
    .select("storage_path, file_name")
    .eq("project_id", projectId)
    .eq("folder", "rough")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[natori-delivery] rough files fetch failed", error);
    return null;
  }
  const rows = (data ?? []) as Array<{ storage_path: string; file_name: string }>;
  if (rows.length === 0) return null;

  const lines: string[] = [];
  for (const row of rows) {
    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, ttlSeconds);
    if (signError || !signed) {
      console.error("[natori-delivery] rough signed url failed", signError);
      return null;
    }
    lines.push(`・${row.file_name}: ${signed.signedUrl}`);
  }
  return lines;
}

/* ------------------------------------------------------------------
   納品ページ（公開・トークンが資格情報）
------------------------------------------------------------------- */

export type NatoriDeliveryView = {
  projectId: string;
  title: string;
  clientName: string;
  acceptedAt: string | null;
  files: Array<{ fileName: string; sizeBytes: number; url: string }>;
};

export type GetNatoriDeliveryResult =
  | { kind: "ok"; delivery: NatoriDeliveryView }
  | { kind: "expired" }
  | { kind: "not-found" };

type DeliveryProjectRow = {
  id: string;
  title: string;
  client_name: string;
  status: string;
  note: string | null;
  delivery_accepted_at: string | null;
  delivery_token_expires_at: string | null;
  payment_confirmed_at: string | null;
};

async function fetchDeliveryRow(token: string): Promise<DeliveryProjectRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_projects")
    .select(
      "id, title, client_name, status, note, delivery_accepted_at, delivery_token_expires_at, payment_confirmed_at"
    )
    .eq("delivery_token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    console.error("[natori-delivery] project fetch failed", error);
    return null;
  }
  return (data as DeliveryProjectRow | null) ?? null;
}

function isExpired(row: DeliveryProjectRow): boolean {
  if (!row.delivery_token_expires_at) return false;
  return new Date(row.delivery_token_expires_at).getTime() < Date.now();
}

/** 納品ページ（GET）用。ファイルのダウンロードURLは開くたびに発行する */
export async function getNatoriDeliveryByToken(
  token: string
): Promise<GetNatoriDeliveryResult> {
  const row = await fetchDeliveryRow(token);
  if (!row) return { kind: "not-found" };
  if (!row.payment_confirmed_at) return { kind: "not-found" };
  if (isExpired(row)) return { kind: "expired" };

  const admin = supabaseAdmin();
  const { data: fileRows, error } = await admin
    .from("natori_delivery_files")
    .select("storage_path, file_name, size_bytes")
    .eq("project_id", row.id)
    .eq("folder", "final")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[natori-delivery] delivery files fetch failed", error);
    return { kind: "not-found" };
  }

  const files: NatoriDeliveryView["files"] = [];
  for (const fileRow of (fileRows ?? []) as Array<{
    storage_path: string;
    file_name: string;
    size_bytes: number;
  }>) {
    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(fileRow.storage_path, DOWNLOAD_URL_TTL_SECONDS, {
        download: fileRow.file_name,
      });
    if (signError || !signed) {
      console.error("[natori-delivery] download url failed (skipped)", signError);
      continue;
    }
    files.push({
      fileName: fileRow.file_name,
      sizeBytes: Number(fileRow.size_bytes) || 0,
      url: signed.signedUrl,
    });
  }

  return {
    kind: "ok",
    delivery: {
      projectId: row.id,
      title: row.title,
      clientName: row.client_name,
      acceptedAt: row.delivery_accepted_at,
      files,
    },
  };
}

export type AcceptNatoriDeliveryResult =
  | { kind: "ok" }
  | { kind: "already-accepted" }
  | { kind: "expired" }
  | { kind: "not-found" }
  | { kind: "db-error" };

/** 「受け取りました」ボタン（POST）からの検収確定。案件は対応完了へ進む */
export async function acceptNatoriDelivery(
  token: string,
): Promise<AcceptNatoriDeliveryResult> {
  if (!TOKEN_RE.test(token)) return { kind: "not-found" };

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("natori_accept_delivery_v1", {
    p_token_hash: hashToken(token),
  });
  if (error) {
    console.error("[natori-delivery] accept RPC failed", error);
    return { kind: "db-error" };
  }

  const accepted = data?.[0];
  if (!accepted) {
    console.error("[natori-delivery] accept RPC returned no result");
    return { kind: "db-error" };
  }
  if (accepted.result === "already-accepted") {
    return { kind: "already-accepted" };
  }
  if (accepted.result === "expired") {
    return { kind: "expired" };
  }
  if (
    accepted.result === "not-found" ||
    accepted.result === "unpaid" ||
    accepted.result === "archived" ||
    accepted.result === "invalid-state"
  ) {
    return { kind: "not-found" };
  }
  if (
    accepted.result !== "accepted" ||
    !accepted.project_title ||
    !accepted.client_name
  ) {
    console.error("[natori-delivery] accept RPC returned unexpected result", {
      result: accepted.result,
    });
    return { kind: "db-error" };
  }

  // ナトリへの通知（ベストエフォート）
  const noticeBody = [
    "納品の受け取りが確認されました。案件は「対応完了」になり、実績に追加されています。",
    "",
    `■ 案件: ${accepted.project_title}`,
    `■ 依頼者: ${accepted.client_name} 様`,
    "",
    "実績ページ: https://www.me-ish.art/natori/results",
  ].join("\n");
  const sent = await sendNatoriNoticeMail(
    `【納品完了】${accepted.client_name} 様 / ${accepted.project_title}`,
    noticeBody
  );
  if (!sent) {
    console.error("[natori-delivery] accept notice mail failed (ignored)");
  }

  return { kind: "ok" };
}
