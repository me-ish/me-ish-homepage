// src/app/api/aura/studio/publish/[id]/route.ts
// POST: ドラフトを公開
import { NextResponse } from 'next/server';
import { checkCsrf } from '@/lib/auth/csrf';
import { requireStudioAccess } from '@/lib/aura/studio/studioAccess';
import { publishStudioProject } from '@/lib/aura/studio/studioDb';

export const dynamic = 'force-dynamic';

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

    const result = await publishStudioProject(projectId);

    return NextResponse.json(
      { ok: true, publicId: result.public_id },
      { status: 200 }
    );
  } catch (e: unknown) {
    console.error('[studio/publish] error', e);
    return err(500, 'internal_error');
  }
}
