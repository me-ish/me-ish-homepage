import { CSRF_HEADERS } from "@/lib/auth/csrf";
import {
  ENTRY_UPLOAD_BUCKET,
  ENTRY_IMAGE_MAX_BYTES,
  entryUploadInput,
} from "@/lib/entryUpload";
import { supabase } from "@/lib/supabaseClient";

async function post(body: object): Promise<Record<string, unknown>> {
  const response = await fetch("/api/entry/upload", {
    method: "POST",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok || !data)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "画像を保存できませんでした",
    );
  return data;
}

export async function uploadEntryImage(
  file: File,
): Promise<{ fileName: string; publicUrl: string }> {
  if (
    file.size <= 0 ||
    file.size > ENTRY_IMAGE_MAX_BYTES ||
    !["image/png", "image/jpeg"].includes(file.type)
  ) {
    throw new Error("PNG/JPEG形式で10MB以内の画像を選んでください");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const sha256 = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  const parsed = entryUploadInput.safeParse({
    mimeType: file.type,
    sizeBytes: file.size,
    sha256,
  });
  if (!parsed.success)
    throw new Error("PNG/JPEG形式で10MB以内の画像を選んでください");
  const signed = await post({ action: "sign", ...parsed.data });
  if (
    signed.bucket !== ENTRY_UPLOAD_BUCKET ||
    typeof signed.path !== "string" ||
    typeof signed.uploadToken !== "string" ||
    typeof signed.receipt !== "string"
  )
    throw new Error("画像の送信先を確認できませんでした");
  const uploaded = await supabase.storage
    .from(ENTRY_UPLOAD_BUCKET)
    .uploadToSignedUrl(signed.path, signed.uploadToken, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploaded.error)
    throw new Error("画像のアップロードに失敗しました。再度お試しください");
  const finished = await post({ action: "finish", receipt: signed.receipt });
  if (
    typeof finished.fileName !== "string" ||
    typeof finished.publicUrl !== "string"
  )
    throw new Error("画像の保存を確認できませんでした");
  return { fileName: finished.fileName, publicUrl: finished.publicUrl };
}
