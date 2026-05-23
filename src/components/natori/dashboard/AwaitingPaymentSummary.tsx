"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysUntilDue } from "@/lib/natori/projects";
import type { NatoriAwaitingPaymentSummary } from "@/lib/natori/scheduling";
import type { NatoriProject } from "@/types/natori/projects";

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

type AwaitingPaymentSummaryProps = {
  summary: NatoriAwaitingPaymentSummary;
  today: Date;
  onSelect: (project: NatoriProject) => void;
};

export default function AwaitingPaymentSummary({
  summary,
  today,
  onSelect,
}: AwaitingPaymentSummaryProps) {
  const [open, setOpen] = useState(false);
  if (summary.count === 0) return null;

  return (
    <section className="rounded-2xl border border-orange-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-orange-50/60 sm:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Wallet className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              着金待ち {summary.count}件・{yenFormatter.format(summary.totalAmount)}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              着金前は重作業に進まない方針。入金確認を優先しましょう。
            </p>
          </div>
        </div>
        <span className="shrink-0 text-gray-500">
          {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </span>
      </button>

      {open ? (
        <ul className="flex flex-col gap-2 border-t border-orange-100 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          {summary.projects.map((project) => {
            const days = daysUntilDue(project.dueDate, today);
            const dueText =
              days < 0 ? `納期超過 ${Math.abs(days)}日` : days === 0 ? "納期は今日" : `納期まで ${days}日`;
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onSelect(project)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50/40 px-3 py-2 text-left transition hover:border-orange-400 hover:bg-orange-50"
                >
                  <div className="min-w-0">
                    <p className="min-w-0 break-words text-sm font-black text-gray-900">
                      {project.clientName}｜{project.title}
                    </p>
                    <p className={cn("mt-0.5 text-[11px] font-bold", days < 0 ? "text-red-700" : "text-orange-800")}>
                      {dueText}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-gray-900">
                    {yenFormatter.format(project.amount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
