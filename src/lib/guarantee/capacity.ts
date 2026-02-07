import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FLOAT_DAILY_SLOT_COUNT } from '@/lib/gallery/floatDailyPicker';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const GUARANTEE_BY_PLAN: Record<string, number> = {
  mini: 4,
  light: 9,
  standard: 14,
  premium: 30,
  free: 0,
};

export function getGuaranteeTotalForPlan(plan: string): number {
  return GUARANTEE_BY_PLAN[String(plan ?? '').toLowerCase()] ?? 0;
}

function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  n.setMonth(n.getMonth() + months);
  return n;
}

function diffDays(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

type CapacityRow = {
  guarantee_remaining: number | null;
  guarantee_total: number | null;
  guarantee_period_start: string | null;
  guarantee_period_end: string | null;
  display_start_at: string | null;
};

export type CapacityCheckResult = {
  ok: boolean;
  capacity: number;
  used: number;
  remaining: number;
  windowStart: string;
  windowEnd: string;
};

export async function checkFloatGuaranteeCapacity(
  additionalGuarantee: number,
  now: Date = new Date()
): Promise<CapacityCheckResult> {
  const windowStart = now;
  const windowEnd = addMonths(windowStart, 1);
  const capacity = FLOAT_DAILY_SLOT_COUNT * diffDays(windowStart, windowEnd);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('entries')
    .select(
      [
        'guarantee_remaining',
        'guarantee_total',
        'guarantee_period_start',
        'guarantee_period_end',
        'display_start_at',
      ].join(',')
    )
    .returns<CapacityRow[]>()
    .eq('display_ready', true)
    .eq('gallery_type', 'float');

  if (error) {
    console.error('[guarantee-capacity] fetch error:', error);
  }

  let used = 0;
  const rows = data ?? [];
  for (const row of rows) {
    const end = row.guarantee_period_end ? new Date(row.guarantee_period_end) : null;
    if (!end || end.getTime() <= windowStart.getTime()) continue;

    const startValue = row.guarantee_period_start ?? row.display_start_at;
    if (startValue) {
      const start = new Date(startValue);
      if (start.getTime() >= windowEnd.getTime()) continue;
    }

    const remaining = Math.max(
      0,
      Number(row.guarantee_remaining ?? row.guarantee_total ?? 0)
    );
    used += remaining;
  }

  const remaining = capacity - used;
  const ok = remaining - additionalGuarantee >= 0;

  return {
    ok,
    capacity,
    used,
    remaining,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}
