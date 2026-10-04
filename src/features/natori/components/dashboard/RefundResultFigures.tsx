import type { NatoriProject } from "../../types/projects";
import { getNatoriResultFinancials, getNatoriRefundStatusText, type NatoriResultsSummary } from "../../lib/results";
import { formatYen } from "../../lib/pricing";

const money = (value: number | null) => value === null ? "未確認" : formatYen(value);

export function RefundResultDetails({ project }: { project: NatoriProject }) {
  if (project.refunds === undefined) return null;
  const financials = getNatoriResultFinancials(project);
  return <div className="mt-2 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-2 text-xs text-zinc-700">
    <p>元の入金 {money(financials.gross)} / 確定返金 {money(financials.refunded)} / 純入金 {money(financials.net)}</p>
    <p className="mt-0.5 font-semibold">{getNatoriRefundStatusText(project)}</p>
  </div>;
}

export function RefundResultsSummary({ summary }: { summary: NatoriResultsSummary }) {
  return <section aria-label="返金と純入金" className="rounded-2xl border border-zinc-200/80 bg-white p-3 text-sm text-zinc-700 sm:p-4">
    <dl className="flex flex-wrap gap-x-6 gap-y-2">
      <div><dt>元の入金</dt><dd className="font-bold">{formatYen(summary.totalAmount)}</dd></div>
      <div><dt>確定返金</dt><dd className="font-bold">{money(summary.totalRefundedAmount)}</dd></div>
      <div><dt>純入金</dt><dd className="font-bold">{money(summary.totalNetAmount)}</dd></div>
    </dl>
    <p className="mt-2 text-xs">純入金 = 元の入金 − 確定返金。未確定・失敗・元の入金と未照合の返金は、確定返金額に含めません。案件の進行状態と納品承認は保持されます。</p>
    {summary.refundPendingCount > 0 ? <p className="mt-1 text-xs">返金処理中 {summary.refundPendingCount}件</p> : null}
    {summary.refundReviewCount > 0 ? <p className="mt-1 text-xs font-semibold">返金要確認 {summary.refundReviewCount}件</p> : null}
    {summary.totalNetAmount === null ? <p role="status" className="mt-1 text-xs font-semibold">{summary.totalRefundedAmount === null
      ? "返金履歴が未確認または未取得のため、確定返金額と純入金額は確定していません。"
      : "元の入金額が不明な案件があるため、純入金額は未確認です。確定返金額は記録された合計です。"}</p> : null}
  </section>;
}
