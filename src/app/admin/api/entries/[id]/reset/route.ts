// app/admin/api/entries/[id]/reset/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EntryReset } from '@/lib/schemas/entry';
import crypto from 'crypto';

function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return { ok: false as const, status: 500, error: 'missing_ADMIN_API_TOKEN' };

  const header =
    req.headers.get('x-meish-admin-token') ??
    (req.headers.get('authorization')?.startsWith('Bearer ')
      ? req.headers.get('authorization')!.slice('Bearer '.length)
      : null);

  if (!header) return { ok: false as const, status: 401, error: 'missing_admin_token' };

  const a = Buffer.from(String(header));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return { ok: false as const, status: 403, error: 'invalid_admin_token' };
  const ok = crypto.timingSafeEqual(a, b);
  if (!ok) return { ok: false as const, status: 403, error: 'invalid_admin_token' };

  return { ok: true as const };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const adminAuth = requireAdmin(req);
  if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
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
