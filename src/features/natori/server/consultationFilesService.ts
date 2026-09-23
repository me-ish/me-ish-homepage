import "server-only";

import { createHash, randomBytes, randomUUID } from "crypto";
import { Resend } from "resend";
import { getSiteUrl } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractClientEmailFromNote } from "@/features/natori/lib/orderMail";
import { consultationFileExtension, validConsultationFile } from "@/features/natori/lib/consultationFileRules";
import { getClientProject, getStaffConsultation, type ProjectRow } from "@/features/natori/server/consultationService";
import { sendNatoriNoticeMail } from "@/features/natori/server/orderMailService";

const BUCKET = "natori-consultations";
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|pdf|mp3|m4a|wav)$/i;

type Actor = { projectId: string; token?: never } | { token: string; projectId?: never };
type FileInput = Actor & { fileName: string; mimeType: string; sizeBytes: number };

async function findActor(actor: Actor): Promise<{ project: ProjectRow; sender: "staff" | "client" } | null> {
  if ("token" in actor && actor.token) {
    const project = await getClientProject(actor.token);
    if (project && !project.deleted_at && project.status !== "closed") return { project, sender: "client" };
    return null;
  }
  if ("projectId" in actor && actor.projectId) {
    const result = await getStaffConsultation(actor.projectId);
    if (result && !result.project.deleted_at && result.project.status !== "closed") return { project: result.project, sender: "staff" };
  }
  return null;
}

export type ConsultationUploadResult =
  | { kind: "ok"; path: string; uploadToken: string }
  | { kind: "invalid" | "not-found" | "too-many" | "storage-error" };

export async function signConsultationUpload(input: FileInput): Promise<ConsultationUploadResult> {
  if (!validConsultationFile(input.fileName, input.mimeType, input.sizeBytes)) return { kind: "invalid" };
  const actor = await findActor(input);
  if (!actor) return { kind: "not-found" };
  const admin = supabaseAdmin();
  // Clean up incomplete uploads on the next visit. Completed files are never
  // included, so this cannot remove a shared conversation attachment.
  const { data: stale, error: staleError } = await admin.from("natori_consultation_uploads")
    .select("id, storage_path").eq("project_id", actor.project.id)
    .is("finalized_at", null)
    .lt("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .limit(20);
  if (staleError) console.error("[natori-consultation-file] stale upload lookup failed", staleError);
  if (stale?.length) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(stale.map((row) => row.storage_path));
    if (removeError) console.error("[natori-consultation-file] stale upload cleanup failed", removeError);
    else {
      const { error: deleteError } = await admin.from("natori_consultation_uploads").delete().in("id", stale.map((row) => row.id));
      if (deleteError) console.error("[natori-consultation-file] stale reservation cleanup failed", deleteError);
    }
  }
  const { count, error: countError } = await admin.from("natori_consultation_files")
    .select("id", { head: true, count: "exact" }).eq("project_id", actor.project.id);
  if (countError) {
    console.error("[natori-consultation-file] file count failed", countError);
    return { kind: "storage-error" };
  }
  if ((count ?? 0) >= 60) return { kind: "too-many" };
  const { count: recent, error: recentError } = await admin.from("natori_consultation_uploads")
    .select("id", { head: true, count: "exact" })
    .eq("project_id", actor.project.id)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (recentError) {
    console.error("[natori-consultation-file] upload reservation count failed", recentError);
    return { kind: "storage-error" };
  }
  if ((recent ?? 0) >= 10) return { kind: "too-many" };
  const path = `${actor.project.id}/${randomUUID()}.${consultationFileExtension(input.fileName)}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[natori-consultation-file] signed upload failed", error);
    return { kind: "storage-error" };
  }
  const { error: reserveError } = await admin.from("natori_consultation_uploads").insert({
    project_id: actor.project.id, sender: actor.sender, storage_path: path,
    file_name: input.fileName, mime_type: input.mimeType, size_bytes: input.sizeBytes,
  });
  if (reserveError) {
    console.error("[natori-consultation-file] upload reservation failed", reserveError);
    return { kind: "storage-error" };
  }
  return { kind: "ok", path, uploadToken: data.token };
}

export type FinishUploadResult = "ok" | "notification-failed" | "invalid" | "not-found" | "storage-error" | "db-error";

export async function finishConsultationUpload(input: FileInput & { path: string }): Promise<FinishUploadResult> {
  if (!validConsultationFile(input.fileName, input.mimeType, input.sizeBytes) || !PATH_RE.test(input.path)) return "invalid";
  const actor = await findActor(input);
  if (!actor || !input.path.startsWith(`${actor.project.id}/`) || consultationFileExtension(input.path) !== consultationFileExtension(input.fileName)) return "not-found";
  const admin = supabaseAdmin();
  const { data: reservation, error: reservationError } = await admin.from("natori_consultation_uploads")
    .select("id")
    .eq("project_id", actor.project.id).eq("sender", actor.sender)
    .eq("storage_path", input.path).eq("file_name", input.fileName)
    .eq("mime_type", input.mimeType).eq("size_bytes", input.sizeBytes)
    .is("finalized_at", null)
    .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .maybeSingle();
  if (reservationError || !reservation) return "not-found";
  const { data: object, error: infoError } = await admin.storage.from(BUCKET).info(input.path);
  if (infoError || !object || object.size !== input.sizeBytes || object.contentType !== input.mimeType) {
    console.error("[natori-consultation-file] upload verification failed", infoError);
    return "storage-error";
  }
  const { data: messageId, error } = await admin.rpc("natori_finalize_consultation_file", {
    p_project_id: actor.project.id, p_sender: actor.sender, p_storage_path: input.path,
    p_file_name: input.fileName, p_mime_type: input.mimeType, p_size_bytes: input.sizeBytes,
  });
  if (error || !messageId) {
    console.error("[natori-consultation-file] finalize failed", error);
    return "db-error";
  }
  const { error: finalizeError } = await admin.from("natori_consultation_uploads")
    .update({ finalized_at: new Date().toISOString() }).eq("id", reservation.id);
  if (finalizeError) console.error("[natori-consultation-file] reservation finalize failed", finalizeError);

  let sent = false;
  try {
    if (actor.sender === "client") {
      sent = await sendNatoriNoticeMail(
        `【相談資料】${actor.project.client_name} 様 / ${actor.project.title}`.replace(/[\r\n]/g, " ").slice(0, 200),
        `依頼者からファイルが届きました。\n\n${getSiteUrl()}/natori/inquiries?project=${actor.project.id}`
      );
    } else {
      const email = actor.project.client_email ?? extractClientEmailFromNote(actor.project.note);
      const key = process.env.RESEND_API_KEY;
      if (email && key) {
        const token = randomBytes(32).toString("base64url");
        const { error: accessError } = await admin.from("natori_consultation_access").insert({
          project_id: actor.project.id,
          token_hash: createHash("sha256").update(token).digest("hex"),
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
        if (accessError) throw accessError;
        const { error: mailError } = await new Resend(key).emails.send({
          from: process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>",
          to: [email], replyTo: process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com",
          subject: `【ナトリ】相談資料を共有しました：${actor.project.title}`.replace(/[\r\n]/g, " ").slice(0, 200),
          text: `${actor.project.client_name} 様\n\n相談ページにファイルが届きました。こちらから確認できます。\n${getSiteUrl()}/natori/consult/${token}\n\nこのリンクの有効期間は30日です。ご返信は相談ページからお願いします。`,
        });
        if (mailError) throw mailError;
        sent = true;
      }
    }
  } catch (mailError) {
    console.error("[natori-consultation-file] notification failed", mailError);
  }
  const { error: updateError } = await admin.from("natori_consultation_messages")
    .update({ notification_status: sent ? "sent" : "failed" }).eq("id", messageId);
  if (updateError) console.error("[natori-consultation-file] notification status update failed", updateError);
  return sent ? "ok" : "notification-failed";
}
