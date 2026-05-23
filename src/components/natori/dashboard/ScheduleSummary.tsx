"use client";

import type {
  NatoriScheduleEntry,
  NatoriWeeklyForecast,
} from "@/lib/natori/scheduling";

type ScheduleSummaryProps = {
  entries: NatoriScheduleEntry[];
  forecast: NatoriWeeklyForecast;
  onSelect: (entry: NatoriScheduleEntry) => void;
};

export default function ScheduleSummary(_props: ScheduleSummaryProps) {
  return null;
}
