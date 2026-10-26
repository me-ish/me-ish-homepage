import type { CaseAttention, CaseObservation } from "../types/caseReadModel";
import type { CaseGuidance, CaseSection, CaseWorkspaceRecord } from "../types/caseWorkspace";

export const CASE_SECTION_LABELS: Record<CaseSection, string> = {
  overview: "概要", consultation: "相談", transaction: "取引", production: "制作・納品", history: "履歴",
};
export const CASE_WHO_LABELS = { staff: "担当者", client: "依頼者", system: "システム" } as const;
export function caseKnown<T>(value: CaseObservation<T>): T | undefined {
  return value.state === "ready" ? value.value : value.state === "unavailable" ? value.lastKnown?.value : undefined;
}
export function caseTime(value: string): string {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value)) : "日時未確認";
}
export function caseMoney(value: { amount: number; currency: string } | null | undefined): string {
  return value ? new Intl.NumberFormat("ja-JP", { style: "currency", currency: value.currency,
    maximumFractionDigits: 0 }).format(value.amount) : "金額未確認";
}
export function observationLabel(value: CaseObservation<unknown>, absent = "記録なし（取得済み）"): string {
  return value.state === "absent" ? absent : value.state === "not_requested" ? "まだ取得していません"
    : value.state === "unavailable" ? value.reason === "read_failed" ? "最新情報を取得できません"
      : value.reason === "incomplete" ? "一部の記録を確認できません" : "この形式の対応は未確認です" : "取得済み";
}
export const caseTargetSection = (kind: string): CaseSection =>
  kind === "quote" || kind === "payment_link" ? "transaction"
    : kind === "rough" || kind === "delivery" ? "production" : kind === "consultation" ? "consultation" : "history";

function attentionSection(item: CaseAttention, record: CaseWorkspaceRecord): CaseSection {
  if (item.domain === "operations") {
    return caseTargetSection(caseKnown(record.model.facts.operations)?.find(op => op.id === item.targetId)?.target.kind ?? "");
  }
  if (item.domain === "notifications") {
    const attempt = caseKnown(record.model.facts.notifications)?.find(row => row.id === item.targetId);
    const target = attempt?.target ?? record.model.notifications.find(row => row.target.id === item.targetId)?.target;
    return caseTargetSection(target?.kind ?? "");
  }
  return ["quote", "link", "payment", "financialReview"].includes(item.domain) ? "transaction"
    : ["production", "roughs", "delivery", "receipt"].includes(item.domain) ? "production"
      : item.domain === "consultation" ? "consultation" : "overview";
}

const attentionText: Readonly<Record<string, string>> = {
  quote_expired: "見積の有効期限と条件を確認", quote_acceptance_pending: "見積の承諾状況を確認",
  quote_draft: "見積の下書きと条件を確認", quote_needed: "見積の条件を確認",
  payment_notice_needed: "支払案内の状況を確認", payment_pending: "支払状況の確認待ち",
  payment_notice_unconfirmed: "リンク確認済み・案内送信は未確認",
  paid_link_stop_unconfirmed: "入金後の支払リンク停止状況を確認",
  current_notice_unconfirmed: "現在の条件のメール案内を確認",
  notification_failed: "メール案内の失敗記録を確認",
  notification_projection_review: "メール案内の保存結果を確認",
  notification_unknown: "メール案内の受付結果を確認",
  notification_pending: "メール案内の処理結果を確認", notification_sending: "メール案内の処理結果を確認",
  notification_state_error: "メール案内の保存結果を確認",
  rough_ok_unacknowledged: "ラフOKの内容を確認", rough_response_pending: "ラフの確認待ち",rough_revision_pending:"ラフへの修正対応待ち（担当記録）",delivery_notice_unconfirmed:"納品発行済み・案内送信は未確認",
  consultation_response_required: "相談の対応記録を確認",
  production_attention: "制作・納品の現在の記録を確認",
  receipt_pending: "納品の受取確認待ち", delivery_access_expired: "納品の保存期限を確認",
};

/** Advisory navigation only. Never use this output to enable/disable commands. */
export function deriveCaseGuidance(record: CaseWorkspaceRecord): CaseGuidance {
  const { model: m, display: d } = record;
  const project = caseKnown(d.project), quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment);
  const link = caseKnown(m.facts.link), delivery = caseKnown(m.facts.delivery), receipt = caseKnown(d.receipt);
  const conversation = caseKnown(d.conversation);
  const waits: CaseGuidance["waits"][number][] = [];
  const unknown: string[] = [];
  const add = (key: string, who: "staff" | "client" | "system", text: string, section: CaseSection) => {
    if (!waits.some(wait => wait.key === key || (wait.who === who && wait.text === text && wait.section === section))) {
      waits.push({ key, who, text, section });
    }
  };
  // Keep the common model's priority, owner and business checks. Missing legacy
  // classifications stay informational; they do not invent a repair obligation.
  for (const item of m.attention) {
    if (["unavailable", "not_requested", "external_evidence_unsupported", "legacy_evidence_required"].includes(item.reason)) continue;
    // A positive project record survives an incomplete ledger/release read. It
    // does not prove correlation, but must not send the client back to pay or receive again.
    if (receipt && ["receipt_pending", "delivery_access_expired", "production_attention", "rough_response_pending",
      "quote_acceptance_pending", "payment_pending", "payment_notice_needed", "payment_notice_unconfirmed","delivery_notice_unconfirmed"].includes(item.reason)) continue;
    if (payment && ["quote_acceptance_pending", "payment_pending", "payment_notice_needed", "payment_notice_unconfirmed"].includes(item.reason)) continue;
    const section = attentionSection(item, record);
    const text = attentionText[item.reason] ?? (item.domain === "operations" ? "同じ処理の結果を確認"
      : item.domain === "financialReview" ? "入金・返金の照合記録を確認"
        : item.domain === "quote" ? "見積の条件と承諾記録の対応を確認"
          : item.domain === "link" ? "支払リンクの状態を確認"
            : `${CASE_SECTION_LABELS[section]}の記録の対応を確認`);
    add(item.key, item.waitingOn, text, section);
  }
  const inactive = !!project?.archivedAt || project?.rawStatus === "closed" || project?.rawStatus === "completed";
  const quoteUnconfirmed = !quote && (m.facts.quote.state === "unavailable" || m.facts.quote.state === "not_requested");
  // Missing quote evidence is not an earlier business stage. Preserve confirmed
  // downstream facts and the model's higher-priority operation checks.
  if (quoteUnconfirmed && !inactive && !receipt && !payment && !delivery) {
    add("quote-unconfirmed", "staff", "見積の状態は未確認です。取引の記録を確認してください", "transaction");
  }
  if (!inactive && !receipt) {
    if (conversation?.latestSender === "client") add("conversation", "staff", "最後の依頼者の発言を確認", "consultation");
    if (!delivery && payment && !waits.some(wait => wait.section === "production")) {
      add("production", "staff", "制作・納品の現在の記録を確認", "production");
    } else if (!payment && m.agreement === "accepted" && !link) {
      add("payment", "staff", "支払案内の状況を確認", "transaction");
    } else if (!payment && quote && (m.agreement === "needs_review" || quote.state === "draft")) {
      add("quote-review", "staff", "見積の条件と承諾記録の対応を確認", "transaction");
    }
  }
  if (project?.origin === "unknown") unknown.push("受付元の分類は未確認です。保存済みの状態は表示しています。");
  if (d.tasks.state === "ready" && d.tasks.value.length) unknown.push("作業の実着手・完了時刻は記録されていません。");
  if (conversation) unknown.push("最新発言者を表示しています。既読や返信義務を表す記録ではありません。");
  if (receipt?.correspondence === "unconfirmed") unknown.push("受取の記録はありますが、納品データとの対応は未確認です。");
  if (payment?.correspondence === "unconfirmed") unknown.push("入金の記録はありますが、台帳との対応は未確認です。");
  const domains = [["入金・返金の照合", m.facts.financialReview], ["メール案内", m.facts.notifications],
    ["内部見積", m.facts.quote], ["支払リンク", m.facts.link], ["納品", m.facts.delivery],
    ["制作タスク", d.tasks], ["相談の最新発言", d.conversation]] as const;
  for (const [label, observation] of domains) {
    if (observation.state === "unavailable" || observation.state === "not_requested") {
      unknown.push(`${label}：${observationLabel(observation)}`);
    }
  }
  if (m.facts.payment.state === "unavailable" || m.facts.payment.state === "not_requested") {
    unknown.push(`入金：${observationLabel(m.facts.payment)}`);
  }
  let status = receipt ? "受取の記録あり" : project?.archivedAt ? "保管中の案件"
    : project?.rawStatus === "closed" ? "終了した案件" : project?.rawStatus === "completed" ? "完了の記録あり"
      : delivery ? "納品発行済み" : payment ? "入金の記録あり"
        : m.stage === "payment_notified" ? "支払案内送信済み・入金待ち" : m.agreement === "accepted" ? "見積承諾済み" : quoteUnconfirmed ? "見積の状態は未確認"
          : quote ? "見積の記録あり" : "受付・条件の確認";
  if (!project && !receipt && !payment && !delivery && !quote) status = "現在の情報は未確認";
  const primary = waits[0] ? { label: `${CASE_SECTION_LABELS[waits[0].section]}の記録へ`, section: waits[0].section }
    : receipt || inactive ? { label: "案件の履歴へ", section: "history" as const }
      : { label: "相談の記録へ", section: "consultation" as const };
  return { status, primary, waits, unknown, facts: [
    { label: "内部見積", value: quote ? `第${quote.version}版・${m.agreement === "accepted" ? "承諾済み" : m.agreement === "needs_review" ? "内容確認が必要" : "承諾記録なし"}`
      : observationLabel(m.facts.quote, "内部見積の記録なし") },
    { label: m.agreement === "needs_review" && quote?.acceptance ? "承諾記録の金額（対応未確認）" : "合意した金額",
      value: quote?.acceptance && (m.agreement === "accepted" || m.agreement === "needs_review") ? caseMoney(quote.acceptance.money) : "未確認" },
    { label: "入金", value: payment ? `${caseMoney(payment.money)}・記録あり` : observationLabel(m.facts.payment) },
    { label: "受取", value: receipt ? `${caseTime(receipt.acceptedAt)}・記録あり` : observationLabel(d.receipt) },
    { label: "支払リンク", value: link ? link.state === "active" ? "有効として保存された記録あり" : "状態の記録あり"
      : observationLabel(m.facts.link, "内部リンクの記録なし") },
  ] };
}
