export type NatoriMonthlyReminder = {
  id: string;
  dayOfMonth: number;
  label: string;
  shortLabel: string;
  detail?: string;
  chipClassName: string;
  cellBadgeClassName: string;
  bannerClassName: string;
};

export const NATORI_MONTHLY_REMINDERS: NatoriMonthlyReminder[] = [
  {
    id: "tsunagu_transfer",
    dayOfMonth: 25,
    label: "つなぐ → 事業用口座 送金日",
    shortLabel: "送金",
    detail: "つなぐのサイトから事業用口座への送金手続きを行う日。",
    chipClassName: "border-amber-400 bg-amber-100 text-amber-900",
    cellBadgeClassName: "bg-amber-500 text-white",
    bannerClassName: "border-amber-300 bg-amber-50 text-amber-900",
  },
];

export function getRemindersForDate(iso: string): NatoriMonthlyReminder[] {
  const dayPart = iso.split("-")[2];
  if (!dayPart) return [];
  const day = Number(dayPart);
  if (!Number.isFinite(day)) return [];
  return NATORI_MONTHLY_REMINDERS.filter((reminder) => reminder.dayOfMonth === day);
}

export function getRemindersForDayOfMonth(dayOfMonth: number): NatoriMonthlyReminder[] {
  return NATORI_MONTHLY_REMINDERS.filter((reminder) => reminder.dayOfMonth === dayOfMonth);
}
