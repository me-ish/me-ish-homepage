// src/app/api/aura/upload/avatar/[id]/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { updatePayloadFields } from "@/lib/aura/aura.db";
import { auraAssetProxyUrl } from "@/lib/aura/storage/auraAssets";
import { requireAuraRequestAccess } from "@/lib/aura/requireAuraAccess";
import { checkCsrf } from "@/lib/auth/csrf";
import { AVATAR_MAX_BYTES, ALLOWED_IMAGE_MIMES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const BUCKET = process.env.AURA_ASSETS_BUCKET ?? "aura-assets";

function err(status: number, error: string, message?: string) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}) },
    { status }
  );
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const requestId = params.id;

  try {
    // ✅ 所有権チェック（IDOR遮断）
    const access = await requireAuraRequestAccess(requestId);
    if (!access.ok) return access.response;

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) return err(400, "file_missing");
    if (!ALLOWED_IMAGE_MIMES.has(file.type)) return err(400, "invalid_mime");
    if (file.size > AVATAR_MAX_BYTES) return err(400, "file_too_large");

    const input = Buffer.from(await file.arrayBuffer());

    // ✅ 512x512 に整形（円形表示なので正方形が扱いやすい）
    const webp = await sharp(input)
      .rotate() // EXIF回転を反映（念のため）
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    const supabase = supabaseAdmin();

    // ✅ パス：avatars/{requestId}/avatar.webp（上書き）
    const path = `avatars/${requestId}/avatar.webp`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, webp, {
      contentType: "image/webp",
      upsert: true,
    });

    if (upErr) return err(500, "upload_failed", upErr.message);

    /**
     * ✅ 重要：payload.avatarUrl は Zod の .url() を通る必要がある
     * - proxy は "/api/..." の相対URLを返すので、そのままだと invalid_format(url) になる
     * - ここで req.url の origin を使って絶対URLに変換して保存する
     */
    const proxyPath = auraAssetProxyUrl(path); // "/api/aura/assets?path=..."
    const origin = new URL(req.url).origin; // "http://localhost:3000" 等
    const proxyUrl = new URL(proxyPath, origin).toString(); // 絶対URL化

    // payloadへ反映（avatarUrl / avatarPath を保存）
    await updatePayloadFields(requestId, {
      avatarUrl: proxyUrl,
      avatarPath: path,
    });

    return NextResponse.json({ ok: true, url: proxyUrl, path }, { status: 200 });
  } catch (e: unknown) {
    console.error("[upload/avatar] error", e);
    return err(500, "internal_error");
  }
}
