import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { DELIVERY_MAX_BYTES, DELIVERY_UUID_RE, readDeliveryManifest } from "../lib/deliveryIntegrity";
import { DELIVERY_BUCKET, verifyDeliveryObject } from "./deliveryStorageVerification";
import type { Database } from "@/types/supabase";
import type { NatoriDeliveryFile, NatoriDeliveryFolder, SignDeliveryUploadResult } from "./deliveryService";

export const deliveryIntegrityEnabled = () => process.env.NATORI_DELIVERY_INTEGRITY_ENABLED === "1";
type FileRow = Database["public"]["Tables"]["natori_delivery_files"]["Row"];

async function ownedFile(id: string): Promise<{ row: FileRow; owner: string } | null> {
  const owner = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const file = await admin.from("natori_delivery_files").select("*").eq("id", id).maybeSingle();
  if (file.error || !file.data) return null;
  const project = await admin.from("natori_projects").select("id").eq("id", file.data.project_id).eq("user_id", owner).maybeSingle();
  return !project.error && project.data ? { row: file.data, owner } : null;
}

export async function listReadyDeliveryFiles(projectId: string): Promise<NatoriDeliveryFile[] | null> {
  const owner = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const project = await admin.from("natori_projects").select("id").eq("id", projectId).eq("user_id", owner).maybeSingle();
  if (project.error || !project.data) return null;
  const [files, release] = await Promise.all([
    admin.from("natori_delivery_files").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at").order("id"),
    admin.from("natori_delivery_releases").select("manifest").eq("project_id", projectId).maybeSingle(),
  ]);
  if (files.error || release.error) return null;
  const published = new Set(readDeliveryManifest(release.data?.manifest)?.map(file => file.id) ?? []);
  return files.data.map(row => ({ id: row.id, folder: row.folder as NatoriDeliveryFolder,
    fileName: row.file_name, sizeBytes: row.size_bytes, createdAt: row.created_at,
    state: row.state as NatoriDeliveryFile["state"], published: published.has(row.id) }));
}

export async function reserveDeliveryUpload(input: {
  projectId: string; folder: NatoriDeliveryFolder; fileName: string; sizeBytes: number;
  fileId?: string; contentType?: string;
}): Promise<SignDeliveryUploadResult> {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > DELIVERY_MAX_BYTES) return { kind: "too-large" };
  const id = input.fileId ?? randomUUID();
  if (!DELIVERY_UUID_RE.test(id)) return { kind: "invalid-state" };
  const owner = await resolveNatoriOwnerId();
  const ext = input.fileName.match(/\.([A-Za-z0-9]{1,10})$/)?.[1]?.toLowerCase();
  const path = `${input.projectId}/${input.folder}/${id}${ext ? `.${ext}` : ""}`;
  const admin = supabaseAdmin();
  const reserved = await admin.rpc("natori_delivery_reserve_v1", { p_owner_id: owner,
    p_project_id: input.projectId, p_file_id: id, p_folder: input.folder, p_path: path,
    p_file_name: input.fileName, p_size_bytes: input.sizeBytes, p_content_type: input.contentType || "application/octet-stream" });
  if (reserved.error) return { kind: "db-error" };
  const row = reserved.data?.[0];
  if (row?.result === "not-found") return { kind: "not-found" };
  if (row?.result === "too-many-files") return { kind: "too-many-files" };
  if (row?.result !== "reserved") return { kind: "invalid-state" };
  const signed = await admin.storage.from(DELIVERY_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data) return { kind: "storage-error" };
  return { kind: "ok", fileId: id, path, token: signed.data.token, requiresFinalize: true };
}

export async function finalizeDeliveryFile(id: string): Promise<"ready" | "unavailable" | "not-found" | "db-error"> {
  const file = await ownedFile(id);
  if (!file) return "not-found";
  const row = file.row;
  if (row.deleted_at || row.state === "deleting") return "unavailable";
  const verifiedAt = new Date().toISOString();
  const proof = await verifyDeliveryObject({ id: row.id, path: row.storage_path, fileName: row.file_name,
    sizeBytes: row.size_bytes, contentType: row.content_type,
    // A published object's version is frozen. A reserved upload can only finalize its unique path.
    storageVersion: row.state === "ready" ? row.storage_version : null });
  if (!proof) return "unavailable";
  const result = await supabaseAdmin().rpc("natori_delivery_finalize_v1", {
    p_owner_id: file.owner, p_file_id: id, p_size_bytes: proof.sizeBytes,
    p_content_type: proof.contentType, p_storage_version: proof.storageVersion, p_verified_at: verifiedAt,
  });
  return result.error ? "db-error" : result.data === "ready" ? "ready" : "unavailable";
}

export async function removeDraftDeliveryFile(id: string): Promise<boolean> {
  const file = await ownedFile(id);
  if (!file) return false;
  const admin = supabaseAdmin();
  const claimed = await admin.rpc("natori_delivery_delete_v1", { p_owner_id: file.owner, p_file_id: id });
  if (claimed.error) return false;
  if (claimed.data === "deleted") return true;
  if (claimed.data !== "deleting") return false;
  const removed = await admin.storage.from(DELIVERY_BUCKET).remove([file.row.storage_path]);
  if (removed.error) return false;
  const finished = await admin.rpc("natori_delivery_delete_v1", { p_owner_id: file.owner, p_file_id: id, p_finish: true });
  return !finished.error && finished.data === "deleted";
}
