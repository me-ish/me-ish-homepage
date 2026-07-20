"use client";

import { useState } from "react";
import { Archive, ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react";
import type { NatoriProject } from "@/features/natori/types/projects";

type ClosedProjectsSectionProps = {
  projects: NatoriProject[];
  busyId?: string | null;
  /** 見送りを取り消して「依頼受付」に戻す */
  onReopen: (project: NatoriProject) => void;
  /** 案件一覧から削除する（データは復元可能） */
  onDelete: (project: NatoriProject) => void;
};

/** メモ末尾の「【見送り YYYY-MM-DD】理由」を拾って一覧に出す */
function extractCloseReason(note?: string): string | null {
  if (!note) return null;
  const match = note.match(/【見送り (\d{4}-\d{2}-\d{2})】([\s\S]*)$/);
  if (!match) return null;
  const reason = match[2].trim();
  return reason ? `${match[1]}: ${reason}` : match[1];
}

export default function ClosedProjectsSection({
  projects,
  busyId,
  onReopen,
  onDelete,
}: ClosedProjectsSectionProps) {
  // 普段は目に入らなくていい情報なので折りたたみが既定
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
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-500 text-white">
            <Archive className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              見送りした相談 {projects.length}件
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              条件がまとまらなかった相談の記録です。再依頼が来たら「依頼受付に戻す」で復帰できます。
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
        <ul className="flex flex-col gap-2 border-t border-gray-200 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          {projects.map((project) => {
            const busy = busyId === project.id;
            const reason = extractCloseReason(project.note);
            return (
              <li
                key={project.id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="min-w-0 break-words text-sm font-bold text-gray-700">
                    {project.clientName}｜{project.title}
                  </p>
                  {reason ? (
                    <p className="mt-0.5 break-words text-xs text-gray-500">見送り {reason}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onReopen(project)}
                    disabled={busy}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-pink-300 bg-white px-3 text-xs font-bold text-pink-700 shadow-sm transition hover:bg-pink-50 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    依頼受付に戻す
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(project)}
                    disabled={busy}
                    className="grid h-9 w-9 place-items-center rounded-full border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
                    aria-label={`「${project.title}」を案件一覧から削除`}
                    title="案件一覧から削除（あとで復元できます）"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
