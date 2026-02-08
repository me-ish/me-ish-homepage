import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { checkFloatGuaranteeCapacity, getGuaranteeTotalForPlan } from '@/lib/guarantee/capacity';
import { getSiteUrl } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLAN_PRICES: Record<string, number> = {
  mini: 400,
  light: 800,
  standard: 1200,
  premium: 2400,
};

const PLAN_LABELS: Record<string, string> = {
  mini: 'Mini',
  light: 'Light',
  standard: 'Standard',
  premium: 'Premium',
};

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email ?? '')) return null;
  return user;
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: entry, error } = await admin
    .from('entries')
    .select('id,title,email,is_for_sale,display_plan,plan_payment_status,plan_payment_amount_yen,gallery_type')
    .eq('id', id)
    .maybeSingle();

  if (error || !entry) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const plan = String(entry.display_plan ?? 'free');
  const isPaidPlan = entry.is_for_sale === true && plan !== 'free';
  if (!isPaidPlan) {
    return NextResponse.json({ error: 'plan_not_chargeable' }, { status: 400 });
  }

  if (String(entry.plan_payment_status ?? '').toLowerCase() === 'paid') {
    return NextResponse.json({ ok: true, alreadyPaid: true }, { status: 200 });
  }

  const galleryType = String(entry.gallery_type ?? '').toLowerCase();
  if (galleryType === 'float') {
    const additional = getGuaranteeTotalForPlan(plan);
    if (additional > 0) {
      const capacity = await checkFloatGuaranteeCapacity(additional);
      if (!capacity.ok) {
        return NextResponse.json(
          {
            error: 'capacity_full',
            capacity: capacity.capacity,
            used: capacity.used,
            remaining: capacity.remaining,
            windowStart: capacity.windowStart,
            windowEnd: capacity.windowEnd,
          },
          { status: 409 }
        );
      }
    }
  }

  const amountYen = Number(entry.plan_payment_amount_yen ?? PLAN_PRICES[plan] ?? 0);
  if (!Number.isFinite(amountYen) || amountYen <= 0) {
    return NextResponse.json({ error: 'invalid_plan_amount' }, { status: 400 });
  }

  const planLabel = PLAN_LABELS[plan] ?? plan;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `me-ish Display Plan (${planLabel})`,
            description: entry.title ?? undefined,
          },
          unit_amount: amountYen,
        },
        quantity: 1,
      },
    ],
    customer_email: entry.email ?? undefined,
    success_url: `${getSiteUrl()}/mypage?planPaid=1`,
    cancel_url: `${getSiteUrl()}/mypage?planCanceled=1`,
    client_reference_id: String(entry.id),
    metadata: {
      kind: 'entry_plan',
      entryId: String(entry.id),
      displayPlan: plan,
      planAmountYen: String(amountYen),
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'session_url_missing' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from('entries')
    .update({
      plan_payment_status: 'pending',
      plan_payment_amount_yen: amountYen,
      plan_payment_session_id: session.id,
      plan_payment_checkout_created_at: now,
    })
    .eq('id', entry.id);

  if (updErr) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: session.url, sessionId: session.id });
}
