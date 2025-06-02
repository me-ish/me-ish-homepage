// lib/getDisplayPlanStats.ts
import { supabase } from '@/lib/supabaseClient';

const planKeys = ['free', 'mini', 'light', 'standard', 'premium'] as const;
export type PlanKey = typeof planKeys[number];

export async function getDisplayPlanStats(): Promise<Record<PlanKey, number> | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('display_plan')
    .eq('confirmed', true);

  if (error) {
    console.error('Supabase集計エラー:', error);
    return null;
  }

  const counts: Record<PlanKey, number> = {
    free: 0,
    mini: 0,
    light: 0,
    standard: 0,
    premium: 0,
  };

  data.forEach(({ display_plan }) => {
    if (planKeys.includes(display_plan as PlanKey)) {
      counts[display_plan as PlanKey]++;
    }
  });

  return counts;
}
