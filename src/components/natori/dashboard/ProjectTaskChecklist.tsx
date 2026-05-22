"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="rounded-2xl border border-pink-100 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-pink-700">タスク</p>
        <p className="text-xs font-bold text-gray-600">
          <span className="text-pink-700">{progress.done}/{progress.total}</span>
          <span className="ml-1 text-gray-500">完了 / {percent}%</span>
        </p>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-pink-50">
        <div
          className="h-full rounded-full bg-pink-400 transition-[width]"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {project.tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onToggle(project.id, task.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                task.done
                  ? "border-pink-200 bg-pink-50 text-pink-900"
                  : "border-gray-200 bg-white text-gray-800 hover:border-pink-200 hover:bg-pink-50/50"
              )}
              aria-pressed={task.done}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                  task.done
                    ? "border-pink-500 bg-pink-500 text-white"
                    : "border-gray-300 bg-white text-transparent"
                )}
                aria-hidden
              >
                <Check className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "min-w-0 break-words font-bold",
                  task.done && "line-through decoration-pink-400/70"
                )}
              >
                {task.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
