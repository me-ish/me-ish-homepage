"use client";

import { CalendarDays, CircleDollarSign, Sparkles, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { natoriProjectStatusMeta } from "@/lib/natori/mockProjects";
import {
  isProjectOverdue,
  daysUntilDue,
} from "@/lib/natori/projects";
import { cn } from "@/lib/utils";
import ProjectTaskChecklist from "./ProjectTaskChecklist";
import type { NatoriProject } from "@/types/natori/projects";

type ProjectCardProps = {
  project: NatoriProject;
  today: Date;
  onToggleTask: (projectId: string, taskId: string) => void;
};

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const dueDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return dueDateFormatter.format(date);
}

const priorityChipMap: Record<NonNullable<NatoriProject["priority"]>, { label: string; className: string }> = {
  high: { label: "優先度：高", className: "border-red-200 bg-red-50 text-red-700" },
  normal: { label: "優先度：中", className: "border-pink-200 bg-pink-50 text-pink-700" },
  low: { label: "優先度：低", className: "border-gray-200 bg-gray-50 text-gray-600" },
};

export default function ProjectCard({
  project,
  today,
  onToggleTask,
}: ProjectCardProps) {
  const status = natoriProjectStatusMeta[project.status];
  const overdue = isProjectOverdue(project, today);
  const days = daysUntilDue(project.dueDate, today);
  const priority = project.priority ? priorityChipMap[project.priority] : null;

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border-pink-100 bg-white shadow-sm shadow-pink-100/50",
        overdue && "border-red-300"
      )}
    >
      <CardContent className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-base font-black leading-6 text-pink-950 sm:text-lg">
              {project.title}
            </p>
            <p className="mt-1 break-words text-sm text-gray-500">{project.clientName}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold shadow-none",
                status.chipClassName
              )}
            >
              {status.label}
            </Badge>
            {priority ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  priority.className
                )}
              >
                {priority.label}
              </span>
            ) : null}
          </div>
        </div>

        {overdue ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-bold">
              納期を {Math.abs(days)} 日過ぎています。優先して進めましょう。
            </span>
          </div>
        ) : null}

        <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-pink-700">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            次やること
          </div>
          <p className="mt-1 break-words text-lg font-black leading-7 text-pink-950">
            {project.nextAction}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-pink-500" aria-hidden />
            <span className="shrink-0 text-gray-500">納期</span>
            <span className="min-w-0 break-words font-bold text-gray-900">
              {formatDueDate(project.dueDate)}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <CircleDollarSign className="h-4 w-4 shrink-0 text-pink-500" aria-hidden />
            <span className="shrink-0 text-gray-500">金額</span>
            <span className="min-w-0 break-words font-bold text-gray-900">
              {yenFormatter.format(project.amount)}
            </span>
          </div>
        </div>

        {project.note ? (
          <p className="break-words text-sm leading-6 text-gray-600">{project.note}</p>
        ) : null}

        <ProjectTaskChecklist project={project} onToggle={onToggleTask} />
      </CardContent>
    </Card>
  );
}
