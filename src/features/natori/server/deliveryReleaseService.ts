import "server-only";
import {acceptanceProjectAllowed} from "./caseAcceptance";

import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteUrl } from "@/lib/constants";
import { DELIVERY_EXTENSION_DAYS, DELIVERY_VALID_DAYS, injectDeliveryLink } from "../lib/orderMail";
import { DELIVERY_TOKEN_RE, DELIVERY_UUID_RE, readDeliveryManifest } from "../lib/deliveryIntegrity";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { verifyDeliveryObject } from "./deliveryStorageVerification";
import { sealDeliveryNotification } from "./deliveryNotificationPayload";
import { acceptanceOutboxEnabled, dispatchAcceptanceNotification, notificationSendingEnabled } from "./acceptanceNotifications";
import type { Database, Json, NatoriDeliveryReleaseRow } from "@/types/supabase";
import type { DeliveryManifestFile } from "../types/delivery";
import type { GetNatoriDeliveryResult, AcceptNatoriDeliveryResult } from "./deliveryService";

type Project = Database["public"]["Tables"]["natori_projects"]["Row"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** GET reads only. Legacy hashes remain valid and are never silently imported or regenerated here. */
async function deliveryContext(token: string): Promise<{ project: Project; release: NatoriDeliveryReleaseRow | null; expires: string | null } | null> {
  if (!DELIVERY_TOKEN_RE.test(token)) return null;
  const admin = supabaseAdmin();
  const access = await admin.from("natori_delivery_access").select("release_id, expires_at").eq("token_hash", hash(token)).maybeSingle();
  if (access.error) throw new Error("delivery_read_failed");
  const release = access.data
    ? await admin.from("natori_delivery_releases").select("*").eq("id", access.data.release_id).maybeSingle()
    : { data: null, error: null };
  if (release.error) throw new Error("delivery_read_failed");
  const project = release.data
    ? await admin.from("natori_projects").select("*").eq("id", release.data.project_id).maybeSingle()
    : await admin.from("natori_projects").select("*").eq("delivery_token_hash", hash(token)).maybeSingle();
  if (project.error) throw new Error("delivery_read_failed");
  if(project.data&&!await acceptanceProjectAllowed(project.data.id))return null;
  if (!project.data?.payment_confirmed_at) return null;
  return { project: project.data, release: release.data, expires: access.data?.expires_at ?? project.data.delivery_token_expires_at };
}

export async function getReadyDelivery(token: string): Promise<GetNatoriDeliveryResult> {
  try {
    const context = await deliveryContext(token);
    if (!context) return { kind: "not-found" };
    const { project, release, expires } = context;
    if (!expires || Date.parse(expires) <= Date.now()) return { kind: "expired" };
    let manifest = release ? readDeliveryManifest(release.manifest) : null;
    if (release && !manifest) return { kind: "db-error" };
    if (!release) {
      const old = await supabaseAdmin().from("natori_delivery_files").select("*")
        .eq("project_id", project.id).eq("folder", "final").is("deleted_at", null).order("created_at").order("id");
      if (old.error) return { kind: "db-error" };
      manifest = old.data.map(file => ({ id: file.id, path: file.storage_path, fileName: file.file_name,
        sizeBytes: file.size_bytes, contentType: file.content_type ?? "", storageVersion: file.storage_version ?? "" }));
    }
    const files = await Promise.all((manifest ?? []).map(async file => {
      const proof = await verifyDeliveryObject({ ...file, contentType: file.contentType || null, storageVersion: file.storageVersion || null }, 3600);
      return { id: file.id, fileName: file.fileName, sizeBytes: file.sizeBytes, url: proof?.url ?? null, available: !!proof };
    }));
    const allowed = !!release && !project.deleted_at && project.status === "delivered" && files.length > 0 && files.every(file => file.available);
    const snapshot = release?.snapshot && typeof release.snapshot === "object" && !Array.isArray(release.snapshot) ? release.snapshot : null;
    return { kind: "ok", delivery: { projectId: project.id,
      title: typeof snapshot?.title === "string" ? snapshot.title : project.title,
      clientName: typeof snapshot?.clientName === "string" ? snapshot.clientName : project.client_name,
      acceptedAt: project.delivery_accepted_at, files, canAccept: allowed, expiresAt: expires,
      blockedReason: !allowed && !project.delivery_accepted_at
        ? !release ? "納品内容の確認が必要です。納品メールにご返信ください。"
          : project.deleted_at || project.status !== "delivered" ? "この案件は受取確認を受け付けていません。納品メールにご返信ください。"
            : "取得できないファイルがあります。再取得をお試しいただくか、納品メールにご返信ください。" : null } };
  } catch { return { kind: "db-error" }; }
}

export async function acceptReadyDelivery(token: string): Promise<AcceptNatoriDeliveryResult> {
  if (!DELIVERY_TOKEN_RE.test(token)) return { kind: "not-found" };
  try {
    const context = await deliveryContext(token);
    if (!context) return { kind: "not-found" };
    const { project, release, expires } = context;
    if(!await acceptanceProjectAllowed(project.id,true))return{kind:"not-found"};
    const manifest = release ? readDeliveryManifest(release.manifest) : null;
    const verifiedAt = new Date().toISOString();
    // Accepted records are replayed even if a file later disappears. They are never undone.
    if (!project.delivery_accepted_at) {
      if (!expires || Date.parse(expires) <= Date.now()) return { kind: "expired" };
      if (!release || !manifest) return { kind: "files-unavailable" };
      const verified = await Promise.all(manifest.map(file => verifyDeliveryObject(file)));
      if (verified.some(file => !file)) return { kind: "files-unavailable" };
    }
    const admin = supabaseAdmin();
    const result = await admin.rpc("natori_accept_delivery_ready_v1", {
      p_token_hash: hash(token), p_release_id: release?.id ?? project.id,
      p_manifest: (manifest ?? []) as unknown as Json, p_verified_at: verifiedAt,
    }).then(value => value, () => ({ data: null, error: { code: "transport" } }));
    if (result.error) {
      // Commit/response loss is reconciled by the same authorized link, without another business write.
      const confirmed = await deliveryContext(token);
      if (confirmed?.project.delivery_accepted_at) return { kind: "already-accepted", notificationIds: [], acceptedAt: confirmed.project.delivery_accepted_at };
      return { kind: "db-error" };
    }
    const row = result.data?.[0];
    if (row?.result === "accepted" || row?.result === "already-accepted") {
      return { kind: row.result === "accepted" ? "ok" : "already-accepted", notificationIds: row.notification_ids, acceptedAt: row.accepted_at ?? undefined };
    }
    if (row?.result === "unavailable") return { kind: "files-unavailable" };
    if (row?.result === "expired") return { kind: "expired" };
    if (["not-found", "archived", "unpaid", "invalid-state"].includes(row?.result ?? "")) return { kind: "not-found" };
    return { kind: "db-error" };
  } catch { return { kind: "db-error" }; }
}

/** Extends an already issued delivery's download period and resends it. Days are a fixed choice (DELIVERY_EXTENSION_DAYS), never free text. */
export type DeliveryExtensionInput = { days: number; reason: string };
export type IssueDeliveryInput = { projectId: string; operationId?: string; fileIds?: string[]; to: string; subject: string; body: string;
  extension?: DeliveryExtensionInput; workspace?: {revision:string;expiresAt:string} };
export type IssueDeliveryResult =
  | { kind: "ok"; releaseId: string; notificationStatus: string }
  | { kind: "not-found" | "not-configured" | "no-files" | "db-error" | "invalid-state" | "delivery-conflict" | "delivery-expired" | "invalid-expiry" | "notice-pending" };

async function issueResult(releaseId: string, noticeId: string): Promise<IssueDeliveryResult> {
  try {
    if (notificationSendingEnabled()) await dispatchAcceptanceNotification(noticeId);
    const status = await supabaseAdmin().from("natori_notification_jobs").select("status").eq("id", noticeId).maybeSingle();
    return { kind: "ok", releaseId, notificationStatus: status.data?.status ?? "unknown" };
  } catch {
    // The publication is committed. A follow-up read failure is not a failed delivery operation.
    return { kind: "ok", releaseId, notificationStatus: "unknown" };
  }
}
async function readIssueResult(releaseId:string,noticeId:string):Promise<IssueDeliveryResult>{
 const status=await supabaseAdmin().from("natori_notification_jobs").select("status").eq("id",noticeId).maybeSingle();
 return {kind:"ok",releaseId,notificationStatus:status.error?"unknown":status.data?.status??"unknown"};
}
const recoverIssue=(input:IssueDeliveryInput,release:string,notice:string)=>input.workspace?readIssueResult(release,notice):issueResult(release,notice);

export async function issueReadyDelivery(input: IssueDeliveryInput): Promise<IssueDeliveryResult> {
  if (!acceptanceOutboxEnabled()) return { kind: "not-configured" };
  if (!input.operationId || !DELIVERY_UUID_RE.test(input.operationId) || !Array.isArray(input.fileIds)
    || input.fileIds.length === 0 || input.fileIds.length > 10 || input.fileIds.some(id => !DELIVERY_UUID_RE.test(id))
    || new Set(input.fileIds).size !== input.fileIds.length) return { kind: "invalid-state" };
  if (input.extension) return extendReadyDelivery(input, input.extension);
  const owner = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const project = await admin.from("natori_projects").select("*").eq("id", input.projectId).eq("user_id", owner).maybeSingle();
  if (project.error) return { kind: "db-error" };
  if (!project.data) return { kind: "not-found" };
  // Bounded erasure runs on authorized write operations, never on public page GET.
  const purged = await admin.rpc("natori_delivery_purge_payloads_v1", { p_owner_id: owner });
  if (purged.error) return { kind: "db-error" };
  const requestHash = hash(JSON.stringify({ project: input.projectId, files: [...input.fileIds].sort(), to: input.to, subject: input.subject, body: input.body }));
  const previous = await admin.from("natori_delivery_operations").select("*").eq("project_id", input.projectId).eq("operation_id", input.operationId).maybeSingle();
  if (previous.error) return { kind: "db-error" };
  if (previous.data) return previous.data.request_hash === requestHash
    ? recoverIssue(input,previous.data.release_id, previous.data.notification_id) : { kind: "delivery-conflict" };
  const [rows, release] = await Promise.all([
    admin.from("natori_delivery_files").select("*").eq("project_id", input.projectId).eq("folder", "final").is("deleted_at", null).order("id"),
    admin.from("natori_delivery_releases").select("*").eq("project_id", input.projectId).maybeSingle(),
  ]);
  if (rows.error || release.error) return { kind: "db-error" };
  if (rows.data.length === 0 || rows.data.some(row => row.state !== "ready")
    || JSON.stringify(rows.data.map(row => row.id).sort()) !== JSON.stringify([...input.fileIds].sort())) return { kind: "no-files" };
  const currentManifest = rows.data.map(row => ({ id: row.id, path: row.storage_path, fileName: row.file_name, sizeBytes: row.size_bytes,
    contentType: row.content_type ?? "", storageVersion: row.storage_version ?? "" }));
  const manifest = release.data ? readDeliveryManifest(release.data.manifest) : readDeliveryManifest(currentManifest);
  if (!manifest) return { kind: "no-files" };
  const verifiedAt = new Date().toISOString();
  const verified = await Promise.all(manifest.map(file => verifyDeliveryObject(file)));
  if (verified.some(file => !file)) return { kind: "no-files" };
  const expires = input.workspace?.expiresAt ?? release.data?.expires_at ?? (project.data.delivery_token_hash ? project.data.delivery_token_expires_at
    : new Date(Date.now() + DELIVERY_VALID_DAYS * 86400000).toISOString());
  if (!expires || Date.parse(expires) <= Date.now()) return { kind: "delivery-expired" };
  const token = randomBytes(32).toString("base64url");
  let payload: Json;
  try {
    const from = process.env.NATORI_ORDER_MAIL_FROM?.trim();
    const reply = process.env.NATORI_PORTFOLIO_CONTACT_TO?.trim();
    if (!from || !reply) return { kind: "not-configured" };
    const bcc = process.env.NATORI_MAIL_BCC?.trim();
    payload = sealDeliveryNotification({ from, to: [input.to], ...(bcc ? { bcc: [bcc] } : {}), reply_to: reply,
      subject: input.subject, text: injectDeliveryLink(input.body, `${getSiteUrl()}/natori/delivery/${token}`)
        + `\n\n■ 保存期限: ${new Date(expires).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}まで（再送でも延長されません）`,
      headers: { "X-Meish-Template": "natori-delivery" } }, new Date(Math.min(Date.parse(expires), Date.now() + 24 * 3600000)).toISOString());
  } catch { return { kind: "not-configured" }; }
  payload=caseWorkPayload(input,payload,project.data,!release.data&&!project.data.delivery_token_hash);
  const issued = await deliveryRpc(admin,input,"natori_delivery_issue_v1", { p_owner_id: owner, p_project_id: input.projectId,
    p_to_email: input.to,
    p_operation_id: input.operationId, p_request_hash: requestHash, p_manifest: manifest as unknown as Json,
    p_verified_at: verifiedAt, p_token_hash: hash(token), p_expires_at: expires, p_payload: payload,
  }).then(value => value, () => ({ data: null, error: { code: "transport" } }));
  if (issued.error) {
    const confirmed = await admin.from("natori_delivery_operations").select("*").eq("project_id", input.projectId).eq("operation_id", input.operationId).maybeSingle();
    if (!confirmed.error && confirmed.data?.request_hash === requestHash) return recoverIssue(input,confirmed.data.release_id, confirmed.data.notification_id);
    return { kind: "db-error" };
  }
  const result = issued.data?.[0];
  if(result?.result==="recorded"&&result.release_id&&result.notification_id)return readIssueResult(result.release_id,result.notification_id);
  if (result?.result === "issued" && result.release_id && result.notification_id) return issueResult(result.release_id, result.notification_id);
  if (result?.result === "conflict") return { kind: "delivery-conflict" };
  if (result?.result === "expired") return { kind: "delivery-expired" };
  if (result?.result === "unavailable") return { kind: "no-files" };
  if (result?.result === "not-found") return { kind: "not-found" };
  return { kind: "invalid-state" };
}

async function extendReadyDelivery(input: IssueDeliveryInput, extension: DeliveryExtensionInput): Promise<IssueDeliveryResult> {
  const reason = extension.reason.trim();
  if (!(DELIVERY_EXTENSION_DAYS as readonly number[]).includes(extension.days) || reason.length < 1 || reason.length > 200) return { kind: "invalid-state" };
  const operationId = input.operationId!, fileIds = input.fileIds!;
  const owner = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const purged = await admin.rpc("natori_delivery_purge_payloads_v1", { p_owner_id: owner });
  if (purged.error) return { kind: "db-error" };
  const requestHash = hash(JSON.stringify({ project: input.projectId, files: [...fileIds].sort(), to: input.to, subject: input.subject, body: input.body,
    extendDays: extension.days, reason }));
  const previous = await admin.from("natori_delivery_operations").select("*").eq("project_id", input.projectId).eq("operation_id", operationId).maybeSingle();
  if (previous.error) return { kind: "db-error" };
  if (previous.data) return previous.data.request_hash === requestHash
    ? recoverIssue(input,previous.data.release_id, previous.data.notification_id) : { kind: "delivery-conflict" };
  const release = await admin.from("natori_delivery_releases").select("*").eq("project_id", input.projectId).maybeSingle();
  if (release.error) return { kind: "db-error" };
  if (!release.data) return { kind: "invalid-state" };
  // Only the immutable, already issued file set can be resent.
  const manifest = readDeliveryManifest(release.data.manifest);
  if (!manifest || JSON.stringify(manifest.map(file => file.id).sort()) !== JSON.stringify([...fileIds].sort())) return { kind: "no-files" };
  const verifiedAt = new Date().toISOString();
  const verified = await Promise.all(manifest.map(file => verifyDeliveryObject(file)));
  if (verified.some(file => !file)) return { kind: "no-files" };
  const expires = input.workspace?.expiresAt ?? new Date(Date.now() + extension.days * 86400000).toISOString();
  const token = randomBytes(32).toString("base64url");
  let payload: Json;
  try {
    const from = process.env.NATORI_ORDER_MAIL_FROM?.trim();
    const reply = process.env.NATORI_PORTFOLIO_CONTACT_TO?.trim();
    if (!from || !reply) return { kind: "not-configured" };
    const bcc = process.env.NATORI_MAIL_BCC?.trim();
    payload = sealDeliveryNotification({ from, to: [input.to], ...(bcc ? { bcc: [bcc] } : {}), reply_to: reply,
      subject: input.subject, text: injectDeliveryLink(input.body, `${getSiteUrl()}/natori/delivery/${token}`)
        + `\n\n■ 保存期限: ${new Date(expires).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}まで（保存期限を延長しました。以前のリンクは使えません）`,
      headers: { "X-Meish-Template": "natori-delivery" } }, new Date(Math.min(Date.parse(expires), Date.now() + 24 * 3600000)).toISOString());
  } catch { return { kind: "not-configured" }; }
  if(input.workspace){
    const currentProject=await admin.from("natori_projects").select("title,client_name,client_email").eq("id",input.projectId).eq("user_id",owner).maybeSingle();
    if(currentProject.error||!currentProject.data)return {kind:"db-error"};
    payload=caseWorkPayload(input,payload,currentProject.data,false);
  }
  const extended = await deliveryRpc(admin,input,"natori_delivery_extend_v1", { p_owner_id: owner, p_project_id: input.projectId,
    p_operation_id: operationId, p_request_hash: requestHash, p_new_expires_at: expires, p_reason: reason, p_token_hash: hash(token),
    p_manifest: manifest as unknown as Json, p_verified_at: verifiedAt, p_payload: payload,
  }).then(value => value, () => ({ data: null, error: { code: "transport" } }));
  if (extended.error) {
    const confirmed = await admin.from("natori_delivery_operations").select("*").eq("project_id", input.projectId).eq("operation_id", operationId).maybeSingle();
    if (!confirmed.error && confirmed.data?.request_hash === requestHash) return recoverIssue(input,confirmed.data.release_id, confirmed.data.notification_id);
    return { kind: "db-error" };
  }
  const result = extended.data?.[0];
  if(result?.result==="recorded"&&result.release_id&&result.notification_id)return readIssueResult(result.release_id,result.notification_id);
  if (result?.result === "extended" && result.release_id && result.notification_id) return issueResult(result.release_id, result.notification_id);
  if (result?.result === "conflict") return { kind: "delivery-conflict" };
  if (result?.result === "invalid-expiry") return { kind: "invalid-expiry" };
  if (result?.result === "notice-pending") return { kind: "notice-pending" };
  if (result?.result === "unavailable") return { kind: "no-files" };
  if (result?.result === "not-found") return { kind: "not-found" };
  return { kind: "invalid-state" };
}

/** New-workspace guard is additive. Existing callers keep their established contract. */
async function deliveryRpc(admin:ReturnType<typeof supabaseAdmin>,input:IssueDeliveryInput,
 name:"natori_delivery_issue_v1"|"natori_delivery_extend_v1",args:Record<string,Json|undefined>){
 const rpc=admin.rpc.bind(admin) as unknown as (name:string,args:Record<string,Json|undefined>)=>PromiseLike<{data:{result:string;release_id:string|null;notification_id:string|null}[]|null;error:unknown}>;
 if(!input.workspace)return rpc(name,args);
 return rpc("natori_case_delivery_v1",{p_owner:args.p_owner_id,p_project:input.projectId,p_revision:input.workspace.revision,p_extension:input.extension??null,
 p_operation_id:input.operationId,p_to_email:input.to,p_request_hash:args.p_request_hash,p_manifest:args.p_manifest,p_verified_at:args.p_verified_at,
 p_token_hash:args.p_token_hash,p_expires_at:input.workspace.expiresAt,p_payload:args.p_payload});
}

function caseWorkPayload(input:IssueDeliveryInput,payload:Json,project:{title:string;client_name:string;client_email:string|null},newRelease:boolean):Json{
 if(!input.workspace||!payload||typeof payload!=="object"||Array.isArray(payload))return payload;
 return {...payload,caseWorkGuard:createHash("sha256").update([project.title,project.client_name,(newRelease?input.to:project.client_email)??""].map(v=>`${Buffer.byteLength(v)}:${v}`).join("")).digest("hex")};
}
