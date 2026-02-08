//src/app/api/aura/upload/works/[id]/route.ts

import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuraRequestAccess } from "@/lib/aura/requireAuraAccess";
import { checkCsrf } from "@/lib/auth/csrf";
import { WORKS_IMAGE_MAX_BYTES, ALLOWED_IMAGE_MIMES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const BUCKET = process.env.AURA_ASSETS_BUCKET ?? "aura-assets";

function err(status: number, error: string, message?: string) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}) },
    { status },
  );
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
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
    if (file.size > WORKS_IMAGE_MAX_BYTES) return err(400, "file_too_large");

    const input = Buffer.from(await file.arrayBuffer());

    // ✅ 作品は「横長/縦長を維持」したまま、最大幅を抑える（軽量化＆表示安定）
    // - max 1600px で十分綺麗
    // - qualityは85前後
    const webp = await sharp(input)
      .rotate() // EXIF回転を反映
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    // ✅ パス：works/{requestId}/{timestamp}_{rand}.webp
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2);
    const path = `works/${requestId}/${stamp}_${rand}.webp`;

    const supabase = supabaseAdmin();

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, webp, {
        contentType: "image/webp",
        upsert: false,
      });

    if (upErr) return err(500, "upload_failed", upErr.message);

    // ✅ Public bucketの場合：public URLを返す（あなたのUIは imageUrl に使える）
    // ✅ Private bucketの場合：ここは空になるので、後で proxy API に寄せる
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl ?? "";

    return NextResponse.json(
      { ok: true, url: publicUrl, path },
      { status: 200 },
    );
  } catch (e: unknown) {
    console.error("[upload/works] error", e);
    return err(500, "internal_error");
  }
}
