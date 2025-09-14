// src/app/admin/api/announcements/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import type { Database } from '@/types/supabase';

type AnnTable  = Database['public']['Tables']['announcements'];
type AnnInsert = AnnTable['Insert'];

const Body = z.object({
  title: z.string().min(1),
  body_md: z.string().min(1),
  category: z.enum(['info', 'update', 'maintenance']),
  pinned: z.boolean().default(false),
  link_url: z.string().url().optional().nullable(),
  // ← クライアントからは null が来てもOKにして受ける
  published_at: z.string().datetime().optional().nullable(),
  // 任意: 期限を使うなら
  expires_at: z.string().datetime().optional().nullable(),
});

function toU<T>(v: T | null | undefined): T | undefined {
  return v ?? undefined;
}

async function requireAdmin() {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email ?? '')) return null;
  return user;
}

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await req.json();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', details: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;

  // ★ ここがポイント：null を undefined に寄せる
  const payload: AnnInsert = {
    title: p.title,
    body_md: p.body_md,
    category: p.category,
    pinned: p.pinned,
    link_url: toU(p.link_url),
    published_at: toU(p.published_at),
    expires_at: toU(p.expires_at),
    // created_by など入れるならここで
  };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('announcements')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('insert_failed:', error);
    return NextResponse.json({ error: 'insert_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
