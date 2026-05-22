"use client";

import { CalendarRange, Flag } from "lucide-react";
import { natoriStageMeta } from "@/lib/natori/mockProjects";
import { getCalendarEntriesForDate, parseISODate } from "@/lib/natori/projects";
import { cn } from "@/lib/utils";
import ProjectCard from "./ProjectCard";
import type { NatoriProject } from "@/types/natori/projects";

const detailDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

type ProjectDayDetailProps = {
  selectedISO: string;
  allProjects: NatoriProject[];
  projects: NatoriProject[];
  today: Date;
  onToggleTask: (projectId: string, taskId: string) => void;
};

export default function ProjectDayDetail({
  selectedISO,
  allProjects,
  projects,
  today,
  onToggleTask,
}: ProjectDayDetailProps) {
  const date = parseISODate(selectedISO);
  const dateLabel = detailDateFormatter.format(date);
  const entries = getCalendarEntriesForDate(allProjects, selectedISO);
  const milestoneEntries = entries.filter((entry) => entry.kind === "milestone");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white">
          <CalendarRange className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Selected day</p>
          <p className="break-words text-lg font-black text-gray-900 sm:text-xl">{dateLabel}</p>
          <p className="mt-1 text-xs text-gray-700">
            納期 {projects.length} 件 / 目安締切 {milestoneEntries.length} 件
          </p>
        </div>
      </div>

      {milestoneEntries.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-700">
            <Flag className="h-4 w-4" aria-hidden />
            この日の目安締切
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {milestoneEntries.map((entry, idx) => {
              if (entry.kind !== "milestone") return null;
              const stage = natoriStageMeta[entry.stage];
              return (
                <li
                  key={`${entry.project.id}-${entry.stage}-${idx}`}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm",
                    stage.borderLeftClassName
                  )}
                >
                  <span
                    className={cn("inline-block h-2 w-2 shrink-0 rounded-full", stage.dotClassName)}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-bold text-gray-900">
                    {entry.project.clientName}｜{entry.project.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                      stage.chipClassName
                    )}
                  >
                    {stage.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-800">
          {milestoneEntries.length === 0
            ? "この日に予定はありません。ゆっくり手を動かせます。"
            : "この日が納期の案件はありません。目安締切だけ意識しておけば大丈夫です。"}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              today={today}
              onToggleTask={onToggleTask}
            />
          ))}
        </div>
      )}
    </section>
  );
}
