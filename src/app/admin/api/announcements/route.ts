import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { AnnouncementInsert } from '@/lib/schemas/announcement';
import type { Database } from '@/types/supabase';

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

async function requireAdmin() {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email ?? '')) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
