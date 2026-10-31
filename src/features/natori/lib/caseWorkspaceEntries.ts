import type { CaseNotificationAttempt } from "../types/caseReadModel";
import type { CaseWorkspaceRecord } from "../types/caseWorkspace";
import type { CaseWorkspaceLocation } from "./caseWorkspaceNavigation";
import { caseKnown, caseTurn, deriveCaseGuidance } from "./caseWorkspacePresentation";
import { isPaymentTimestamp } from "./clientPayment";
import {casePlannedBars} from "./casePlanning";
import type {CasePlanning} from "./caseScreenContext";

/** Closed (見送り) or archived (保管) cases: kept for the record, not part of the day-to-day schedule. */
/** 見積もりのメールを最後に送れた時刻。トーク一覧は、メッセージが無くてもこの案件を載せる。 */
export function caseQuoteSentAt(record: CaseWorkspaceRecord): string | null {
  const sent = (caseKnown(record.model.facts.notifications) ?? [])
    .filter(n => n.purpose === "quote_notice" && n.status === "sent" && n.sentAt)
    .map(n => n.sentAt as string).sort();
  return sent.length ? sent[sent.length - 1] : null;
}

export function caseShelved(record: CaseWorkspaceRecord): boolean {
  return record.model.eligibility==="closed"||record.model.eligibility==="archived";
}

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
  // A case belongs to one turn only, the one of its first wait, so the counts add up the way the すべて list groups them.
  if (nav.filter!=="all" && nav.filter!=="completed" && caseTurn(guidance)!==nav.filter) return false;
  if (nav.entry==="schedule" && caseShelved(record)) return false;
  if (nav.entry==="schedule" && record.registeredDueDate!==nav.date && !casePlannedBars(record,plans??null,today).some(b=>b.startISO<=nav.date&&b.endISO>=nav.date)) return false;
  // トーク: every case that has a talk, plus one whose talk could not be read (never hidden as "no talk").
  // トーク lists only cases still in motion; finished or shelved talks stay reachable from the case itself.
  if (nav.entry==="notifications" && ["closed","archived","completed","historical"].includes(record.model.eligibility)) return false;
  if (nav.entry==="notifications") return record.display.conversation.state==="ready"||record.display.conversation.state==="unavailable"||caseQuoteSentAt(record)!==null;
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
