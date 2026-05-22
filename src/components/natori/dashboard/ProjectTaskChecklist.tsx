"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriStageMeta } from "@/lib/natori/mockProjects";
import { getTaskProgress } from "@/lib/natori/projects";
import type { NatoriProject } from "@/types/natori/projects";

type ProjectTaskChecklistProps = {
  project: NatoriProject;
  onToggle: (projectId: string, taskId: string) => void;
};

export default function ProjectTaskChecklist({ project, onToggle }: ProjectTaskChecklistProps) {
  const progress = getTaskProgress(project);
  const percent = Math.round(progress.ratio * 100);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-900">タスク</p>
        <p className="text-xs font-bold text-gray-700">
          <span className="text-gray-900">{progress.done}/{progress.total}</span>
          <span className="ml-1 text-gray-500">完了 / {percent}%</span>
        </p>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {project.tasks.map((task) => {
          const stage = natoriStageMeta[task.stage];
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onToggle(project.id, task.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  task.done
                    ? stage.doneTaskClassName
                    : "border-gray-200 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50"
                )}
                aria-pressed={task.done}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                    task.done
                      ? stage.checkboxClassName
                      : "border-gray-400 bg-white text-transparent"
                  )}
                  aria-hidden
                >
                  <Check className="h-4 w-4" />
                </span>
                <span
                  className={cn(
                    "inline-block h-2 w-2 shrink-0 rounded-full",
                    stage.dotClassName
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 break-words font-bold",
                    task.done && "line-through decoration-gray-500/70"
                  )}
                >
                  {task.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    stage.chipClassName
                  )}
                >
                  {stage.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
