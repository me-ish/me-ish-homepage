// app/admin/api/entries/[id]/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EntryReset } from '@/lib/schemas/entry';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;
  const _ = await req.json().catch(() => ({}));
  if (!EntryReset.safeParse(_).success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const id = Number(params.id);
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('entries')
    .update({ confirmed: null, confirmed_at: null, rejected_at: null, reject_reason: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'reset_failed' }, { status: 500 });
  return NextResponse.json({
    ok: true,
    entry: {
      id: data.id,
      confirmed: data.confirmed,
      confirmed_at: data.confirmed_at,
      rejected_at: data.rejected_at,
      reject_reason: data.reject_reason,
    },
  });
}
