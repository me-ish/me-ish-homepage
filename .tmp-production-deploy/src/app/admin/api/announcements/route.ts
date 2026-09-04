import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';
import { AnnouncementInsert } from '@/lib/schemas/announcement';
import type { Database } from '@/lib/supabase/database.types';

export const revalidate = 0;

type AnnTable  = Database['public']['Tables']['announcements'];
type AnnInsert = AnnTable['Insert'];

// http/https 以外は null、空や不正も null
function normalizeHttpUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const json = await req.json();
  const parsed = AnnouncementInsert.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', details: parsed.error.flatten() }, { status: 400 });
  }

  // ★ published_at をスプレッドに含めず、値がある時だけ追加する
  const { published_at, expires_at, link_url, ...rest } = parsed.data;

  const values = {
    ...rest,
    ...(link_url !== undefined ? { link_url: normalizeHttpUrl(link_url) } : {}),
    ...(published_at != null ? { published_at } : {}), // ← null/undefined ならキー付与しない
    ...(expires_at === null
      ? { expires_at: null }
      : expires_at
      ? { expires_at }
      : {}),
  } satisfies AnnInsert;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('announcements')
    .insert(values)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'create_failed', details: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
