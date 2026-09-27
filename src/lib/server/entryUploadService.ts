import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sniffImageFormat } from "@/lib/imageSniff";
import {
  ENTRY_UPLOAD_BUCKET,
  entryUploadInput,
  type EntryUploadInput,
} from "@/lib/entryUpload";
import {
  issueEntryUploadGrant,
  verifyEntryUploadGrant,
  type EntryUploadGrant,
} from "./entryUploadGrant";

type Failure = { kind: "invalid" | "storage-error" };
type Published = { kind: "ok"; fileName: string; publicUrl: string };

function signingKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("ENTRY_UPLOAD_SIGNING_KEY_MISSING");
  return key;
}
function matches(bytes: Buffer, grant: EntryUploadGrant): boolean {
  return (
    bytes.length === grant.sizeBytes &&
    createHash("sha256").update(bytes).digest("hex") === grant.sha256
  );
}
function missingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    message?: string;
    code?: string;
    statusCode?: string | number;
  };
  if (/bucket/i.test(e.message ?? "")) return false;
  return (
    e.code === "NoSuchKey" ||
    (String(e.statusCode) === "404" && /not found/i.test(e.message ?? ""))
  );
}
function published(grant: EntryUploadGrant): Published {
  const { data } = supabaseAdmin()
    .storage.from("artworks")
    .getPublicUrl(grant.fileName);
  return { kind: "ok", fileName: grant.fileName, publicUrl: data.publicUrl };
}
async function readPublished(
  grant: EntryUploadGrant,
): Promise<Published | Failure | { kind: "missing" }> {
  const bucket = supabaseAdmin().storage.from("artworks");
  const info = await bucket.info(grant.fileName);
  if (info.error)
    return { kind: missingObject(info.error) ? "missing" : "storage-error" };
  if (
    !info.data ||
    info.data.size !== grant.sizeBytes ||
    info.data.contentType !== grant.mimeType
  )
    return { kind: "invalid" };
  const result = await bucket.download(grant.fileName);
  if (result.error || !result.data) return { kind: "storage-error" };
  return matches(Buffer.from(await result.data.arrayBuffer()), grant)
    ? published(grant)
    : { kind: "invalid" };
}
async function cleanup(grant: EntryUploadGrant) {
  // Only this signed reservation; never enumerate or remove artwork objects.
  try {
    const { error } = await supabaseAdmin()
      .storage.from(ENTRY_UPLOAD_BUCKET)
      .remove([`pending/${grant.fileName}`]);
    if (error) console.error("[entry-upload] staging cleanup failed");
  } catch {
    console.error("[entry-upload] staging cleanup failed");
  }
}

export async function signEntryUpload(input: EntryUploadInput): Promise<
  | Failure
  | {
      kind: "ok";
      bucket: string;
      path: string;
      uploadToken: string;
      receipt: string;
    }
> {
  if (!entryUploadInput.safeParse(input).success) return { kind: "invalid" };
  const { grant, receipt } = issueEntryUploadGrant(input, signingKey());
  const path = `pending/${grant.fileName}`;
  const result = await supabaseAdmin()
    .storage.from(ENTRY_UPLOAD_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (result.error || !result.data) {
    console.error("[entry-upload] signing failed");
    return { kind: "storage-error" };
  }
  return {
    kind: "ok",
    bucket: ENTRY_UPLOAD_BUCKET,
    path,
    uploadToken: result.data.token,
    receipt,
  };
}

export async function finishEntryUpload(
  receipt: string,
): Promise<Published | Failure> {
  const grant = verifyEntryUploadGrant(receipt, signingKey());
  if (!grant) return { kind: "invalid" };
  const existing = await readPublished(grant);
  if (existing.kind !== "missing") {
    if (existing.kind === "ok") await cleanup(grant);
    return existing;
  }
  const bucket = supabaseAdmin().storage.from(ENTRY_UPLOAD_BUCKET);
  const path = `pending/${grant.fileName}`;
  const info = await bucket.info(path);
  if (info.error || !info.data) {
    const replay = await readPublished(grant);
    return replay.kind === "ok" ? replay : { kind: "storage-error" };
  }
  if (
    info.data.size !== grant.sizeBytes ||
    info.data.contentType !== grant.mimeType
  )
    return { kind: "invalid" };
  const downloaded = await bucket.download(path);
  if (downloaded.error || !downloaded.data) {
    const replay = await readPublished(grant);
    return replay.kind === "ok" ? replay : { kind: "storage-error" };
  }
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (!matches(bytes, grant)) return { kind: "invalid" };
  const format = sniffImageFormat(bytes);
  if ((grant.mimeType === "image/png" ? "png" : "jpeg") !== format)
    return { kind: "invalid" };
  try {
    const image = sharp(bytes, {
      limitInputPixels: 3000 * 3000,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (
      !meta.width ||
      !meta.height ||
      Math.max(meta.width, meta.height) > 3000 ||
      Math.min(meta.width, meta.height) < 960 ||
      (meta.pages ?? 1) !== 1
    )
      return { kind: "invalid" };
    await image.stats(); // Decode the whole image; a plausible header alone is insufficient.
  } catch {
    return { kind: "invalid" };
  }
  const stored = await supabaseAdmin()
    .storage.from("artworks")
    .upload(grant.fileName, bytes, {
      contentType: grant.mimeType,
      upsert: false,
    });
  if (stored.error) {
    // Concurrent finish or lost response: replay only the exact same image.
    const replay = await readPublished(grant);
    if (replay.kind !== "ok") return { kind: "storage-error" };
  }
  const verified = await readPublished(grant);
  if (verified.kind !== "ok") return { kind: "storage-error" };
  await cleanup(grant); // Notification/cleanup failure cannot undo the committed file.
  return verified;
}
