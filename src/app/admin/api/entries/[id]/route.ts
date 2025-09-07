// app/admin/api/entries/[id]/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { EntryPatch } from '@/lib/schemas/entry';

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = EntryPatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', details: parsed.error.flatten() }, { status: 400 });
  }

  // 触って良いフィールドのみに限定される（zodで担保）
  const admin = supabaseAdmin();
  const { data, error } = await admin.from('entries').update(parsed.data).eq('id', Number(params.id)).select('*').single();
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json(data);
}
