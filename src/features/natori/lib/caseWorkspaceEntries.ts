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
  // トーク: every case that has a talk, plus one whose talk could not be read (never hidden as "no talk").
  if (nav.entry==="notifications") return record.display.conversation.state==="ready"||record.display.conversation.state==="unavailable";
  return true;
}
export function caseMonthDays(month: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  return Array.from({length:31},(_,i)=>`${month}-${String(i+1).padStart(2,"0")}`)
    .filter(day=>isPaymentTimestamp(`${day}T00:00:00Z`));
}
export const CASE_NOTICE_PURPOSES: Record<CaseNotificationAttempt["purpose"],string> = {
  quote_notice:"見積のメール",payment_notice:"支払いのメール",delivery_notice:"納品のメール",receipt_notice:"受け取りのお知らせ",
  rough_notice:"ラフのメール",consultation_notice:"相談のメール",staff_notice:"あなたへのお知らせ",
};
export function caseNoticeLabel(row: CaseNotificationAttempt): string {
  return row.status==="sent" ? "送信しました"
    : row.status==="state_error" ? row.sentAt?"送信しました（記録は要確認）":"要確認：送れたか分かりません"
      : row.status==="unknown" ? "送れたか分かりません"
        : row.status==="failed" ? "送れませんでした"
          : row.status==="sending" ? "送信中" : "送信待ち";
}
