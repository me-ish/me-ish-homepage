// app/admin/api/inquiries/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';

const Body = z.object({ is_read: z.boolean() });

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('inquiries')
    .update({ is_read: parsed.data.is_read })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json(data);
}
