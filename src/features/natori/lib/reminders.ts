export type NatoriMonthlyReminder = {
  id: string;
  /** 実行日。数値 = 毎月その日 / "last" = 毎月月末（28〜31日は月による） */
  dayOfMonth: number | "last";
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
    dayOfMonth: "last",
    label: "つなぐ → 事業用口座 送金日",
    shortLabel: "送金",
    detail: "つなぐのサイトから事業用口座への送金手続きを行う日（毎月月末）。",
    chipClassName: "border-amber-400 bg-amber-100 text-amber-900",
    cellBadgeClassName: "bg-amber-500 text-white",
    bannerClassName: "border-amber-300 bg-amber-50 text-amber-900",
  },
];

export function getRemindersForDate(iso: string): NatoriMonthlyReminder[] {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return [];
  // new Date(y, m, 0) は m月の末日（m は 1-12 のままでよい）
  const lastDay = new Date(year, month, 0).getDate();
  return NATORI_MONTHLY_REMINDERS.filter((reminder) =>
    reminder.dayOfMonth === "last" ? day === lastDay : reminder.dayOfMonth === day
  );
}
