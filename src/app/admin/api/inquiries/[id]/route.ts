// app/admin/api/inquiries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';

const Body = z.object({ is_read: z.boolean() });

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

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
