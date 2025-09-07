// app/admin/api/entries/[id]/reject/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { EntryReject } from '@/lib/schemas/entry';

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = EntryReject.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { reason = null } = parsed.data;

  const id = Number(params.id);
  const admin = supabaseAdmin();

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from('entries')
    .update({ confirmed: false, rejected_at: now, reject_reason: reason })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'reject_failed' }, { status: 500 });

  try {
    // await sendRejectMail(updated.email, updated.artist_name, reason);
    await admin.from('entries').update({ reject_email_sent_at: new Date().toISOString() }).eq('id', id);
  } catch { /* noop */ }

  return NextResponse.json(updated);
}
