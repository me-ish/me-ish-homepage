import type { CaseWorkspaceRecord } from "../types/caseWorkspace";
import { caseDate, caseDaysUntil } from "./caseWorkspacePresentation";
import { deriveCaseSteps } from "./caseSteps";

export type CaseTodayDue = { label: string; date: string | null; tone: "overdue" | "soon" | "later" | "none" };

/** 納期の書き方。色に頼らず「◯日超過」「今日まで」を文字で出す。案件一覧の行で使う。 */
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
