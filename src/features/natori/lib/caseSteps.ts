import type { CaseSection, CaseWorkspaceRecord } from "../types/caseWorkspace";
import { caseKnown, caseMoney, caseQuoteDraftOnly, caseTime } from "./caseWorkspacePresentation";

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
  if (caseUsesExternalSteps(record)) return deriveExternalCaseSteps(record);
  const { model: m, display: d } = record;
  const project = caseKnown(d.project), quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment);
  const delivery = caseKnown(m.facts.delivery), receipt = caseKnown(d.receipt), tasks = caseKnown(d.tasks);
  const quoteDraft = !quote && caseQuoteDraftOnly(m.facts.quote);
  const quoteUnread = !quote && !quoteDraft && (m.facts.quote.state === "unavailable" || m.facts.quote.state === "not_requested");
  const accepted = m.agreement === "accepted" && !!quote?.acceptance;
  const tasksDone = !!tasks?.length && tasks.every(task => task.done);
  const completed = project?.rawStatus === "completed";
  const ended = !receipt && !completed && (!!project?.archivedAt || project?.rawStatus === "closed");
  const reached = receipt || completed ? CASE_STEP_KEYS.length : delivery ? 5 : payment ? tasksDone ? 4 : 3
    : accepted ? 2 : quote || quoteDraft || quoteUnread ? 1 : 0;
  const summaries: Record<CaseStepKey, string | null> = {
    consultation: null,
    quote: quote?.acceptance && accepted ? `${caseMoney(quote.acceptance.money)}でOK（${quote.version > 1 ? `${quote.version}回目の見積` : "見積"}）`
      : quote ? `${caseMoney(quote.money)}・${quote.state === "draft" ? "下書き" : m.agreement === "needs_review" ? "要確認" : "お客さんの返事待ち"}`
        : quoteDraft ? "下書き" : quoteUnread ? "読み込めませんでした" : null,
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

/**
 * A case registered by hand that has not used the site's quote or payment link.
 * Once a quote is sent or a link exists, the site's own steps apply again.
 * An unsent quote draft does not count: saving one must not switch the steps.
 */
export function caseUsesExternalSteps(record: CaseWorkspaceRecord): boolean {
  const f = record.model.facts;
  return caseKnown(f.project)?.origin === "external" && (f.quote.state === "absent" || caseQuoteDraftOnly(f.quote)) && f.link.state === "absent";
}
/** Labels for orders taken outside the site (つなぐ, SNS, mail). Quote and payment happen there, so they are one step. */
export const EXTERNAL_CASE_STEP_LABELS: Partial<Record<CaseStepKey, string>> = {
  consultation: "依頼", quote: "金額・入金", production: "制作", delivery: "納品", receipt: "完了",
};
const EXTERNAL_KEYS: readonly CaseStepKey[] = ["consultation", "quote", "production", "delivery", "receipt"];

/**
 * Steps for an order taken outside the site. Built only from facts the site
 * records for such cases: the registered amount, a recorded payment, the
 * production tasks, the delivery and the completion. No quote or 受け取り is expected.
 */
function deriveExternalCaseSteps(record: CaseWorkspaceRecord): CaseStep[] {
  const { model: m, display: d } = record;
  const project = caseKnown(m.facts.project), payment = caseKnown(d.payment), delivery = caseKnown(m.facts.delivery);
  const tasks = caseKnown(d.tasks) ?? [];
  const work = tasks.filter(task => task.stage !== "material");
  const tasksDone = work.length > 0 && work.every(task => task.done);
  const started = work.some(task => task.done);
  const status = project?.rawStatus;
  const completed = status === "completed" || !!caseKnown(d.receipt);
  const delivered = !!delivery || status === "delivered";
  const ended = !completed && (!!project?.archivedAt || status === "closed");
  const reached = completed ? EXTERNAL_KEYS.length : delivered ? 4 : payment || started ? tasksDone ? 3 : 2 : 1;
  const amount = project?.administrativeAmount;
  const summaries: Partial<Record<CaseStepKey, string | null>> = {
    consultation: null,
    quote: payment ? `${caseMoney(payment.money ?? amount ?? null)}・入金済み` : amount ? `${caseMoney(amount)}・入金はまだ` : "金額はまだ",
    production: work.length ? `${work.filter(task => task.done).length}/${work.length}工程 完了` : project?.type === "undecided" ? "依頼の種類を選ぶと工程ができます" : null,
    delivery: delivery ? `納品済み（${caseTime(delivery.recordedAt)}）` : status === "delivered" ? "納品済み" : null,
    receipt: completed ? "完了" : null,
  };
  return EXTERNAL_KEYS.map((key, index) => ({
    key, label: EXTERNAL_CASE_STEP_LABELS[key] ?? CASE_STEP_LABELS[key], section: CASE_STEP_SECTIONS[key], summary: summaries[key] ?? null,
    state: index < reached ? "done" : index === reached && !ended ? "current" : "upcoming",
  }));
}
