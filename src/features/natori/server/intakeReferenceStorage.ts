import "server-only";
import { timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sniffImageFormat } from "@/lib/imageSniff";

export async function prepareIntakeReferenceImage(file: File): Promise<{ kind: "ok"; webp: Buffer } | { kind: "invalid" }> {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size < 1 || file.size > 4 * 1024 * 1024) return { kind: "invalid" };
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const format = sniffImageFormat(input);
    const expected: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp", "image/gif": "gif" };
    if (!format || format !== expected[file.type]) return { kind: "invalid" };
    const webp = await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    return { kind: "ok", webp };
  } catch { return { kind: "invalid" }; }
}

export async function uploadIntakeReferenceImage(path: string, webp: Buffer): Promise<{ kind: "ok" | "unknown" | "mismatch" }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/u.test(path)) return { kind: "unknown" };
  try {
    const storage = supabaseAdmin().storage.from("natori-inquiry-refs");
    const uploaded = await storage.upload(path, webp, { contentType: "image/webp", upsert: false });
    if (!uploaded.error) return { kind: "ok" };
    // Conflict, network response loss or previous partial upload: compare exact bytes, never overwrite/delete.
    const existing = await storage.download(path);
    if (existing.error || !existing.data) return { kind: "unknown" };
    const bytes = Buffer.from(await existing.data.arrayBuffer());
    return { kind: bytes.length === webp.length && timingSafeEqual(bytes, webp) ? "ok" : "mismatch" };
  } catch { console.error("[natori-intake] reference_upload_unconfirmed"); return { kind: "unknown" }; }
}
