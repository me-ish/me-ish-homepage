import type { CaseSection, CaseWorkspaceRecord } from "../types/caseWorkspace";
import { caseKnown, caseMoney, caseTime } from "./caseWorkspacePresentation";

export const CASE_STEP_KEYS = ["consultation", "quote", "payment", "production", "delivery", "receipt"] as const;
export type CaseStepKey = typeof CASE_STEP_KEYS[number];
export const CASE_STEP_LABELS: Record<CaseStepKey, string> = {
  consultation: "相談", quote: "見積", payment: "支払い", production: "制作", delivery: "納品", receipt: "受取",
};
/** Where each step's existing work area lives. Several steps share one area. */
export const CASE_STEP_SECTIONS: Record<CaseStepKey, CaseSection> = {
  consultation: "consultation", quote: "transaction", payment: "transaction",
  production: "production", delivery: "production", receipt: "production",
};
export type CaseStep = {
  key: CaseStepKey; label: string; section: CaseSection;
  state: "done" | "current" | "upcoming";
  summary: string | null;
};

/**
 * Display-only progress built from the same recorded facts as deriveCaseGuidance.
 * It never enables, disables or orders commands. An ended case has no current step.
 */
export function deriveCaseSteps(record: CaseWorkspaceRecord): CaseStep[] {
  const { model: m, display: d } = record;
  const project = caseKnown(d.project), quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment);
  const delivery = caseKnown(m.facts.delivery), receipt = caseKnown(d.receipt), tasks = caseKnown(d.tasks);
  const quoteUnread = !quote && (m.facts.quote.state === "unavailable" || m.facts.quote.state === "not_requested");
  const accepted = m.agreement === "accepted" && !!quote?.acceptance;
  const tasksDone = !!tasks?.length && tasks.every(task => task.done);
  const completed = project?.rawStatus === "completed";
  const ended = !receipt && !completed && (!!project?.archivedAt || project?.rawStatus === "closed");
  const reached = receipt || completed ? CASE_STEP_KEYS.length : delivery ? 5 : payment ? tasksDone ? 4 : 3
    : accepted ? 2 : quote || quoteUnread ? 1 : 0;
  const summaries: Record<CaseStepKey, string | null> = {
    consultation: null,
    quote: quote?.acceptance && accepted ? `${caseMoney(quote.acceptance.money)}でOK（${quote.version > 1 ? `${quote.version}回目の見積` : "見積"}）`
      : quote ? `${caseMoney(quote.money)}・${quote.state === "draft" ? "下書き" : m.agreement === "needs_review" ? "要確認" : "お客さんの返事待ち"}`
        : quoteUnread ? "読み込めませんでした" : null,
    payment: payment ? `${caseMoney(payment.money)}・入金済み（${caseTime(payment.confirmedAt)}）`
      : m.stage === "payment_notified" ? "お支払い待ち" : caseKnown(m.facts.link) ? "支払いリンク作成済み" : null,
    production: tasks?.length ? `${tasks.filter(task => task.done).length}/${tasks.length}工程 完了` : null,
    delivery: delivery ? `納品済み（${caseTime(delivery.recordedAt)}）` : null,
    receipt: receipt ? `受取済み（${caseTime(receipt.acceptedAt)}）` : null,
  };
  return CASE_STEP_KEYS.map((key, index) => ({
    key, label: CASE_STEP_LABELS[key], section: CASE_STEP_SECTIONS[key], summary: summaries[key],
    state: index < reached ? "done" : index === reached && !ended ? "current" : "upcoming",
  }));
}

/** The step whose area is open: the current one if it uses that area, else the latest finished one. */
export function caseStepForSection(steps: readonly CaseStep[], section: CaseSection): CaseStepKey | null {
  const candidates = steps.filter(step => step.section === section);
  return (candidates.find(step => step.state === "current") ?? [...candidates].reverse().find(step => step.state === "done") ?? candidates[0])?.key ?? null;
}
