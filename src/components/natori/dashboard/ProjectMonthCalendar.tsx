"use client";

import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta, natoriStageMeta } from "@/lib/natori/mockProjects";
import {
  buildMonthCells,
  getStageForStatus,
  isProjectOverdue,
  toISODate,
} from "@/lib/natori/projects";
import type { NatoriProject } from "@/types/natori/projects";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type ProjectMonthCalendarProps = {
  year: number;
  monthIndex: number;
  projects: NatoriProject[];
  today: Date;
  selectedISO: string;
  onSelect: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export default function ProjectMonthCalendar({
  year,
  monthIndex,
  projects,
  today,
  selectedISO,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: ProjectMonthCalendarProps) {
  const cells = buildMonthCells(year, monthIndex, projects, today);
  const monthLabel = `${year}年${monthIndex + 1}月`;
  const todayISO = toISODate(today);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="h-10 min-w-[44px] rounded-full border border-gray-300 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
          aria-label="前の月へ"
        >
          ← 前月
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Month</p>
          <p className="text-lg font-black text-gray-900 sm:text-xl">{monthLabel}</p>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="h-10 min-w-[44px] rounded-full border border-gray-300 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
          aria-label="次の月へ"
        >
          次月 →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={cn(
              "text-[11px] font-bold text-gray-500 sm:text-xs",
              idx === 0 && "text-rose-500",
              idx === 6 && "text-sky-500"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((cell) => {
          const selected = cell.iso === selectedISO;
          const weekday = cell.date.getDay();
          const overdueCount = cell.projects.filter((p) => isProjectOverdue(p, today)).length;
          const visible = cell.projects.slice(0, 2);
          const overflow = cell.projects.length - visible.length;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={cn(
                "flex min-h-[60px] flex-col items-stretch overflow-hidden rounded-xl border p-1 text-left transition sm:min-h-[88px] sm:p-2",
                cell.inMonth
                  ? "border-gray-200 bg-white hover:border-gray-400"
                  : "border-transparent bg-gray-50 text-gray-300",
                cell.isToday && "ring-2 ring-pink-500",
                selected && "border-gray-900 ring-1 ring-gray-900",
                overdueCount > 0 && cell.inMonth && "border-red-400"
              )}
              aria-label={`${cell.iso} の案件を表示`}
              aria-pressed={selected}
            >
              <div className="flex items-center justify-between">
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
                {overdueCount > 0 ? (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[9px] font-bold text-white">
                    !
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex min-w-0 flex-col gap-0.5">
                {visible.map((project) => {
                  const stage = getStageForStatus(project.status);
                  const stageMeta = stage ? natoriStageMeta[stage] : null;
                  const statusMeta = natoriProjectStatusMeta[project.status];
                  const overdue = isProjectOverdue(project, today);
                  return (
                    <span
                      key={project.id}
                      className={cn(
                        "flex min-w-0 items-center gap-1 truncate rounded px-1 text-[10px] leading-tight sm:text-[11px]",
                        overdue
                          ? "bg-red-100 text-red-800"
                          : stageMeta?.softClassName ?? statusMeta.cellClassName
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                          overdue ? "bg-red-500" : stageMeta?.dotClassName ?? "bg-gray-400"
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">{project.clientName}</span>
                    </span>
                  );
                })}
                {overflow > 0 ? (
                  <span className="text-[10px] text-gray-500">+{overflow}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600 sm:text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-pink-500" />
          今日
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          期限切れ
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-500" />
          ラフ
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" />
          線画
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-fuchsia-500" />
          着彩
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-violet-500" />
          仕上げ
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
          納品
        </span>
      </div>
    </section>
  );
}
