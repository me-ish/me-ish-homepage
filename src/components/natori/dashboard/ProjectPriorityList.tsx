"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/lib/natori/mockProjects";
import { daysUntilDue } from "@/lib/natori/projects";
import type { NatoriPriorityCandidate } from "@/types/natori/projects";

type ProjectPriorityListProps = {
  suggestions: NatoriPriorityCandidate[];
  today: Date;
  onSelect: (project: NatoriPriorityCandidate) => void;
};

export default function ProjectPriorityList({ suggestions, today, onSelect }: ProjectPriorityListProps) {
  if (suggestions.length === 0) {
    return (
      <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold text-pink-700">今日のおすすめ順</p>
        <p className="mt-2 text-sm text-gray-600">進行中の案件はありません。少し休憩してもよさそうです。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-pink-700">今日のおすすめ順</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            納期・進捗・状態をもとに、まず触ると良い案件を並べています。
          </p>
        </div>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {suggestions.map((candidate, idx) => {
          const { project } = candidate;
          const meta = natoriProjectStatusMeta[project.status];
          const days = daysUntilDue(project.dueDate, today);
          return (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelect(candidate)}
                className="flex w-full items-start gap-3 rounded-2xl border border-pink-100 bg-pink-50/40 p-3 text-left hover:border-pink-300 hover:bg-pink-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500 text-sm font-black text-white">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 break-words text-sm font-black text-pink-950">
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
                  <p className="mt-1 break-words text-xs leading-5 text-gray-600">
                    理由：{candidate.reasons.join("、")}
                  </p>
                  <p className="mt-1 text-xs font-bold text-pink-700">
                    {days < 0
                      ? `期限切れ ${Math.abs(days)}日`
                      : days === 0
                      ? "納期は今日"
                      : `納期まで ${days}日`}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
