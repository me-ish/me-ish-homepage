// src/app/api/aura/studio/save/[id]/route.ts
// POST: フォームデータ部分保存
import { NextResponse } from 'next/server';
import { checkCsrf } from '@/lib/auth/csrf';
import { requireStudioAccess } from '@/lib/aura/studio/studioAccess';
import { saveStudioDraft } from '@/lib/aura/studio/studioDb';
import type { StudioFormData } from '@/lib/aura/studio/studioTypes';

export const dynamic = 'force-dynamic';

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

  const projectId = params.id;

  try {
    const access = await requireStudioAccess(projectId, req);
    if (!access.ok) return access.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return err(400, 'invalid_body');

    // 許可フィールドのみ通す
    const allowed: (keyof StudioFormData)[] = [
      'name', 'displayTitle', 'tagline', 'bio', 'avatarPath',
      'works', 'services', 'skills', 'social',
      'themeId', 'accentColor', 'fontPreset',
    ];

    const patch: Partial<StudioFormData> = {};
    for (const key of allowed) {
      if (key in body) {
        (patch as Record<string, unknown>)[key] = body[key];
      }
    }

    await saveStudioDraft(projectId, patch);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    console.error('[studio/save] error', e);
    return err(500, 'internal_error');
  }
}
