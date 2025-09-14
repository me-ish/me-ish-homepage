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
  published_at: z.string().datetime().optional().nullable(), // ← 受け口は null 可
  expires_at: z.string().datetime().optional().nullable(),
});

const toU = <T,>(v: T | null | undefined): T | undefined => (v ?? undefined);

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

  // ★ null を undefined に寄せ、null 不可のフィールドは “キー省略”
  const payload = {
    title: p.title,
    body_md: p.body_md,
    category: p.category,
    pinned: p.pinned,
    link_url: p.link_url ?? null,        // ← ここは null 可
    ...(toU(p.published_at) && { published_at: toU(p.published_at)! }), // ← ここがポイント
    ...(p.expires_at === null
      ? { expires_at: null }             // ← ここは null 可
      : toU(p.expires_at) && { expires_at: toU(p.expires_at)! }),
  } satisfies AnnInsert;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('announcements')
    .insert(payload)        // ← ここで published_at に null が入らない
    .select('*')
    .single();

  if (error) {
    console.error('insert_failed:', error);
    return NextResponse.json({ error: 'insert_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

