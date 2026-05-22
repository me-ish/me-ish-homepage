"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta, natoriStageMeta } from "@/lib/natori/mockProjects";
import { daysUntilDue, getStageForStatus } from "@/lib/natori/projects";
import type { NatoriPriorityCandidate } from "@/types/natori/projects";

type ProjectPriorityListProps = {
  suggestions: NatoriPriorityCandidate[];
  today: Date;
  onSelect: (project: NatoriPriorityCandidate) => void;
};

const rankClassMap = ["bg-pink-500", "bg-gray-700", "bg-gray-500"];

export default function ProjectPriorityList({ suggestions, today, onSelect }: ProjectPriorityListProps) {
  if (suggestions.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold text-gray-900">今日のおすすめ順</p>
        <p className="mt-2 text-sm text-gray-700">進行中の案件はありません。少し休憩してもよさそうです。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">今日のおすすめ順</p>
          <p className="mt-1 text-xs leading-5 text-gray-700">
            納期・進捗・状態をもとに、まず触ると良い案件を並べています。
          </p>
        </div>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {suggestions.map((candidate, idx) => {
          const { project } = candidate;
          const meta = natoriProjectStatusMeta[project.status];
          const stage = getStageForStatus(project.status);
          const stageMeta = stage ? natoriStageMeta[stage] : null;
          const days = daysUntilDue(project.dueDate, today);
          const rankClass = rankClassMap[idx] ?? "bg-gray-400";
          const dueClass =
            days < 0
              ? "text-red-700"
              : days <= 2
              ? "text-amber-700"
              : "text-gray-700";
          return (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelect(candidate)}
                className="flex w-full items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition hover:border-gray-400 hover:bg-gray-50"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white",
                    rankClass
                  )}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 break-words text-sm font-black text-gray-900">
                      {project.clientName}｜{project.title}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                        meta.chipClassName
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs leading-5 text-gray-700">
                    理由：{candidate.reasons.join("、")}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className={cn("text-xs font-bold", dueClass)}>
                      {days < 0
                        ? `期限切れ ${Math.abs(days)}日`
                        : days === 0
                        ? "納期は今日"
                        : `納期まで ${days}日`}
                    </p>
                    {stageMeta ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
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
    </section>
  );
}
