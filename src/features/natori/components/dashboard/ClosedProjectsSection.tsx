"use client";

import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import Link from "next/link";
import { staffConsultationHref } from "@/features/natori/lib/consultationOverview";
import ConsultationStatus from "./ConsultationStatus";
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
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-zinc-50 sm:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-500 text-white">
            <Archive className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900">
              見送りした相談 {projects.length}件
            </p>
            <p className="mt-0.5 text-xs text-zinc-600">
              条件がまとまらなかった相談の記録です。再依頼が来たら「依頼受付に戻す」で復帰できます。
            </p>
          </div>
        </div>
        <span className="shrink-0 text-zinc-500">
          {open ? (
            <ChevronUp className="h-5 w-5" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5" aria-hidden />
          )}
        </span>
      </button>

      {open ? (
        <ul className="flex flex-col gap-2 border-t border-zinc-200 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          {projects.map((project) => {
            const busy = busyId === project.id;
            const reason = extractCloseReason(project.note);
            return (
              <li
                key={project.id}
                className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="min-w-0 break-words text-sm font-bold text-zinc-700">
                    {project.clientName}｜{project.title}
                  </p>
                  {reason ? (
                    <p className="mt-0.5 break-words text-xs text-zinc-500">見送り {reason}</p>
                  ) : null}
                </div>
                {project.consultation !== undefined ? <div className="space-y-1"><ConsultationStatus project={project} /><Link href={staffConsultationHref(project.id)} className="inline-flex min-h-10 items-center text-sm font-bold text-[#BE185D] underline">相談履歴</Link></div> : null}
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onReopen(project)}
                    disabled={busy}
                    className={natoriAdminUi.btnSecondary}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    依頼受付に戻す
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(project)}
                    disabled={busy}
                    className={natoriAdminUi.btnDanger}
                    aria-label={`「${project.title}」を案件一覧から削除`}
                    title="案件一覧から削除（あとで復元できます）"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    一覧から削除
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
