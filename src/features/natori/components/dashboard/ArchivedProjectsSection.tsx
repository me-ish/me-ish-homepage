"use client";

import { useState } from "react";
import { ArchiveRestore, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import type { NatoriProject } from "@/features/natori/types/projects";

type ArchivedProjectsSectionProps = {
  projects: NatoriProject[];
  busyId?: string | null;
  onRestore: (project: NatoriProject) => void;
};

function formatArchivedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function ArchivedProjectsSection({
  projects,
  busyId,
  onRestore,
}: ArchivedProjectsSectionProps) {
  const [open, setOpen] = useState(false);
  if (projects.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-gray-50 sm:p-4"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-600 text-white">
            <ArchiveRestore className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-bold text-gray-900">最近削除した案件 {projects.length}件</span>
            <span className="mt-0.5 block text-xs text-gray-600">データと画像は保持されています。ここから復元できます。</span>
          </span>
        </span>
        {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
      </button>

      {open ? (
        <ul className="space-y-2 border-t border-gray-200 p-3 sm:p-4">
          {projects.map((project) => {
            const archivedAt = formatArchivedAt(project.deletedAt);
            const busy = busyId === project.id;
            return (
              <li key={project.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-3">
                <span className="min-w-0">
                  <span className="block break-words text-sm font-bold text-gray-700">{project.clientName}・{project.title}</span>
                  {archivedAt ? <span className="mt-0.5 block text-xs text-gray-500">{archivedAt}に削除</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(project)}
                  disabled={busy}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-pink-300 bg-white px-3 text-xs font-bold text-pink-700 hover:bg-pink-50 disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  復元
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
