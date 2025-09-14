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

function normalizePatch(v: any) {
  const out: Record<string, any> = { ...v };
  if ('link_url' in out) {
    const u = out.link_url ?? null;
    try {
      if (!u) out.link_url = null;
      else {
        const url = new URL(u);
        out.link_url = /^https?:$/.test(url.protocol) ? url.toString() : null;
      }
    } catch { out.link_url = null; }
  }
  return out;
}

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = AnnouncementUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const update: AnnUpdate = normalizePatch(parsed.data) as AnnUpdate;

  const { data, error } = await admin
    .from('announcements')
    .update(update)
    .eq('id', params.id) // number列なら Number(params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const admin = supabaseAdmin();
  const { error } = await admin.from('announcements').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
