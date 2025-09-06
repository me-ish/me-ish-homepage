// app/admin/api/users/[artist_name]/entries/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';

export const revalidate = 0;

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function GET(
  _req: Request,
  { params }: { params: { artist_name: string } }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    .select('id,title,sale_type,price,confirmed,created_at')
    .eq('artist_name', artistName)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });

  // confirmed は null の可能性があるため boolean | null を維持
  return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
