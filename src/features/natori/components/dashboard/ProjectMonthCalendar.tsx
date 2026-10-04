"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { natoriStageMeta } from "@/features/natori/constants/mockProjects";
import { buildMonthCells, toISODate } from "@/features/natori/lib/projects";
import { getDeliveryPlanMeta } from "@/features/natori/lib/deliveryPlans";
import { getRemindersForDate } from "@/features/natori/lib/reminders";
import { isActiveNatoriProject } from "@/features/natori/lib/projectReadModel";
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
  /**
   * 月末送金日などの固定リマインダーを表示するか。
   * ナトリ運用固有の決め事なので、エトリエのデモ環境では false にする。
   */
  showReminders?: boolean;
  onSelect: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

/** スマホ用: ラベルなしの高さ4pxの色線。長さと色だけで工程の流れを読む。 */
function CompactBar({ cellBar }: { cellBar: NatoriCalendarCellBar | null }) {
  if (!cellBar) {
    return <span className="block h-1" aria-hidden />;
  }
  const stage = natoriStageMeta[cellBar.bar.stage];
  const { isStart, isEnd, isOverdue } = cellBar;
  return (
    <span
      aria-hidden
      className={cn(
        "block h-1",
        isOverdue ? "bg-red-500" : stage.dotClassName,
        isStart && "rounded-l-full",
        isEnd && "rounded-r-full"
      )}
    />
  );
}

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
        "flex h-3 min-w-0 items-center overflow-hidden text-xs font-semibold leading-3 sm:h-[18px] sm:text-[11px] sm:leading-[18px]",
        // 枠線はセルの境目で途切れて見えるため付けない。期限切れは濃い赤、お急ぎは ⚡ で示す
        isOverdue ? "bg-red-200 text-red-950" : stage.barClassName,
        isStart && "ml-0.5 rounded-l-md pl-1.5",
        isEnd && "mr-0.5 rounded-r-md pr-1"
      )}
      title={`${bar.project.clientName}｜${stage.label}${rush ? `｜${deliveryPlanMeta.shortLabel}` : ""}`}
    >
      {showLabel ? (
        <span className="min-w-0 flex-1 truncate">
          {bar.project.clientName}
          <span className="ml-1 font-medium opacity-80">{stage.label}</span>
          {rush ? <span className="ml-1">⚡</span> : null}
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
  showReminders = true,
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
    <section className={`rounded-2xl ${natoriAdminUi.surface} p-2 sm:p-4 md:p-5`}>
      <div className="mb-3 flex items-center justify-between gap-2 px-1 sm:px-0">
        <p className="text-lg font-semibold tracking-tight text-zinc-900 tabular-nums">{monthLabel}</p>
        <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(24,24,27,0.05)]">
          <button
            type="button"
            onClick={onPrevMonth}
            className="inline-flex h-9 min-w-[44px] items-center gap-0.5 rounded-full px-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:h-8"
            aria-label="前の月へ"
          >
            <ChevronLeft className="h-4 w-4 text-zinc-500" aria-hidden />
            前月
          </button>
          <span aria-hidden className="h-4 w-px bg-zinc-200" />
          <button
            type="button"
            onClick={onNextMonth}
            className="inline-flex h-9 min-w-[44px] items-center gap-0.5 rounded-full px-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:h-8"
            aria-label="次の月へ"
          >
            次月
            <ChevronRight className="h-4 w-4 text-zinc-500" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 pb-1.5 text-center">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={cn(
              "text-xs font-medium text-zinc-500",
              idx === 0 && "text-rose-600",
              idx === 6 && "text-sky-600"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-zinc-200">
        {cells.map((cell, idx) => {
          const selected = cell.iso === selectedISO;
          const weekday = cell.date.getDay();
          const overdueCount = cell.lanes.filter((cellBar) => cellBar?.isOverdue).length;
          const deliveryEndCount = cell.lanes.filter(
            (cellBar) => cellBar?.bar.stage === "delivery" && cellBar.isEnd
          ).length;
          const rushDueProjects = projects.filter(
            (project) =>
              isActiveNatoriProject(project) &&
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
          const cellReminders = showReminders && cell.inMonth ? getRemindersForDate(cell.iso) : [];
          const cellEvents = cell.inMonth ? eventsByDate.get(cell.iso) ?? [] : [];
          const activeLaneCount = cell.lanes.filter(Boolean).length;
          const hiddenMobileLanes = cell.lanes.slice(mobileLaneLimit).filter(Boolean).length;
          const hiddenDesktopLanes = cell.lanes.slice(desktopLaneLimit).filter(Boolean).length;
          // スマホでは文字バッジの代わりに種類別の色ドット（最大4個）にする
          const dotClassNames = [
            ...cellReminders.map(() => "bg-amber-500"),
            ...(topRushPlan
              ? [
                  rushDueProjects.some((project) => project.deliveryPlan === "rush_7_days")
                    ? "bg-red-500"
                    : "bg-orange-500",
                ]
              : []),
            ...(deliveryEndCount > 0 ? ["bg-emerald-600"] : []),
            ...(overdueCount > 0 ? ["bg-red-700"] : []),
            ...(cellEvents.length > 0 ? ["bg-purple-500"] : []),
          ].slice(0, 4);

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={cn(
                "relative flex min-h-[56px] flex-col items-stretch text-left transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#831843] sm:min-h-[108px]",
                idx % 7 !== 0 && "border-l border-zinc-100",
                idx >= 7 && "border-t border-zinc-100",
                cell.inMonth ? "bg-white hover:bg-zinc-50" : "bg-zinc-50/80 text-zinc-300",
                deliveryEndCount > 0 && cell.inMonth && "bg-emerald-50/60",
                cellReminders.length > 0 && cell.inMonth && "bg-amber-50/60",
                // 今日は枠線ではなく背景で示す（枠だと工程バーの上に重なって
                // バーが分断されて見えるため）。日付側のピンクの丸と対で読む
                cell.isToday && cell.inMonth && "bg-pink-50/70",
                // 選択中は工程バーより手前に描く outline で囲む
                selected && "z-[1] outline outline-2 outline-offset-[-2px] outline-[#BE185D]"
              )}
              aria-label={`${cell.iso} の案件を表示`}
              title={`稼働${activeLaneCount}件 納期${deliveryEndCount}件 予定${cellEvents.length}件`}
              aria-pressed={selected}
            >
              {/* 日付とバッジの行。高さを固定して、今日の丸やバッジの有無で
                  下の工程バーの開始位置がセルごとにずれないようにする */}
              <div className="flex h-6 items-center justify-between px-1 sm:h-7 sm:px-1.5">
                <span
                  className={cn(
                    "grid h-5 min-w-5 place-items-center text-[11px] font-semibold leading-none tabular-nums sm:h-6 sm:min-w-6 sm:text-xs",
                    cell.inMonth ? "text-zinc-800" : "text-zinc-300",
                    weekday === 0 && cell.inMonth && "text-rose-600",
                    weekday === 6 && cell.inMonth && "text-sky-600",
                    cell.iso === todayISO && "rounded-full bg-[#BE185D] px-1 text-white shadow-[0_1px_2px_rgba(131,24,67,0.3)]"
                  )}
                >
                  {cell.date.getDate()}
                </span>
                <span className="ml-1 flex items-center gap-0.5 sm:hidden" aria-hidden>
                  {dotClassNames.map((className, dotIdx) => (
                    <span key={dotIdx} className={cn("h-1.5 w-1.5 rounded-full", className)} />
                  ))}
                </span>
                <span className="ml-1 hidden min-w-0 items-center gap-1 whitespace-nowrap sm:flex">
                  {cellReminders.map((reminder) => (
                    <span
                      key={reminder.id}
                      className={cn(
                        "flex shrink-0 items-center gap-0.5 rounded-md px-1 text-[11px] font-semibold leading-[18px]",
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
                        "grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-md border px-0.5 text-[11px] font-semibold leading-none",
                        topRushPlan.chipClassName
                      )}
                      title={topRushPlan.label}
                    >
                      {/* 幅が足りず折り返すため記号だけにする。種類は色と凡例・title で示す */}
                      <span aria-hidden>⚡</span>
                    </span>
                  ) : null}
                  {deliveryEndCount > 0 ? (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-100 px-1 text-[11px] font-semibold leading-[18px] text-emerald-800">
                      <span aria-hidden>★</span>
                      納品{deliveryEndCount > 1 ? `×${deliveryEndCount}` : ""}
                    </span>
                  ) : null}
                  {overdueCount > 0 ? (
                    <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                      !
                    </span>
                  ) : null}
                  {cellEvents.length > 0 ? (
                    <span
                      className="flex shrink-0 items-center gap-0.5 rounded-md bg-purple-100 px-1 text-[11px] font-semibold leading-[18px] text-purple-800"
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
                  <CompactBar key={laneIdx} cellBar={cellBar} />
                ))}
                {hiddenMobileLanes > 0 ? (
                  <span className="px-1 text-[10px] font-medium leading-3 text-zinc-500">+{hiddenMobileLanes}</span>
                ) : null}
              </div>

              <div className="mt-0.5 hidden flex-col gap-0.5 pb-0.5 sm:flex">
                {cell.lanes.slice(0, desktopLaneLimit).map((cellBar, laneIdx) => (
                  <BarSegment key={laneIdx} cellBar={cellBar} />
                ))}
                {hiddenDesktopLanes > 0 ? (
                  <span className="px-1.5 text-[11px] font-medium text-zinc-500">他 {hiddenDesktopLanes}件</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-1 text-xs text-zinc-600 sm:px-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#BE185D]" />
          今日
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-red-500 sm:bg-red-100 sm:ring-1 sm:ring-inset sm:ring-red-300" />
          期限切れ
        </span>
        {(["rough", "lineart", "coloring", "finish", "delivery"] as const).map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block h-2 w-3 rounded-sm",
                natoriStageMeta[key].dotClassName,
                // PC の工程バーは淡色。スマホの細線は濃い色なので凡例も合わせる
                {
                  rough: "sm:bg-amber-200",
                  lineart: "sm:bg-indigo-200",
                  coloring: "sm:bg-fuchsia-200",
                  finish: "sm:bg-violet-200",
                  delivery: "sm:bg-emerald-200",
                }[key]
              )}
            />
            {natoriStageMeta[key].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded border border-orange-300 bg-orange-100 text-[9px] leading-none" aria-hidden>⚡</span>
          お急ぎ14日
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded border border-red-300 bg-red-100 text-[9px] leading-none" aria-hidden>⚡</span>
          お急ぎ7日
        </span>
        {showReminders ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            毎月月末 送金
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
          個人予定
        </span>
      </div>
    </section>
  );
}
