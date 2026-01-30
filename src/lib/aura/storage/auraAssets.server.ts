// src/lib/aura/storage/auraAssets.server.ts
import "server-only";

import { supabaseAdmin } from "@/lib/aura/supabaseAdmin";

const BUCKET = process.env.AURA_ASSETS_BUCKET ?? "aura-assets";

function parseDataUrl(dataUrl: string): {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
} {
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!m) throw new Error("invalid_data_url");

  const contentType = m[1];
  const b64 = m[2];

  const bin = Buffer.from(b64, "base64");
  const bytes = new Uint8Array(bin);

  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : contentType === "image/jpeg"
          ? "jpg"
          : "png";

  return { bytes, contentType, ext };
}

export async function uploadDataUrlToAuraAssets(params: {
  pathWithoutExt: string; // e.g. avatars/{requestId}
  dataUrl: string;
  upsert?: boolean;
}): Promise<{ path: string }> {
  const { pathWithoutExt, dataUrl, upsert = true } = params;

  const { bytes, contentType, ext } = parseDataUrl(dataUrl);
  const path = `${String(pathWithoutExt).replace(/^\/+/, "")}.${ext}`;

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert,
    // cacheControl を付けたいならここ（任意）
    // cacheControl: "3600",
  });

  if (error) throw new Error(`storage_upload_failed:${error.message}`);
  return { path };
}
