"use client";

import { CalendarRange } from "lucide-react";
import { parseISODate } from "@/lib/natori/projects";
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
  projects: NatoriProject[];
  today: Date;
  onToggleTask: (projectId: string, taskId: string) => void;
};

export default function ProjectDayDetail({
  selectedISO,
  projects,
  today,
  onToggleTask,
}: ProjectDayDetailProps) {
  const date = parseISODate(selectedISO);
  const dateLabel = detailDateFormatter.format(date);

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
            この日が納期の案件 {projects.length} 件
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-800">
          この日に納期の案件はありません。ゆっくり手を動かせます。
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
