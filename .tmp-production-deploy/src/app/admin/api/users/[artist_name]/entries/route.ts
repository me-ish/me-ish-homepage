// app/admin/api/users/[artist_name]/entries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';

export const revalidate = 0;

export async function GET(req: NextRequest, props: { params: Promise<{ artist_name: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const artistName = decodeURIComponent(
    Array.isArray(params?.artist_name)
      ? params.artist_name.join('/')
      : params?.artist_name ?? ''
  );

  if (!artistName) {
    return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('entries')
    .select('id,title,price,confirmed,created_at')
    .eq('artist_name', artistName)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });

  // confirmed は null の可能性があるため boolean | null を維持
  return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
