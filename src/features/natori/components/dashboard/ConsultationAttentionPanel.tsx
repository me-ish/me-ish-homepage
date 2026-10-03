"use client";

import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { NatoriLoadError } from "./NatoriLoadError";
import Link from "next/link";
import type { NatoriProject } from "@/features/natori/types/projects";
import { compareConsultationActivity, consultationNeedsAttention, consultationReplyState, staffConsultationHref } from "@/features/natori/lib/consultationOverview";
import ConsultationStatus from "./ConsultationStatus";

export default function ConsultationAttentionPanel({ projects, loading, onRefresh }: {
  projects: NatoriProject[] | null; loading: boolean; onRefresh: () => void;
}) {
  const attention = projects?.filter(consultationNeedsAttention).sort(compareConsultationActivity);
  const active = projects?.filter(project => !project.deletedAt && project.status !== "closed");
  const count = (state: ReturnType<typeof consultationReplyState>) => active?.filter(project => consultationReplyState(project) === state).length ?? 0;
  return (
    <section aria-label="相談の確認" className="mt-4 space-y-3 rounded-2xl border border-pink-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-pink-900">相談の確認</h2>
        <button type="button" onClick={onRefresh} disabled={loading} className={natoriAdminUi.btnSecondary}>相談状況を更新</button>
      </div>
      {loading ? <>
        <p role="status" className={natoriAdminUi.caption}>相談状況を確認しています</p>
        <NatoriSkeleton heightClassName="h-24" />
      </> : !projects ? <NatoriLoadError resourceLabel="相談状況" error="相談状況を取得できませんでした。" onRetry={onRefresh} /> : <>
        {projects.some(project => !project.consultation) ? <p role="alert" className="text-sm text-amber-800">返信状況を取得できない案件があります。件数は確認できた分のみです。</p> : null}
        <p className="text-sm">新規 {count("new")}件 · ナトリの返信待ち {count("staff")}件 · 依頼者の返信待ち {count("client")}件</p>
        <p className="text-xs text-gray-600">最新の相談メッセージから判定します。既読や、メールへの直接返信は反映されません。古い相談から表示しています。</p>
        {attention?.length ? <ul className="space-y-2">
          {attention.slice(0, 5).map(project => <li key={project.id}>
            <Link href={staffConsultationHref(project.id)} className="block rounded-xl border border-pink-100 p-3 hover:bg-pink-50">
              <span className="mb-1 block break-words text-sm font-bold">{project.clientName} · {project.title}</span>
              <ConsultationStatus project={project} />
            </Link>
          </li>)}
        </ul> : <p className="text-sm text-gray-600">新規・ナトリの返信待ち・通知の要確認はありません。</p>}
        <Link href="/natori/inquiries?filter=attention" className="inline-flex min-h-10 items-center text-sm font-bold text-pink-700 underline">要確認の相談をすべて見る{attention?.length ? `（${attention.length}件）` : ""}</Link>
      </>}
    </section>
  );
}
