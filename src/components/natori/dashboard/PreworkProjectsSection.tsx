"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/lib/natori/mockProjects";
import { getAdvanceButtonLabel } from "@/lib/natori/projects";
import type { NatoriProject, NatoriProjectStatus } from "@/types/natori/projects";

// Pre-payment statuses surfaced in this panel. `awaiting_payment` has its own
// orange "入金確認してラフ開始" summary, so we keep it out of here to avoid
// duplicating that flow.
const PREWORK_DISPLAY_STATUSES: ReadonlySet<NatoriProjectStatus> = new Set([
  "inquiry",
  "estimating",
  "consulting",
  "quoted",
]);

const STATUS_SORT_ORDER: Record<NatoriProjectStatus, number> = {
  inquiry: 0,
  consulting: 0,
  estimating: 1,
  quoted: 2,
  awaiting_payment: 99,
  rough: 99,
  lineart: 99,
  coloring: 99,
  waiting: 99,
  delivery_prep: 99,
  delivered: 99,
  completed: 99,
};

type PreworkProjectsSectionProps = {
  projects: NatoriProject[];
  busyId?: string | null;
  onSelect: (project: NatoriProject) => void;
  onAdvanceStatus: (project: NatoriProject) => void;
};

export default function PreworkProjectsSection({
  projects,
  busyId,
  onSelect,
  onAdvanceStatus,
}: PreworkProjectsSectionProps) {
  const prework = useMemo(
    () =>
      projects
        .filter((project) => PREWORK_DISPLAY_STATUSES.has(project.status))
        .sort((a, b) => {
          const diff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
          if (diff !== 0) return diff;
          return a.dueDate.localeCompare(b.dueDate);
        }),
    [projects]
  );

  // Open by default — these are the case that's not surfaced elsewhere on the
  // dashboard, so the user shouldn't have to expand a panel to find them.
  const [open, setOpen] = useState(true);

  if (prework.length === 0) return null;

  return (
    <section className="rounded-2xl border border-pink-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-pink-50/60 sm:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-white">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              依頼・見積もり中 {prework.length}件
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              ラフ制作前の案件です。次の操作で工程を進められます。
            </p>
          </div>
        </div>
        <span className="shrink-0 text-gray-500">
          {open ? (
            <ChevronUp className="h-5 w-5" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5" aria-hidden />
          )}
        </span>
      </button>

      {open ? (
        <ul className="flex flex-col gap-2 border-t border-pink-100 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          {prework.map((project) => {
            const meta = natoriProjectStatusMeta[project.status];
            const label = getAdvanceButtonLabel(project.status);
            const busy = busyId === project.id;
            return (
              <li
                key={project.id}
                className="flex flex-col gap-2 rounded-2xl border border-pink-200 bg-pink-50/40 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  onClick={() => onSelect(project)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-pink-50"
                >
                  <div className="min-w-0">
                    <p className="min-w-0 break-words text-sm font-black text-gray-900">
                      {project.clientName}｜{project.title}
                    </p>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        meta.chipClassName
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                </button>
                {label ? (
                  <button
                    type="button"
                    onClick={() => onAdvanceStatus(project)}
                    disabled={busy}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-pink-500 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-pink-600 disabled:opacity-60"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    {busy ? "更新中…" : label}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
