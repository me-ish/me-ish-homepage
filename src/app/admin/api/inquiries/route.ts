// app/admin/api/inquiries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const onlyUnread = (url.searchParams.get('onlyUnread') || 'false') === 'true';
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') || '50')));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = supabaseAdmin();
  let query = admin.from('inquiries').select('*', { count: 'exact' }).order('created_at', { ascending: false });

  if (onlyUnread) query = query.eq('is_read', false);
  if (q) {
    // name/email/message の部分一致
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,message.ilike.%${q}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });

  return NextResponse.json({ items: data ?? [], total: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
}
