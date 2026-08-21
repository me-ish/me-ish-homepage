"use client";

// features/natori/components/dashboard/DashboardTodaySummary.tsx
// ダッシュボード上部の「今日の状況」カード。開いた瞬間に
// 「今日まず何をやるか」が分かるよう、案件データから
// イチオシ案件・進行中件数・直近の納期を1枚にまとめる。
// 詳細操作は案件管理ページへ誘導する。
import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import {
  daysUntilDue,
  getPrioritySuggestions,
  isInactiveStatus,
  isPreworkStatus,
} from "@/features/natori/lib/projects";
import { isActiveNatoriProject } from "@/features/natori/lib/projectReadModel";
import { cn } from "@/lib/utils";
import type { NatoriProject } from "@/features/natori/types/projects";

const dueDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function formatDueDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return dueDateFormatter.format(new Date(year, month - 1, day));
}

export default function DashboardTodaySummary({
  projects,
  today,
}: {
  projects: NatoriProject[];
  today: Date;
}) {
  const active = projects.filter(
    (project) => isActiveNatoriProject(project) && !isInactiveStatus(project.status)
  );
  const working = active.filter((project) => !isPreworkStatus(project.status));
  const top = getPrioritySuggestions(active, today, 1)[0];

  const nearest = working
    .filter(
      (project): project is NatoriProject & { dueDate: string } =>
        project.dueDate !== null
    )
    .reduce<NatoriProject & { dueDate: string } | null>(
    (best, project) =>
      !best || project.dueDate < best.dueDate ? project : best,
    null
  );
  const nearestDays = nearest ? daysUntilDue(nearest.dueDate, today) : null;

  return (
    <section className="mt-4 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-black text-gray-900">
          <Sparkles className="h-4 w-4 text-pink-500" aria-hidden />
          今日の状況
        </h2>
        <Link
          href="/natori/projects"
          className="inline-flex items-center gap-1 text-xs font-bold text-pink-700 hover:underline"
        >
          案件管理へ
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">
          進行中の案件はありません。少し休憩してもよさそうです。
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {top ? (
            <Link
              href={`/natori/projects?project=${encodeURIComponent(top.project.id)}`}
              className="flex min-w-0 items-start gap-2 rounded-xl border border-pink-100 bg-pink-50/40 p-2.5 transition hover:bg-pink-50"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500 text-xs font-black text-white">
                1
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="min-w-0 break-words text-sm font-black text-gray-900">
                    {top.project.clientName}｜{top.project.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      natoriProjectStatusMeta[top.project.status].chipClassName
                    )}
                  >
                    {natoriProjectStatusMeta[top.project.status].label}
                  </span>
                </span>
                <span className="mt-0.5 block break-words text-xs leading-5 text-gray-600">
                  {top.reasons.join("、")}
                </span>
              </span>
            </Link>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700">
            <span>
              制作中 <b className="text-sm text-gray-900">{working.length}</b> 件
            </span>
            {nearest && nearestDays !== null ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                直近の納期:
                <span className="min-w-0 truncate font-bold text-gray-900">
                  {nearest.title}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-bold",
                    nearestDays < 0
                      ? "text-red-700"
                      : nearestDays <= 2
                        ? "text-amber-700"
                        : "text-gray-900"
                  )}
                >
                  {formatDueDate(nearest.dueDate)}
                  {nearestDays < 0
                    ? `（${Math.abs(nearestDays)}日超過）`
                    : nearestDays === 0
                      ? "（今日）"
                      : `（あと${nearestDays}日）`}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
