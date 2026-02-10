// app/admin/api/inquiries/mark-all-read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { error } = await admin.from('inquiries').update({ is_read: true }).eq('is_read', false);
  if (error) return NextResponse.json({ error: 'bulk_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
