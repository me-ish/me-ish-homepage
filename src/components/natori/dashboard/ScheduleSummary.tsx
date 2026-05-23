"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock4, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/lib/natori/mockProjects";
import { getDeliveryPlanMeta } from "@/lib/natori/deliveryPlans";
import {
  WORKDAYS_PER_WEEK,
  formatHours,
  type NatoriScheduleEntry,
  type NatoriWeeklyForecast,
} from "@/lib/natori/scheduling";

type ScheduleSummaryProps = {
  entries: NatoriScheduleEntry[];
  forecast: NatoriWeeklyForecast;
  onSelect: (entry: NatoriScheduleEntry) => void;
};

export default function ScheduleSummary({ entries, forecast, onSelect }: ScheduleSummaryProps) {
  const [open, setOpen] = useState(false);
  const utilizationPercent = Math.min(200, Math.round(forecast.utilizationThisWeek * 100));
  const overCapacity = forecast.utilizationThisWeek > 1;
  const visibleEntries = entries.filter((entry) => !entry.scheduling.isBlocked);

  return (
    <section className="rounded-2xl border border-pink-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-pink-50/50 sm:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-white">
            <Clock4 className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">時間配分（今週・今日）</p>
            <p className="mt-0.5 text-xs text-gray-600">
              カレンダーの色帯に被ってる作業を集計。今週 {formatHours(forecast.totalRequiredThisWeek)} / 容量 {formatHours(forecast.capacityThisWeek)}
              （{utilizationPercent}%）・今日 {formatHours(forecast.totalRequiredToday)}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-gray-500">
          {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </span>
      </button>

      {open ? (
        <div className="border-t border-pink-100 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">今週やる予定（色帯ベース）</p>
                <p className="text-2xl font-black text-pink-900">
                  {formatHours(forecast.totalRequiredThisWeek)}
                  <span className="ml-1 text-sm font-bold text-pink-700/80">
                    / {formatHours(forecast.capacityThisWeek)}
                  </span>
                </p>
                {forecast.rushRequiredThisWeek > 0 ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
                    <Zap className="h-3 w-3" aria-hidden />
                    お急ぎ分 {formatHours(forecast.rushRequiredThisWeek)}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">今日やる予定</p>
                <p className="text-2xl font-black text-pink-900">{formatHours(forecast.totalRequiredToday)}</p>
                <p className="text-[11px] text-pink-700/80">平日1日 {forecast.dailyCapacityHours}h まで</p>
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/80">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  overCapacity ? "bg-red-500" : "bg-pink-500"
                )}
                style={{ width: `${Math.min(100, utilizationPercent)}%` }}
                aria-hidden
              />
            </div>
            {overCapacity ? (
              <p className="mt-1 text-[11px] font-bold text-red-700">
                容量超過。お急ぎ案件の納期 or スケジュール調整を検討。
              </p>
            ) : null}
          </div>

          {visibleEntries.length === 0 ? (
            <p className="mt-3 rounded-xl border border-pink-100 bg-pink-50/30 p-3 text-xs text-pink-900">
              今すぐ手を動かすべき案件はありません。着金待ち・確認待ち案件があれば下のカードを確認してください。
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {visibleEntries.slice(0, 5).map((entry) => {
                const { project, scheduling } = entry;
                const statusMeta = natoriProjectStatusMeta[project.status];
                const planMeta = getDeliveryPlanMeta(project.deliveryPlan);
                const ratio = Math.min(
                  1,
                  scheduling.totalHours === 0
                    ? 0
                    : (scheduling.totalHours - scheduling.remainingHours) / scheduling.totalHours
                );
                const ratioPercent = Math.round(ratio * 100);
                const dueText =
                  scheduling.isOverdue
                    ? `期限切れ ${Math.abs(scheduling.daysUntilDue)}日`
                    : scheduling.daysUntilDue === 0
                    ? "納期は今日"
                    : `納期まで ${scheduling.daysUntilDue}日`;
                const weekDays = Math.min(WORKDAYS_PER_WEEK, scheduling.workableDaysUntilDue);

                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-2xl border bg-white p-3 text-left transition hover:border-pink-300 hover:bg-pink-50/30",
                        scheduling.isRush ? "border-red-200" : "border-gray-200"
                      )}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words text-sm font-black text-gray-900">
                          {project.clientName}｜{project.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            statusMeta.chipClassName
                          )}
                        >
                          {statusMeta.label}
                        </span>
                        {planMeta.isRush ? (
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              planMeta.chipClassName
                            )}
                          >
                            <Zap className="h-3 w-3" aria-hidden />
                            {planMeta.shortLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-700">
                        <span className={cn("font-bold", scheduling.isOverdue && "text-red-700")}>
                          {dueText}
                        </span>
                        <span>残 {formatHours(scheduling.remainingHours)}</span>
                        <span>1日 {formatHours(scheduling.requiredPerDay)}</span>
                        <span className="font-bold">
                          今週 {formatHours(scheduling.requiredThisWeek)}
                          {weekDays < WORKDAYS_PER_WEEK ? `（残${weekDays}日）` : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${ratioPercent}%` }}
                          aria-hidden
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
