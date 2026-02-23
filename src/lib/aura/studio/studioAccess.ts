// src/lib/aura/studio/studioAccess.ts
// 既存の requireAuraRequestAccess パターンを aura_projects 用に再実装
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type StudioAccessResult =
  | { ok: true; rec: Record<string, unknown> }
  | { ok: false; response: NextResponse };

export function studioSessionCookieName(projectId: string): string {
  return `studio_st_${projectId}`;
}

export function buildStudioSessionCookie(
  projectId: string,
  sessionToken: string
): string {
  const name = studioSessionCookieName(projectId);
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  const v = encodeURIComponent(sessionToken);
  return `${name}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

function readCookieFromHeader(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(';').map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf('=');
    if (i <= 0) continue;
    const k = p.slice(0, i);
    if (k === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}

export async function requireStudioAccess(
  projectId: string,
  req?: Request
): Promise<StudioAccessResult> {
  const cookieName = studioSessionCookieName(projectId);

  let sessionToken: string | null = null;

  if (req) {
    const cookieHeader = req.headers.get('cookie') ?? '';
    sessionToken = readCookieFromHeader(cookieHeader, cookieName);
  } else {
    const cookieStore = cookies();
    sessionToken = cookieStore.get(cookieName)?.value ?? null;
    sessionToken = sessionToken ? decodeURIComponent(sessionToken) : null;
  }

  if (!sessionToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'unauthorized',
          message: isProduction
            ? 'session token required'
            : `session token required (cookie: ${cookieName})`,
        },
        { status: 401 }
      ),
    };
  }

  // aura_projects は Database 生成型に未登録のため untyped client 経由でアクセス
  // rome-ignore / biome-ignore 等もないプロジェクトなので as any で回避
  const admin = supabaseAdmin() as any; // eslint-disable-line
  const { data: rec, error } = (await admin
    .from('aura_projects')
    .select('id, status, email, theme_id, visibility, public_id, payment_status, session_token')
    .eq('id', projectId)
    .eq('session_token', sessionToken)
    .maybeSingle()) as { data: Record<string, unknown> | null; error: unknown };

  if (error || !rec) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'forbidden', message: 'invalid or expired session token' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, rec };
}
