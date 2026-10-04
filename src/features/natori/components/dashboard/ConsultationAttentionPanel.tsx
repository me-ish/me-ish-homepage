"use client";

import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { NatoriLoadError } from "./NatoriLoadError";
import Link from "next/link";
import { ArrowRight, ChevronRight, MessagesSquare } from "lucide-react";
import type { NatoriProject } from "@/features/natori/types/projects";
import { compareConsultationActivity, consultationNeedsAttention, consultationReplyState, staffConsultationHref } from "@/features/natori/lib/consultationOverview";
import ConsultationStatus from "./ConsultationStatus";

export default function ConsultationAttentionPanel({ projects, loading, onRefresh }: {
  projects: NatoriProject[] | null; loading: boolean; onRefresh: () => void;
}) {
  const attention = projects?.filter(consultationNeedsAttention).sort(compareConsultationActivity);
  const active = projects?.filter(project => !project.deletedAt && project.status !== "closed");
  const count = (state: ReturnType<typeof consultationReplyState>) => active?.filter(project => consultationReplyState(project) === state).length ?? 0;
  const counts = [
    { label: "新規", value: count("new"), emphasis: false },
    { label: "ナトリの返信待ち", value: count("staff"), emphasis: true },
    { label: "依頼者の返信待ち", value: count("client"), emphasis: false },
  ];
  return (
    <section aria-label="相談の確認" className={`${natoriAdminUi.card} mt-4 space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold leading-6 text-zinc-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-pink-50 text-[#DB2777] ring-1 ring-inset ring-pink-500/10">
            <MessagesSquare className="h-4 w-4" aria-hidden />
          </span>
          相談の確認
        </h2>
        <button type="button" onClick={onRefresh} disabled={loading} className={natoriAdminUi.btnSecondary}>相談状況を更新</button>
      </div>
      {loading ? <>
        <p role="status" className={natoriAdminUi.caption}>相談状況を確認しています</p>
        <NatoriSkeleton heightClassName="h-24" />
      </> : !projects ? <NatoriLoadError resourceLabel="相談状況" error="相談状況を取得できませんでした。" onRetry={onRefresh} /> : <>
        {projects.some(project => !project.consultation) ? <p role="alert" className={natoriAdminUi.alert.warning}>返信状況を取得できない案件があります。件数は確認できた分のみです。</p> : null}
        <div>
          <p className="flex flex-wrap gap-2 text-sm">
            {counts.map(item => (
              <span
                key={item.label}
                className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 ring-1 ring-inset ${
                  item.emphasis && item.value > 0
                    ? "bg-pink-50 text-[#9D174D] ring-pink-600/20"
                    : "bg-zinc-50 text-zinc-700 ring-zinc-500/15"
                }`}
              >
                {item.label}{" "}
                <b className="font-semibold tabular-nums text-zinc-900">{item.value}件</b>
              </span>
            ))}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-600">最新の相談メッセージから判定します。既読や、メールへの直接返信は反映されません。古い相談から表示しています。</p>
        </div>
        {attention?.length ? <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80">
          {attention.slice(0, 5).map(project => <li key={project.id}>
            <Link href={staffConsultationHref(project.id)} className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#831843] sm:px-4">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-100 to-pink-50 text-sm font-semibold text-[#9D174D] ring-1 ring-inset ring-pink-500/10">
                {Array.from(project.clientName.trim())[0] ?? "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 block break-words text-sm font-semibold leading-6 text-zinc-900">{project.clientName} · {project.title}</span>
                <ConsultationStatus project={project} />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>)}
        </ul> : <p className="rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-600">新規・ナトリの返信待ち・通知の要確認はありません。</p>}
        <Link href="/natori/inquiries?filter=attention" className={`${natoriAdminUi.btnLink} sm:min-h-10`}>要確認の相談をすべて見る{attention?.length ? `（${attention.length}件）` : ""}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </>}
    </section>
  );
}
