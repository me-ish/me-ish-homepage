// app/admin/api/entries/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { EntryListQuery } from '@/lib/schemas/entry';

export const revalidate = 0;

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const qp = Object.fromEntries(url.searchParams.entries());
  const parsed = EntryListQuery.safeParse(qp);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { gallery, status, sortKey, sortOrder, keyword } = parsed.data;

  const admin = supabaseAdmin();
  let q = admin.from('entries').select('*').order(sortKey, { ascending: sortOrder === 'asc' });

  if (gallery !== 'all') q = q.eq('gallery_type', gallery);
  if (status === 'unreviewed') q = q.is('confirmed', null);
  else if (status === 'approved') q = q.eq('confirmed', true);
  else if (status === 'rejected') q = q.eq('confirmed', false);

  if (keyword && keyword.trim()) {
    const kw = keyword.trim();
    q = q.or(`title.ilike.%${kw}%,artist_name.ilike.%${kw}%`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });

  // processed 判定（/final 配下にファイルがあるか）※大きい場合は要ページング
  const { data: finalList, error: listErr } = await admin.storage.from('artworks').list('final', { limit: 1000 });
  if (listErr) return NextResponse.json({ error: 'storage_list_failed' }, { status: 500 });
  const finalNames = new Set((finalList ?? []).map((f) => f.name));

  const rows = (data ?? []).map((e: any) => ({ ...e, processed: finalNames.has(e.file_name) }));
  return NextResponse.json(rows);
}
