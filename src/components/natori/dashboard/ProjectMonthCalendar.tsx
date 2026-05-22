"use client";

import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/lib/natori/mockProjects";
import {
  buildMonthCells,
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
    <section className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="h-10 min-w-[44px] rounded-full border border-pink-200 bg-white px-3 text-sm font-bold text-pink-700 hover:bg-pink-50"
          aria-label="前の月へ"
        >
          ← 前月
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-bold text-pink-500">Month</p>
          <p className="text-lg font-black text-pink-950 sm:text-xl">{monthLabel}</p>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="h-10 min-w-[44px] rounded-full border border-pink-200 bg-white px-3 text-sm font-bold text-pink-700 hover:bg-pink-50"
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
              idx === 0 && "text-pink-500",
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
                  ? "border-pink-100 bg-white hover:border-pink-300"
                  : "border-transparent bg-gray-50 text-gray-300",
                cell.isToday && "ring-2 ring-pink-400",
                selected && "border-pink-500 bg-pink-50",
                overdueCount > 0 && "border-red-300 bg-red-50/40"
              )}
              aria-label={`${cell.iso} の案件を表示`}
              aria-pressed={selected}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[11px] font-bold sm:text-xs",
                    cell.inMonth ? "text-pink-950" : "text-gray-300",
                    weekday === 0 && cell.inMonth && "text-pink-500",
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
                  const meta = natoriProjectStatusMeta[project.status];
                  const overdue = isProjectOverdue(project, today);
                  return (
                    <span
                      key={project.id}
                      className={cn(
                        "truncate rounded px-1 text-[10px] leading-tight sm:text-[11px]",
                        overdue ? "bg-red-100 text-red-700" : meta.cellClassName
                      )}
                    >
                      {project.clientName}
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

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 sm:text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-pink-500" />
          今日
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          期限切れ
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-pink-500 bg-pink-50" />
          選択中
        </span>
      </div>
    </section>
  );
}
