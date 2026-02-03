import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { EntryPatch } from '@/lib/schemas/entry';
import type { Database } from '@/types/supabase';

type EntriesUpdate = Database['public']['Tables']['entries']['Update'];

async function requireAdmin() {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email ?? '')) return null;
  return user;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = EntryPatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', details: parsed.error.flatten() }, { status: 400 });
  }

  // edition_sold は DB で NOT NULL なので null の場合はキーごと省く
  const { edition_sold, ...rest } = parsed.data;

  const values: EntriesUpdate = {
    ...rest,
    ...(edition_sold != null ? { edition_sold } : {}), // null/undefined のときは渡さない
  };

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Do not allow display_ready=true for paid plans until payment is completed.
  if (values.display_ready === true) {
    const { data: row, error: selErr } = await admin
      .from('entries')
      .select('id,is_for_sale,display_plan,plan_payment_status')
      .eq('id', id)
      .maybeSingle();

    if (selErr || !row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const paidPlan = row.is_for_sale === true && (row.display_plan ?? 'free') !== 'free';
    const paid = String(row.plan_payment_status ?? '').toLowerCase() === 'paid';
    if (paidPlan && !paid) {
      return NextResponse.json({ error: 'plan_payment_required' }, { status: 409 });
    }
  }

  const { data, error } = await admin
    .from('entries')
    .update(values)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'update_failed', details: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
