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
 * Gives each case shown in the month its own colour, in order of its first bar.
 * A colour is reused only by a case that starts after the earlier case's last bar,
 * so cases running side by side never share a colour unless more than six overlap.
 */
export function caseCalendarColors(bars: readonly NatoriCalendarBar[]): Map<string, { color: string; title: string }> {
  const span = new Map<string, { start: string; end: string; title: string }>();
  for (const bar of bars) {
    const seen = span.get(bar.project.id);
    span.set(bar.project.id, seen
      ? { start: bar.startISO < seen.start ? bar.startISO : seen.start, end: bar.endISO > seen.end ? bar.endISO : seen.end, title: bar.startISO < seen.start ? bar.project.title : seen.title }
      : { start: bar.startISO, end: bar.endISO, title: bar.project.title });
  }
  const ordered = [...span.entries()].sort(([a, x], [b, y]) => x.start.localeCompare(y.start) || a.localeCompare(b));
  const placed: { index: number; end: string }[] = [];
  return new Map(ordered.map(([id, { start, end, title }], i) => {
    const busy = new Set(placed.filter(p => p.end >= start).map(p => p.index));
    const free = CASE_CALENDAR_COLORS.findIndex((_, n) => !busy.has(n));
    const index = free >= 0 ? free : i % CASE_CALENDAR_COLORS.length;
    placed.push({ index, end });
    return [id, { color: CASE_CALENDAR_COLORS[index], title }];
  }));
}
