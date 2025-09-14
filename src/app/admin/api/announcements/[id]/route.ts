// src/app/admin/api/announcements/[id]/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { AnnouncementUpdate } from '@/lib/schemas/announcement';
import type { Database } from '@/types/supabase';

type AnnTable  = Database['public']['Tables']['announcements'];
type AnnRow    = AnnTable['Row'];
type AnnUpdate = AnnTable['Update'];

/** 値の正規化（undefined は “変更しない”、null は “null を入れる”） */
function normalizePatch(v: unknown): Partial<AnnUpdate> {
  const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };

  // link_url: 文字列なら http/https のみ許可。空/不正は null。プロパティ未指定は変更なし。
  if ('link_url' in out) {
    const u = (out.link_url as string | null | undefined) ?? null;
    try {
      if (!u) out.link_url = null;
      else {
        const url = new URL(u);
        out.link_url = /^https?:$/.test(url.protocol) ? url.toString() : null;
      }
    } catch {
      out.link_url = null;
    }
  }

  // published_at / expires_at: '' は null、ISO文字列以外は null。未指定は変更なし。
  const fixTs = (val: unknown) => {
    if (val === undefined) return undefined;     // → 変更しない
    if (val === null || val === '') return null; // → 明示的に null へ
    const s = String(val);
    // ゆるく ISO っぽい文字列を許可（DB 側は text/timestamptz 想定）
    return isNaN(Date.parse(s)) ? null : s;
  };
  if ('published_at' in out) out.published_at = fixTs(out.published_at);
  if ('expires_at'   in out) out.expires_at   = fixTs(out.expires_at);

  return out as Partial<AnnUpdate>;
}

async function requireAdmin() {
  const supabase = createRouteHandlerClient<Database>({ cookies }); // ★ 型付け
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email ?? '')) return null;
  return user;
}

// id が数値/文字列どちらでも使えるように
function coerceId(id: string) {
  const n = Number(id);
  return Number.isFinite(n) && String(n) === id ? n : id;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    .eq('id', params.id as AnnRow['id']) // ★ 数値/文字列両対応
    .select('*')
    .single();

  if (error) {
    console.error('update_failed:', error);
    return NextResponse.json({ error: 'update_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('announcements')
    .delete()
    .eq('id', params.id as AnnRow['id']); // ★ 数値/文字列両対応

  if (error) {
    console.error('delete_failed:', error);
    return NextResponse.json({ error: 'delete_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
