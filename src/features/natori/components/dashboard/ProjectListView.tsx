"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import { isProjectOverdue } from "@/features/natori/lib/projects";
import { formatNatoriProjectDueDate } from "@/features/natori/lib/projectReadModel";
import type { UpdateNatoriProjectDetailsInput } from "@/features/natori/data/supabaseProjects";
import type { NatoriProject } from "@/features/natori/types/projects";
import { cn } from "@/lib/utils";
import ProjectCard from "./ProjectCard";

type ProjectListViewProps = {
  /** 進行中の案件（見送り・アーカイブを除く）。 */
  projects: NatoriProject[];
  today: Date;
  onToggleTask: (projectId: string, taskId: string) => void;
  onAdvanceStatus?: (project: NatoriProject) => void;
  onConfirmPayment?: (project: NatoriProject) => void;
  onOpenMail?: (project: NatoriProject, kind: "rough" | "delivery") => void;
  onEditDetails?: (
    project: NatoriProject,
    patch: UpdateNatoriProjectDetailsInput
  ) => Promise<void>;
  advanceBusyId?: string | null;
};

const dueFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function formatDue(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return dueFormatter.format(new Date(year, month - 1, day));
}

/** 進行中の案件を納期の近い順に並べた一覧。行をタップすると案件カードが開く。 */
export default function ProjectListView({
  projects,
  today,
  onToggleTask,
  onAdvanceStatus,
  onConfirmPayment,
  onOpenMail,
  onEditDetails,
  advanceBusyId,
}: ProjectListViewProps) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (a.dueDate === b.dueDate) return 0;
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate < b.dueDate ? -1 : 1;
      }),
    [projects]
  );

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (sorted.length === 0) {
    return (
      <p className={`${natoriAdminUi.card} text-sm text-gray-800`}>
        進行中の案件はありません。
      </p>
    );
  }

  return (
    <section aria-label="進行中の案件一覧" className={natoriAdminUi.card}>
      <p className={`mb-3 ${natoriAdminUi.caption}`}>
        進行中 {sorted.length} 件を納期の近い順に表示しています。行をタップすると詳細が開きます。
      </p>
      <ul className="space-y-2">
        {sorted.map((project) => {
          const open = openIds.has(project.id);
          const meta = natoriProjectStatusMeta[project.status];
          const overdue = isProjectOverdue(project, today);
          const panelId = `project-list-panel-${project.id}`;
          return (
            <li key={project.id} className="rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => toggle(project.id)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-[#FFF8FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 break-words text-sm font-black text-gray-900">
                      {project.title}
                    </span>
                    <span
                      className={cn(
                        "inline-block rounded-full border px-2 py-0.5 text-xs font-bold",
                        meta.chipClassName
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-xs text-gray-600">
                    {project.clientName}
                    <span className="mx-1.5 text-gray-400" aria-hidden>
                      ·
                    </span>
                    <span className={cn("font-bold", overdue ? "text-red-700" : "text-gray-800")}>
                      納期 {formatNatoriProjectDueDate(project.dueDate, formatDue)}
                      {overdue ? "（期限切れ）" : ""}
                    </span>
                  </p>
                  {project.nextAction ? (
                    <p className="mt-1 break-words text-xs text-gray-800">
                      次やること: {project.nextAction}
                    </p>
                  ) : null}
                </div>
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0 text-gray-600 transition-transform motion-reduce:transition-none",
                    open && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {open ? (
                <div id={panelId} className="border-t border-gray-100 p-3">
                  <ProjectCard
                    project={project}
                    today={today}
                    onToggleTask={onToggleTask}
                    onAdvanceStatus={onAdvanceStatus}
                    onConfirmPayment={onConfirmPayment}
                    onOpenMail={onOpenMail}
                    onEditDetails={onEditDetails}
                    advanceBusy={advanceBusyId === project.id}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
