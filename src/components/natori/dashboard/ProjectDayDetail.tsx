"use client";

import { CalendarRange, Flag, Star, Zap } from "lucide-react";
import { natoriStageMeta } from "@/lib/natori/mockProjects";
import { getActiveBarsForDate, parseISODate } from "@/lib/natori/projects";
import { getDeliveryPlanMeta } from "@/lib/natori/deliveryPlans";
import { cn } from "@/lib/utils";
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
  allProjects: NatoriProject[];
  projects: NatoriProject[];
  today: Date;
  onToggleTask: (projectId: string, taskId: string) => void;
};

export default function ProjectDayDetail({
  selectedISO,
  allProjects,
  projects,
  today,
  onToggleTask,
}: ProjectDayDetailProps) {
  const date = parseISODate(selectedISO);
  const dateLabel = detailDateFormatter.format(date);
  const activeBars = getActiveBarsForDate(allProjects, selectedISO, today);
  const deliveryEndBars = activeBars.filter(
    (entry) => entry.bar.stage === "delivery" && entry.isEnd
  );

  const dueProjectIds = new Set(projects.map((project) => project.id));
  const activeOnlyProjects: NatoriProject[] = [];
  const seenActiveIds = new Set<string>();
  for (const entry of activeBars) {
    const project = entry.bar.project;
    if (dueProjectIds.has(project.id)) continue;
    if (seenActiveIds.has(project.id)) continue;
    seenActiveIds.add(project.id);
    activeOnlyProjects.push(project);
  }
  const cardProjects: NatoriProject[] = [...projects, ...activeOnlyProjects];

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
            稼働中のタスク {activeBars.length} 件 / 納期 {projects.length} 件
          </p>
        </div>
      </div>

      {deliveryEndBars.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 sm:p-4">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <div className="min-w-0">
            <p className="font-black">この日の納品 {deliveryEndBars.length} 件</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {deliveryEndBars.map((entry) => (
                <li
                  key={entry.bar.id}
                  className="rounded-full border border-emerald-500 bg-white px-2 py-0.5 text-xs font-bold text-emerald-800"
                >
                  {entry.bar.project.clientName}｜{entry.bar.project.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {activeBars.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-700">
            <Flag className="h-4 w-4" aria-hidden />
            この日のタスク
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {activeBars.map((entry) => {
              const stage = natoriStageMeta[entry.bar.stage];
              const isDelivery = entry.bar.stage === "delivery";
              const deliveryPlanMeta = getDeliveryPlanMeta(entry.bar.project.deliveryPlan);
              return (
                <li
                  key={entry.bar.id}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg bg-white px-3 py-2 text-sm",
                    stage.borderLeftClassName,
                    entry.isOverdue && "border-l-2 border-red-500"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 shrink-0 rounded-full",
                        entry.isOverdue ? "bg-red-500" : stage.dotClassName
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 break-words font-bold text-gray-900">
                      {entry.bar.project.clientName}｜{entry.bar.project.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                        stage.chipClassName
                      )}
                    >
                      {stage.label}
                    </span>
                    {deliveryPlanMeta.isRush ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          deliveryPlanMeta.chipClassName
                        )}
                        title={deliveryPlanMeta.label}
                      >
                        <Zap className="h-3 w-3" aria-hidden />
                        {deliveryPlanMeta.shortLabel}
                      </span>
                    ) : null}
                    {entry.isEnd ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                          isDelivery
                            ? "bg-emerald-600 text-white"
                            : "border border-amber-400 bg-amber-50 text-amber-900"
                        )}
                      >
                        {isDelivery ? "★ 納品日" : "目安締切"}
                      </span>
                    ) : entry.isStart ? (
                      <span className="shrink-0 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700">
                        開始
                      </span>
                    ) : null}
                  </div>
                  {entry.pendingTasks.length > 0 ? (
                    <p className="break-words pl-4 text-xs leading-5 text-gray-700">
                      残タスク：{entry.pendingTasks.map((task) => task.label).join("・")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {cardProjects.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-800">
          この日に予定はありません。ゆっくり手を動かせます。
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {projects.length > 0 ? (
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
              この日が納期の案件
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                today={today}
                onToggleTask={onToggleTask}
              />
            ))}
          </div>
          {activeOnlyProjects.length > 0 ? (
            <>
              <p className="pt-2 text-xs font-bold uppercase tracking-wide text-gray-600">
                この日に手を動かす案件
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activeOnlyProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    today={today}
                    onToggleTask={onToggleTask}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
