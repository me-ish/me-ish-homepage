// src/app/api/cron/float-daily-slots/route.ts
// 日替わり展示スロットを確定し、保証回数を消化するCron API

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FLOAT_DAILY_SLOT_COUNT, getTodayDateString } from '@/lib/gallery/floatDailyPicker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const token = req.headers.get('x-meish-admin-token');
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (adminToken && token === adminToken) return true;

  return false;
}

function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const random = mulberry32(seed);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  n.setMonth(n.getMonth() + months);
  return n;
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const today = getTodayDateString(); // JST 기준の日付
  const now = new Date();

  const { data: existing } = await admin
    .from('entry_daily_slots')
    .select('id', { count: 'exact', head: true })
    .eq('display_date', today);

  if ((existing as any)?.length || (existing as any)?.count) {
    return NextResponse.json({ ok: true, date: today, skipped: true });
  }

  const { data: entries, error: fetchError } = await admin
    .from('entries')
    .select(
      [
        'id',
        'display_ready',
        'gallery_type',
        'display_end_at',
        'display_start_at',
        'display_plan',
        'plan_payment_status',
        'guarantee_total',
        'guarantee_remaining',
        'guarantee_period_start',
        'guarantee_period_end',
        'guarantee_extended_count',
      ].join(',')
    )
    .eq('display_ready', true)
    .eq('gallery_type', 'float');

  if (fetchError) {
    console.error('[float-daily-slots] fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  const rows = entries ?? [];
  const updates: { id: number; display_end_at?: string | null; guarantee_period_end?: string | null; guarantee_extended_count?: number | null; guarantee_period_start?: string | null; guarantee_total?: number | null; guarantee_remaining?: number | null }[] = [];

  const guaranteeMap: Record<string, number> = {
    mini: 4,
    light: 9,
    standard: 14,
    premium: 30,
    free: 0,
  };

  for (const e of rows as any[]) {
    const plan = String(e.display_plan ?? 'free').toLowerCase();
    const total = e.guarantee_total ?? guaranteeMap[plan] ?? 0;
    const remaining = e.guarantee_remaining ?? total ?? 0;
    const start = e.guarantee_period_start ?? e.display_start_at ?? null;
    let periodEnd = e.guarantee_period_end ?? e.display_end_at ?? null;
    let extendedCount = e.guarantee_extended_count ?? 0;
    let needsInit = false;

    if (total > 0 && start && !periodEnd) {
      periodEnd = addMonths(new Date(start), 1).toISOString();
      needsInit = true;
    }

    if (total > 0 && (e.guarantee_total == null || e.guarantee_remaining == null)) {
      needsInit = true;
    }

    if (remaining > 0 && periodEnd) {
      let endDate = new Date(periodEnd);
      while (endDate.getTime() < now.getTime()) {
        endDate = addMonths(endDate, 1);
        extendedCount += 1;
      }
      const newEnd = endDate.toISOString();
      if (newEnd !== periodEnd || needsInit) {
        const displayEndUpdate = !e.display_end_at || e.display_end_at !== newEnd ? newEnd : undefined;
        updates.push({
          id: e.id,
          ...(displayEndUpdate ? { display_end_at: displayEndUpdate } : {}),
          guarantee_period_end: newEnd,
          guarantee_extended_count: extendedCount,
          guarantee_period_start: start,
          guarantee_total: total,
          guarantee_remaining: remaining,
        });
        periodEnd = newEnd;
      }
    } else if (needsInit) {
      const displayEndUpdate = !e.display_end_at && periodEnd ? periodEnd : undefined;
      updates.push({
        id: e.id,
        ...(displayEndUpdate ? { display_end_at: displayEndUpdate } : {}),
        guarantee_period_start: start,
        guarantee_period_end: periodEnd,
        guarantee_total: total,
        guarantee_remaining: remaining,
        guarantee_extended_count: extendedCount,
      });
    }
  }

  for (const u of updates) {
    const { error } = await admin.from('entries').update(u).eq('id', u.id);
    if (error) {
      console.error('[float-daily-slots] update error:', u.id, error.message);
    }
  }

  const displayable = (rows as any[]).filter((e) => {
    if (!e.display_ready) return false;
    if (!e.display_end_at) return true;
    return new Date(e.display_end_at).getTime() > now.getTime();
  });

  const guaranteed = displayable.filter((e) => {
    const remaining = e.guarantee_remaining ?? 0;
    if (remaining <= 0) return false;
    if (!e.guarantee_period_end) return false;
    return new Date(e.guarantee_period_end).getTime() > now.getTime();
  });

  const guaranteedIds = new Set(guaranteed.map((e) => e.id));
  const normal = displayable.filter((e) => !guaranteedIds.has(e.id));

  const seedBase = dateToSeed(today);
  const guaranteedPicked = seededShuffle(guaranteed, seedBase + 11).slice(0, FLOAT_DAILY_SLOT_COUNT);
  const remainingSlots = Math.max(0, FLOAT_DAILY_SLOT_COUNT - guaranteedPicked.length);
  const normalPicked = seededShuffle(normal, seedBase + 29).slice(0, remainingSlots);

  const slotEntries = [...guaranteedPicked, ...normalPicked];

  if (slotEntries.length === 0) {
    return NextResponse.json({ ok: true, date: today, inserted: 0, message: 'No entries to slot' });
  }

  const rowsToInsert = slotEntries.map((e, idx) => ({
    display_date: today,
    slot_index: idx,
    entry_id: e.id,
  }));

  const { error: insertErr } = await admin.from('entry_daily_slots').insert(rowsToInsert);
  if (insertErr) {
    console.error('[float-daily-slots] insert error:', insertErr);
    return NextResponse.json({ error: 'Failed to insert slots' }, { status: 500 });
  }

  for (const e of guaranteedPicked) {
    const remaining = e.guarantee_remaining ?? 0;
    if (remaining <= 0) continue;
    const { error } = await admin
      .from('entries')
      .update({ guarantee_remaining: Math.max(0, remaining - 1) })
      .eq('id', e.id);
    if (error) {
      console.error('[float-daily-slots] decrement error:', e.id, error.message);
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    inserted: slotEntries.length,
    guaranteed: guaranteedPicked.length,
  });
}
