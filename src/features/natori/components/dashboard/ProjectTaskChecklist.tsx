"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriStageMeta } from "@/features/natori/constants/mockProjects";
import { getTaskProgress } from "@/features/natori/lib/projects";
import type { NatoriProject } from "@/features/natori/types/projects";

type ProjectTaskChecklistProps = {
  project: NatoriProject;
  onToggle: (projectId: string, taskId: string) => void;
};

export default function ProjectTaskChecklist({ project, onToggle }: ProjectTaskChecklistProps) {
  const progress = getTaskProgress(project);
  const percent = Math.round(progress.ratio * 100);
  // Open on desktop by default, closed on mobile to reduce vertical noise.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpen(window.matchMedia("(min-width: 640px)").matches);
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-3 sm:p-3.5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-2 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]"
      >
        <p className="text-sm font-semibold text-zinc-900">タスク</p>
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-700 tabular-nums">
            <span className="text-zinc-900">{progress.done}/{progress.total}</span>
            <span className="ml-1 font-medium text-zinc-500">完了 / {percent}%</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-500 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </span>
      </button>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>

      {open ? (
      <ul className="mt-3 flex flex-col gap-1">
        {project.tasks.map((task) => {
          const stage = natoriStageMeta[task.stage];
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onToggle(project.id, task.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#831843]",
                  task.done
                    ? "border-transparent bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
                    : "border-transparent bg-white text-zinc-800 hover:border-zinc-200 hover:bg-zinc-50"
                )}
                aria-pressed={task.done}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    task.done
                      ? stage.checkboxClassName
                      : "border-zinc-300 bg-white text-transparent"
                  )}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
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
                    "min-w-0 flex-1 break-words font-medium",
                    task.done && "line-through decoration-zinc-400"
                  )}
                >
                  {task.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
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
      ) : null}
    </div>
  );
}
