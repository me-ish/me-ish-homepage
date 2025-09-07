// app/admin/api/entries/[id]/reset/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { EntryReset } from '@/lib/schemas/entry';

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
  return NextResponse.json(data);
}
