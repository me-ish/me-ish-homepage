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
  published_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
});

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

  // ⚠️ “null を入れてから消す”のではなく、“最初から入れない”
  const payload = {
    title: p.title,
    body_md: p.body_md,
    category: p.category,
    pinned: p.pinned,
    link_url: p.link_url ?? null, // ← ここは null 許可
    ...(p.published_at ? { published_at: p.published_at } : {}), // ← null/undefined なら付けない
    ...(p.expires_at === null
      ? { expires_at: null } // ← スキーマが null 許可なら残す
      : p.expires_at
      ? { expires_at: p.expires_at }
      : {}),
  } satisfies AnnInsert;

  const admin = supabaseAdmin();
// 直前で payload を null-safe にしてから insert する
const { data, error } = await admin
  .from('announcements')
  .insert((() => {
    // ← ここは "payload" に合わせてください（finalPayload ではない）
    const v: any = { ...payload };

    // published_at が null/undefined ならキー自体を削除（これで Insert型と一致）
    if (v.published_at == null) delete v.published_at;

    // expires_at はスキーマによっては null 可なので、ここは削除しない
    // （もし null 不可なら: if (v.expires_at == null) delete v.expires_at; を追加）

    return v as AnnInsert;
  })())
  .select('*')
  .single();


  if (error) {
    console.error('insert_failed:', error);
    return NextResponse.json({ error: 'insert_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
