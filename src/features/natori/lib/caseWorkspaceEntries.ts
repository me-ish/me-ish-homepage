import type { CaseNotificationAttempt } from "../types/caseReadModel";
import type { CaseWorkspaceRecord } from "../types/caseWorkspace";
import type { CaseWorkspaceLocation } from "./caseWorkspaceNavigation";
import { caseKnown, deriveCaseGuidance } from "./caseWorkspacePresentation";
import { isPaymentTimestamp } from "./clientPayment";
import {casePlannedBars} from "./casePlanning";
import type {CasePlanning} from "./caseScreenContext";

export function matchesCaseEntry(record: CaseWorkspaceRecord, nav: CaseWorkspaceLocation,plans?:CasePlanning|null,today=nav.date): boolean {
  const guidance=deriveCaseGuidance(record), project=caseKnown(record.display.project);
  const roughReview=caseKnown(record.model.facts.roughs)?.some(r=>r.clientOkAt&&!r.acknowledgedAt&&!r.supersededBy)??false;
  const ended=record.model.eligibility==="closed"||record.model.eligibility==="archived";
  if(nav.intakeFilter==="ended"&&!ended)return false;
  if(nav.source==="inquiries"&&nav.intakeFilter!=="ended"&&ended&&!roughReview)return false;
  if(nav.intakeFilter==="rough-ok"&&!roughReview)return false;
  if(nav.intakeFilter==="attention"&&!roughReview&&!record.model.attention.length&&!guidance.unknown.length&&!guidance.waits.some(w=>w.who==="staff"))return false;
  if(nav.intakeFilter==="inquiry"&&record.model.stage!=="consultation")return false;
  if(nav.intakeFilter==="estimating"&&record.model.stage!=="quote_draft")return false;
  if(nav.intakeFilter==="quoted"&&record.model.facts.quote.state!=="ready")return false;
  if(nav.intakeFilter==="awaiting_payment"&&(record.model.agreement!=="accepted"||record.model.facts.payment.state==="ready"||!guidance.waits.some(w=>w.who==="client"&&w.section==="transaction")))return false;
  if (!`${record.title} ${record.clientLabel}`.toLocaleLowerCase("ja").includes(nav.query.toLocaleLowerCase("ja"))) return false;
  if (nav.filter==="completed" && project?.rawStatus!=="completed" && !caseKnown(record.display.receipt)) return false;
  if (nav.filter!=="all" && nav.filter!=="completed" && !guidance.waits.some(wait=>wait.who===nav.filter)) return false;
  if (nav.entry==="schedule" && record.registeredDueDate!==nav.date && !casePlannedBars(record,plans??null,today).some(b=>b.startISO<=nav.date&&b.endISO>=nav.date)) return false;
  if (nav.entry==="notifications") {
    const observation=record.model.facts.notifications;
    return observation.state!=="ready" && observation.state!=="absent"
      || Boolean(caseKnown(observation)?.length)
      || record.model.attention.some(a=>a.domain==="notifications" || a.reason.includes("notice"))
      || (record.model.agreement==="accepted" && !caseKnown(record.display.payment) && !caseKnown(record.display.receipt)
        && !project?.archivedAt && project?.rawStatus!=="closed" && project?.rawStatus!=="completed");
  }
  return true;
}
export function caseMonthDays(month: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  return Array.from({length:31},(_,i)=>`${month}-${String(i+1).padStart(2,"0")}`)
    .filter(day=>isPaymentTimestamp(`${day}T00:00:00Z`));
}
export const CASE_NOTICE_PURPOSES: Record<CaseNotificationAttempt["purpose"],string> = {
  quote_notice:"見積の案内",payment_notice:"支払案内",delivery_notice:"納品案内",receipt_notice:"受取の通知",
  rough_notice:"ラフの通知",consultation_notice:"相談の通知",staff_notice:"担当者への通知",
};
export function caseNoticeLabel(row: CaseNotificationAttempt): string {
  return row.status==="sent" ? "送信サービス受付済み"
    : row.status==="state_error" ? row.sentAt?"送信受付済み・保存結果は要確認":"送信受付の保存結果は要確認"
      : row.status==="unknown" ? "受付結果は未確認"
        : row.status==="failed" ? "確定した失敗の記録"
          : row.status==="sending" ? "送信処理中の記録" : "送信待ちの記録";
}
