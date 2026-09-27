import { consultationReplyLabel } from "@/features/natori/lib/consultationOverview";
import type { NatoriProject } from "@/features/natori/types/projects";

export default function ConsultationStatus({ project }: { project: NatoriProject }) {
  const info = project.consultation;
  if (info === undefined) return null; // Demo data has no live projection.
  return <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" data-consultation-status>
    <span className="font-bold text-gray-800">{consultationReplyLabel(project)}</span>
    {info?.latestMessageAt ? <span className="text-gray-500">最終発言：{info.latestSender === "staff" ? "ナトリ" : "依頼者"}・{new Intl.DateTimeFormat("ja-JP", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(info.latestMessageAt))}</span> : null}
    {info && info.notificationFailed > 0 ? <span className="font-bold text-red-700">通知失敗・要確認 {info.notificationFailed}件</span> : null}
    {info && info.notificationPending > 0 ? <span className="text-amber-800">通知未送信・処理中 {info.notificationPending}件</span> : null}
  </span>;
}
