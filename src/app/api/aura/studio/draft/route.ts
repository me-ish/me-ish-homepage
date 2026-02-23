// src/app/api/aura/studio/draft/route.ts
// POST: 新規ドラフト作成 → session_token cookie をセット
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { checkCsrf } from '@/lib/auth/csrf';
import { createStudioDraft } from '@/lib/aura/studio/studioDb';
import { buildStudioSessionCookie } from '@/lib/aura/studio/studioAccess';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  try {
    const body = await req.json().catch(() => ({}));
    const email: string | undefined =
      typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : undefined;

    const sessionToken = randomUUID();
    const draft = await createStudioDraft(sessionToken, email);

    const cookie = buildStudioSessionCookie(draft.id, sessionToken);

    return NextResponse.json(
      { ok: true, id: draft.id, publicId: draft.public_id },
      {
        status: 201,
        headers: { 'Set-Cookie': cookie },
      }
    );
  } catch (e: unknown) {
    console.error('[studio/draft] error', e);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
