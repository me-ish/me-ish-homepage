"use client";

// features/natori/components/dashboard/DashboardTodaySummary.tsx
// ダッシュボード上部の「今日の状況」カード。開いた瞬間に
// 「今日まず何をやるか」が分かるよう、案件データから
// イチオシ案件・進行中件数・直近の納期を1枚にまとめる。
// 詳細操作は案件管理ページへ誘導する。
import { useId } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, Sparkles } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
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
  const headingId = useId();

  const dueTone =
    nearestDays === null
      ? ""
      : nearestDays < 0
        ? natoriAdminUi.badgeTone.danger
        : nearestDays <= 2
          ? natoriAdminUi.badgeTone.warning
          : natoriAdminUi.badgeTone.neutral;

  return (
    <section aria-labelledby={headingId} className={`${natoriAdminUi.card} mt-4`}>
      <div className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="flex items-center gap-2 text-[16px] font-semibold leading-6 text-zinc-900"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-pink-50 text-[#DB2777] ring-1 ring-inset ring-pink-500/10">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          今日の状況
        </h2>
        <Link
          href="/natori/projects"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#BE185D] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:min-h-0"
        >
          案件管理へ
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          進行中の案件はありません。少し休憩してもよさそうです。
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          {top ? (
            <Link
              href={`/natori/projects?project=${encodeURIComponent(top.project.id)}`}
              className="group col-span-2 flex min-w-0 items-start gap-3 rounded-xl border border-pink-200/70 bg-gradient-to-br from-pink-50 via-white to-white p-3.5 transition-colors hover:border-pink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] lg:col-span-1"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#BE185D] text-xs font-bold text-white shadow-[0_1px_2px_rgba(131,24,67,0.25)]">
                1
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold leading-5 text-[#BE185D]">最優先</span>
                <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="min-w-0 break-words text-sm font-semibold leading-6 text-zinc-900">
                    {top.project.clientName}｜{top.project.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
                      natoriProjectStatusMeta[top.project.status].chipClassName
                    )}
                  >
                    {natoriProjectStatusMeta[top.project.status].label}
                  </span>
                </span>
                <span className="mt-1 block break-words text-xs leading-5 text-zinc-600">
                  {top.reasons.join("、")}
                </span>
              </span>
              <ChevronRight
                className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ) : null}

          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5">
            <p className="text-xs font-medium leading-5 text-zinc-600">制作中</p>
            <p className="mt-1 flex items-baseline gap-1 text-zinc-900">
              <span className="text-[28px] font-semibold leading-8 tracking-tight tabular-nums">
                {working.length}
              </span>
              <span className="text-sm font-medium text-zinc-600">件</span>
            </p>
          </div>

          {nearest && nearestDays !== null ? (
            <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5">
              <p className="flex items-center gap-1 text-xs font-medium leading-5 text-zinc-600">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                直近の納期
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[20px] font-semibold leading-8 tracking-tight text-zinc-900 tabular-nums">
                  {formatDueDate(nearest.dueDate)}
                </span>
                <span className={`${natoriAdminUi.badge} ${dueTone}`}>
                  {nearestDays < 0
                    ? `${Math.abs(nearestDays)}日超過`
                    : nearestDays === 0
                      ? "今日"
                      : `あと${nearestDays}日`}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs leading-5 text-zinc-600">{nearest.title}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
