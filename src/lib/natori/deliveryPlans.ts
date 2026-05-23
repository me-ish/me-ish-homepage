import { parseISODate, toISODate } from "@/lib/natori/projects";
import type { NatoriDeliveryPlan, NatoriDeliveryPlanMeta } from "@/types/natori/projects";

export const NATORI_DELIVERY_PLANS: Record<NatoriDeliveryPlan, NatoriDeliveryPlanMeta> = {
  normal: {
    id: "normal",
    label: "通常納期",
    shortLabel: "通常",
    description: "約1ヶ月",
    days: 30,
    extraFee: 0,
    isRush: false,
    chipClassName: "border-pink-200 bg-pink-50 text-pink-800",
    softClassName: "bg-pink-50/60 text-pink-900",
    barAccentClassName: "ring-pink-200",
    dotClassName: "bg-pink-300",
  },
  rush_14_days: {
    id: "rush_14_days",
    label: "お急ぎ納品（14日前後）",
    shortLabel: "お急ぎ 14日",
    description: "14日前後",
    days: 14,
    extraFee: 2000,
    isRush: true,
    chipClassName: "border-orange-300 bg-orange-100 text-orange-900",
    softClassName: "bg-orange-50 text-orange-900",
    barAccentClassName: "ring-orange-400",
    dotClassName: "bg-orange-500",
  },
  rush_7_days: {
    id: "rush_7_days",
    label: "お急ぎ納品（7日前後）",
    shortLabel: "お急ぎ 7日",
    description: "7日前後",
    days: 7,
    extraFee: 2000,
    isRush: true,
    chipClassName: "border-red-300 bg-red-100 text-red-900",
    softClassName: "bg-red-50 text-red-900",
    barAccentClassName: "ring-red-400",
    dotClassName: "bg-red-500",
  },
};

export const NATORI_DELIVERY_PLAN_ORDER: NatoriDeliveryPlan[] = [
  "normal",
  "rush_14_days",
  "rush_7_days",
];

export const DEFAULT_NATORI_DELIVERY_PLAN: NatoriDeliveryPlan = "normal";

export function getDeliveryPlanMeta(plan: NatoriDeliveryPlan | undefined): NatoriDeliveryPlanMeta {
  return NATORI_DELIVERY_PLANS[plan ?? DEFAULT_NATORI_DELIVERY_PLAN];
}

export function calculateDueDate(startDateISO: string, plan: NatoriDeliveryPlan): string {
  const start = parseISODate(startDateISO);
  const meta = NATORI_DELIVERY_PLANS[plan];
  const due = new Date(start.getFullYear(), start.getMonth(), start.getDate() + meta.days);
  return toISODate(due);
}

export function isRushPlan(plan: NatoriDeliveryPlan | undefined): boolean {
  return getDeliveryPlanMeta(plan).isRush;
}
