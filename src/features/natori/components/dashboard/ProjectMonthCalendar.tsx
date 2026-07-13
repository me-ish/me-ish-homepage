"use client";

import { cn } from "@/lib/utils";
import { natoriStageMeta } from "@/features/natori/constants/mockProjects";
import { buildMonthCells, toISODate } from "@/features/natori/lib/projects";
import { getDeliveryPlanMeta } from "@/features/natori/lib/deliveryPlans";
import { getRemindersForDate } from "@/features/natori/lib/reminders";
import type { NatoriEvent } from "@/features/natori/data/supabaseEvents";
import type { NatoriCalendarCellBar, NatoriProject } from "@/features/natori/types/projects";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const MAX_LANES_MOBILE = 3;
const MAX_LANES_DESKTOP = 5;

type ProjectMonthCalendarProps = {
  year: number;
  monthIndex: number;
  projects: NatoriProject[];
  events: NatoriEvent[];
  today: Date;
  selectedISO: string;
  onSelect: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function BarSegment({ cellBar }: { cellBar: NatoriCalendarCellBar | null }) {
  if (!cellBar) {
    return <span className="block h-3 sm:h-4" aria-hidden />;
  }
  const stage = natoriStageMeta[cellBar.bar.stage];
  const { isStart, isEnd, isOverdue, bar } = cellBar;
  const isDelivery = bar.stage === "delivery";
  const showLabel = isStart || (isDelivery && isEnd);
  const deliveryPlanMeta = getDeliveryPlanMeta(bar.project.deliveryPlan);
  const rush = deliveryPlanMeta.isRush;
  return (
    <span
      className={cn(
        "flex h-3 min-w-0 items-center overflow-hidden text-[9px] font-bold leading-3 sm:h-4 sm:text-[10px] sm:leading-4",
        isOverdue ? "bg-red-300 text-red-950" : stage.barClassName,
        isDelivery && "ring-1 ring-inset ring-emerald-700/40",
        rush && !isOverdue && cn("ring-1 ring-inset", deliveryPlanMeta.barAccentClassName),
        isStart && "rounded-l-md pl-1",
        isEnd && "rounded-r-md pr-1"
      )}
      title={`${bar.project.clientName}｜${stage.label}${rush ? `｜${deliveryPlanMeta.shortLabel}` : ""}`}
    >
      {showLabel ? (
        <span className="min-w-0 flex-1 truncate">
          {bar.project.clientName}
          <span className="ml-1 opacity-90">{stage.label}</span>
          {rush ? <span className="ml-1 font-black">⚡</span> : null}
        </span>
      ) : null}
    </span>
  );
}

export default function ProjectMonthCalendar({
  year,
  monthIndex,
  projects,
  events,
  today,
  selectedISO,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: ProjectMonthCalendarProps) {
  const { cells, totalLanes } = buildMonthCells(year, monthIndex, projects, today);
  const eventsByDate = new Map<string, NatoriEvent[]>();
  for (const event of events) {
    const list = eventsByDate.get(event.date) ?? [];
    list.push(event);
    eventsByDate.set(event.date, list);
  }
  const monthLabel = `${year}年${monthIndex + 1}月`;
  const todayISO = toISODate(today);
  const mobileLaneLimit = Math.min(totalLanes, MAX_LANES_MOBILE);
  const desktopLaneLimit = Math.min(totalLanes, MAX_LANES_DESKTOP);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm sm:p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="h-9 min-w-[44px] rounded-full border border-gray-300 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
          aria-label="前の月へ"
        >
          ← 前月
        </button>
        <p className="text-base font-black text-gray-900 sm:text-lg">{monthLabel}</p>
        <button
          type="button"
          onClick={onNextMonth}
          className="h-9 min-w-[44px] rounded-full border border-gray-300 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
          aria-label="次の月へ"
        >
          次月 →
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={cn(
              "text-[10px] font-bold text-gray-500 sm:text-xs",
              idx === 0 && "text-rose-500",
              idx === 6 && "text-sky-500"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 overflow-hidden rounded-xl border border-gray-200">
        {cells.map((cell, idx) => {
          const selected = cell.iso === selectedISO;
          const weekday = cell.date.getDay();
          const overdueCount = cell.lanes.filter((cellBar) => cellBar?.isOverdue).length;
          const deliveryEndCount = cell.lanes.filter(
            (cellBar) => cellBar?.bar.stage === "delivery" && cellBar.isEnd
          ).length;
          const rushDueProjects = projects.filter(
            (project) =>
              project.dueDate === cell.iso &&
              getDeliveryPlanMeta(project.deliveryPlan).isRush
          );
          const topRushPlan =
            rushDueProjects.length > 0
              ? getDeliveryPlanMeta(
                  rushDueProjects.find((project) => project.deliveryPlan === "rush_7_days")
                    ?.deliveryPlan ?? rushDueProjects[0].deliveryPlan
                )
              : null;
          const cellReminders = cell.inMonth ? getRemindersForDate(cell.iso) : [];
          const cellEvents = cell.inMonth ? eventsByDate.get(cell.iso) ?? [] : [];

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={cn(
                "relative flex min-h-[72px] flex-col items-stretch text-left transition sm:min-h-[104px]",
                idx % 7 !== 0 && "border-l border-gray-200",
                idx >= 7 && "border-t border-gray-200",
                cell.inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50 text-gray-300",
                deliveryEndCount > 0 && cell.inMonth && "bg-emerald-50/70",
                cellReminders.length > 0 && cell.inMonth && "bg-amber-50/70",
                cell.isToday && "ring-2 ring-inset ring-pink-500",
                selected && "ring-1 ring-inset ring-gray-900"
              )}
              aria-label={`${cell.iso} の案件を表示`}
              aria-pressed={selected}
            >
              <div className="flex items-center justify-between px-1 pt-0.5 sm:px-1.5">
                <span
                  className={cn(
                    "text-[11px] font-bold sm:text-xs",
                    cell.inMonth ? "text-gray-900" : "text-gray-300",
                    weekday === 0 && cell.inMonth && "text-rose-500",
                    weekday === 6 && cell.inMonth && "text-sky-500",
                    cell.iso === todayISO && "rounded-full bg-pink-500 px-1.5 py-0.5 text-white"
                  )}
                >
                  {cell.date.getDate()}
                </span>
                <span className="ml-1 flex items-center gap-1">
                  {cellReminders.map((reminder) => (
                    <span
                      key={reminder.id}
                      className={cn(
                        "flex items-center gap-0.5 rounded px-1 text-[9px] font-black uppercase tracking-wide shadow-sm",
                        reminder.cellBadgeClassName
                      )}
                      title={reminder.label}
                    >
                      <span aria-hidden>¥</span>
                      {reminder.shortLabel}
                    </span>
                  ))}
                  {topRushPlan ? (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 rounded px-1 text-[9px] font-black uppercase tracking-wide shadow-sm",
                        topRushPlan.chipClassName
                      )}
                      title={topRushPlan.label}
                    >
                      <span aria-hidden>⚡</span>
                      {topRushPlan.shortLabel}
                    </span>
                  ) : null}
                  {deliveryEndCount > 0 ? (
                    <span className="flex items-center gap-0.5 rounded bg-emerald-600 px-1 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">
                      <span aria-hidden>★</span>
                      納品{deliveryEndCount > 1 ? `×${deliveryEndCount}` : ""}
                    </span>
                  ) : null}
                  {overdueCount > 0 ? (
                    <span className="rounded-full bg-red-500 px-1.5 text-[9px] font-bold text-white">
                      !
                    </span>
                  ) : null}
                  {cellEvents.length > 0 ? (
                    <span
                      className="flex items-center gap-0.5 rounded bg-purple-500 px-1 text-[9px] font-black uppercase tracking-wide text-white shadow-sm"
                      title={cellEvents.map((event) => event.title).join(" / ")}
                    >
                      <span aria-hidden>●</span>
                      予定{cellEvents.length > 1 ? `×${cellEvents.length}` : ""}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="mt-0.5 flex flex-col gap-0.5 pb-0.5 sm:hidden">
                {cell.lanes.slice(0, mobileLaneLimit).map((cellBar, laneIdx) => (
                  <BarSegment key={laneIdx} cellBar={cellBar} />
                ))}
                {totalLanes > mobileLaneLimit ? (
                  <span className="px-1 text-[9px] text-gray-500">+{totalLanes - mobileLaneLimit}</span>
                ) : null}
              </div>

              <div className="mt-0.5 hidden flex-col gap-0.5 pb-0.5 sm:flex">
                {cell.lanes.slice(0, desktopLaneLimit).map((cellBar, laneIdx) => (
                  <BarSegment key={laneIdx} cellBar={cellBar} />
                ))}
                {totalLanes > desktopLaneLimit ? (
                  <span className="px-1 text-[9px] text-gray-500">+{totalLanes - desktopLaneLimit}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600 sm:text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-pink-500" />
          今日
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-300" />
          期限切れ
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-amber-300" />
          ラフ
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-indigo-300" />
          線画
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-fuchsia-300" />
          着彩
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-violet-300" />
          仕上げ
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-300" />
          納品
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
          お急ぎ14日
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          お急ぎ7日
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          毎月月末 送金
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
          個人予定
        </span>
      </div>
    </section>
  );
}
