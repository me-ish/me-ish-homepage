"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { natoriProjectStatusMeta, natoriStageMeta } from "@/features/natori/constants/mockProjects";
import { daysUntilDue, getStageForStatus } from "@/features/natori/lib/projects";
import type { NatoriPriorityCandidate } from "@/features/natori/types/projects";

type ProjectPriorityListProps = {
  suggestions: NatoriPriorityCandidate[];
  today: Date;
  onSelect: (project: NatoriPriorityCandidate) => void;
};

const rankClassMap = [
  "bg-[#BE185D] text-white",
  "bg-zinc-800 text-white",
  "bg-zinc-600 text-white",
];

export default function ProjectPriorityList({ suggestions, today, onSelect }: ProjectPriorityListProps) {
  const [open, setOpen] = useState(false);
  const topCandidate = suggestions[0];

  return (
    <section className={`rounded-2xl ${natoriAdminUi.surface}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-zinc-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={natoriAdminUi.iconTile}>
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">今日のおすすめ順</p>
            {topCandidate && !open ? (
              <p className="mt-0.5 min-w-0 truncate text-xs leading-5 text-zinc-700">
                1位：{topCandidate.project.clientName}｜{topCandidate.project.title}
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-5 text-zinc-600">
                納期・進捗・状態から、まず触ると良い案件を提案します。
              </p>
            )}
          </div>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors group-hover:bg-zinc-100">
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        suggestions.length === 0 ? (
          <p className="border-t border-zinc-100 px-4 pb-4 pt-3 text-sm text-zinc-700 sm:px-5">
            進行中の案件はありません。少し休憩してもよさそうです。
          </p>
        ) : (
          <ol className="flex flex-col gap-2 border-t border-zinc-100 px-3 pb-3 pt-3 sm:px-5 sm:pb-5">
            {suggestions.map((candidate, idx) => {
              const { project } = candidate;
              const meta = natoriProjectStatusMeta[project.status];
              const stage = getStageForStatus(project.status);
              const stageMeta = stage ? natoriStageMeta[stage] : null;
              const days =
                project.dueDate === null ? null : daysUntilDue(project.dueDate, today);
              const rankClass = rankClassMap[idx] ?? "bg-zinc-100 text-zinc-700";
              const dueClass =
                days === null
                  ? "text-zinc-500"
                  : days < 0
                  ? "text-red-700"
                  : days <= 2
                  ? "text-amber-700"
                  : "text-zinc-700";
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(candidate)}
                    className="flex w-full items-start gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                        rankClass
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words text-sm font-semibold text-zinc-900">
                          {project.clientName}｜{project.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
                            meta.chipClassName
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-zinc-700">
                        理由：{candidate.reasons.join("、")}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className={cn("text-xs font-semibold", dueClass)}>
                          {days === null
                            ? "納期未定"
                            : days < 0
                            ? `期限切れ ${Math.abs(days)}日`
                            : days === 0
                            ? "納期は今日"
                            : `納期まで ${days}日`}
                        </p>
                        {stageMeta ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                              stageMeta.chipClassName
                            )}
                          >
                            <span
                              className={cn("inline-block h-1.5 w-1.5 rounded-full", stageMeta.dotClassName)}
                              aria-hidden
                            />
                            {stageMeta.label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )
      ) : null}
    </section>
  );
}
