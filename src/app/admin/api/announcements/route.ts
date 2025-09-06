// app/admin/api/announcements/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import {
  AnnouncementInsert,
} from '@/lib/schemas/announcement';

export const revalidate = 0;

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
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
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

  const payload = {
    ...parsed.data,
    link_url: normalizeHttpUrl(parsed.data.link_url ?? null),
    // 誤公開防止：nullを尊重（クライアント初期値はnull推奨）
    published_at: parsed.data.published_at ?? null,
  };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('announcements')
    .insert(payload)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json(data);
}
