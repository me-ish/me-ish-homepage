// src/app/api/aura/studio/upload/avatar/[id]/route.ts
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkCsrf } from '@/lib/auth/csrf';
import { requireStudioAccess } from '@/lib/aura/studio/studioAccess';
import { updateStudioAvatarPath } from '@/lib/aura/studio/studioDb';
import { auraAssetProxyUrl } from '@/lib/aura/storage/auraAssets';
import { AVATAR_MAX_BYTES, ALLOWED_IMAGE_MIMES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const BUCKET = process.env.AURA_ASSETS_BUCKET ?? 'aura-assets';

function err(status: number, error: string, message?: string) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}) },
    { status }
  );
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const projectId = params.id;

  try {
    const access = await requireStudioAccess(projectId, req);
    if (!access.ok) return access.response;

    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) return err(400, 'file_missing');
    if (!ALLOWED_IMAGE_MIMES.has(file.type)) return err(400, 'invalid_mime');
    if (file.size > AVATAR_MAX_BYTES) return err(400, 'file_too_large');

    const input = Buffer.from(await file.arrayBuffer());

    const webp = await sharp(input)
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const supabase = supabaseAdmin();
    const path = `studio/avatars/${projectId}/avatar.webp`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, webp, {
      contentType: 'image/webp',
      upsert: true,
    });

    if (upErr) return err(500, 'upload_failed', upErr.message);

    await updateStudioAvatarPath(projectId, path);

    const proxyUrl = auraAssetProxyUrl(path);

    return NextResponse.json({ ok: true, url: proxyUrl, path }, { status: 200 });
  } catch (e: unknown) {
    console.error('[studio/upload/avatar] error', e);
    return err(500, 'internal_error');
  }
}
