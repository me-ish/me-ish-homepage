import type { CaseSection, CaseWorkspaceRecord } from "../types/caseWorkspace";
import { caseDate, caseDaysUntil, deriveCaseGuidance } from "./caseWorkspacePresentation";
import { matchesCaseEntry } from "./caseWorkspaceEntries";
import { parseCaseWorkspaceLocation } from "./caseWorkspaceNavigation";
import { deriveCaseSteps } from "./caseSteps";

export type CaseTodayDue = { label: string; date: string | null; tone: "overdue" | "soon" | "later" | "none" };
export type CaseTodayItem = {
  id: string; title: string; clientLabel: string;
  /** The case's own next step (first wait of deriveCaseGuidance), e.g. 「支払いリンクを送る」. */
  action: string; section: CaseSection; due: CaseTodayDue;
};

/** 納期の書き方。色に頼らず「◯日超過」「今日まで」を文字で出す。 */
export function caseTodayDue(record: CaseWorkspaceRecord, today: string): CaseTodayDue {
  const due = record.registeredDueDate;
  if (!due) return { label: "納期なし", date: null, tone: "none" };
  const date = caseDate(due, today);
  // 一覧の納期バッジと同じく、納品したあとは納期を急がせない。
  if (deriveCaseSteps(record).find(step => step.state === "current")?.key === "receipt") return { label: `納期 ${date}`, date, tone: "later" };
  const days = caseDaysUntil(due, today);
  return days < 0 ? { label: `${-days}日超過`, date, tone: "overdue" }
    : days === 0 ? { label: "今日まで", date, tone: "soon" }
      : days === 1 ? { label: "明日まで", date, tone: "soon" }
        : { label: `あと${days}日`, date, tone: days <= 3 ? "soon" : "later" };
}

/**
 * 「今日やること」: 案件一覧の「自分の番」と同じ案件を、納期の近い順に並べる。
 * やることの文言と開く画面は deriveCaseGuidance の最初のやること（案件を開いた時の「次にやること」）をそのまま使う。
 */
export function deriveCaseTodayList(records: readonly CaseWorkspaceRecord[], today: string): CaseTodayItem[] {
  const staffTurn = parseCaseWorkspaceLocation("?entry=cases&filter=staff", today);
  const items: CaseTodayItem[] = [];
  const dueOf = (record: CaseWorkspaceRecord) => record.registeredDueDate ?? "9999-12-31";
  const mine = records.filter(record => matchesCaseEntry(record, staffTurn, null, today))
    .sort((a, b) => dueOf(a).localeCompare(dueOf(b)) || a.id.localeCompare(b.id));
  for (const record of mine) {
    // 「自分の番」はメール確認以外の最初のやることで決まるので、ここでも同じものを出す。
    const wait = deriveCaseGuidance(record).waits.find(item => !item.mailCheck);
    if (!wait) continue;
    items.push({ id: record.id, title: record.title, clientLabel: record.clientLabel, action: wait.text,
      section: wait.section, due: caseTodayDue(record, today) });
  }
  return items;
}
