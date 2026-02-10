import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';
import { AnnouncementUpdate } from '@/lib/schemas/announcement';
import type { Database } from '@/lib/supabase/database.types';

type AnnTable  = Database['public']['Tables']['announcements'];
type AnnRow    = AnnTable['Row'];
type AnnUpdate = AnnTable['Update'];

// http/https 以外は null、未指定は変更なし
function normalizeHttpUrl(u: unknown): string | null | undefined {
  if (u === undefined) return undefined;
  const s = (u ?? null) as string | null;
  if (!s) return null;
  try {
    const url = new URL(s);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function normalizePatch(v: unknown): Partial<AnnUpdate> {
  const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };

  if ('link_url' in out) {
    out.link_url = normalizeHttpUrl(out.link_url);
  }

  // '' → null、無効な日付 → null、未指定 → 変更なし
  const fixTs = (val: unknown) => {
    if (val === undefined) return undefined;
    if (val === null || val === '') return null;
    const s = String(val);
    return isNaN(Date.parse(s)) ? null : s;
  };
  if ('published_at' in out) out.published_at = fixTs(out.published_at);
  if ('expires_at'   in out) out.expires_at   = fixTs(out.expires_at);

  return out as Partial<AnnUpdate>;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = AnnouncementUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const update: Partial<AnnUpdate> = normalizePatch(parsed.data);

  const { data, error } = await admin
    .from('announcements')
    .update(update)
    .eq('id', params.id as AnnRow['id']) // ← 型に揃える（uuid/text想定）
    .select('*')
    .single();

  if (error) {
    console.error('update_failed:', error);
    return NextResponse.json({ error: 'update_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('announcements')
    .delete()
    .eq('id', params.id as AnnRow['id']); // ← 型に揃える

  if (error) {
    console.error('delete_failed:', error);
    return NextResponse.json({ error: 'delete_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
