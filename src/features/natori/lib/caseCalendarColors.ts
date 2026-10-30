import type { NatoriCalendarBar } from "../types/projects";

/** Bar colours for the schedule calendar, one per case. Purple stays for personal events. */
export const CASE_CALENDAR_COLORS = [
  "border-pink-300 bg-pink-100 text-pink-900",
  "border-sky-300 bg-sky-100 text-sky-900",
  "border-orange-300 bg-orange-100 text-orange-900",
  "border-emerald-300 bg-emerald-100 text-emerald-900",
  "border-yellow-300 bg-yellow-100 text-yellow-900",
  "border-indigo-300 bg-indigo-100 text-indigo-900",
] as const;

/**
 * Gives each case shown in the month its own colour, in order of its first bar,
 * so two cases running side by side never share a colour unless more than six overlap.
 */
export function caseCalendarColors(bars: readonly NatoriCalendarBar[]): Map<string, { color: string; title: string }> {
  const first = new Map<string, { start: string; title: string }>();
  for (const bar of bars) {
    const seen = first.get(bar.project.id);
    if (!seen || bar.startISO < seen.start) first.set(bar.project.id, { start: bar.startISO, title: bar.project.title });
  }
  const ordered = [...first.entries()].sort(([a, x], [b, y]) => x.start.localeCompare(y.start) || a.localeCompare(b));
  return new Map(ordered.map(([id, { title }], i) => [id, { color: CASE_CALENDAR_COLORS[i % CASE_CALENDAR_COLORS.length], title }]));
}
