import type { CaseAttention, CaseObservation } from "../types/caseReadModel";
import type { CaseGuidance, CaseSection, CaseWorkspaceRecord } from "../types/caseWorkspace";

export const CASE_SECTION_LABELS: Record<CaseSection, string> = {
  overview: "概要", consultation: "相談", transaction: "取引", production: "制作・納品", history: "履歴",
};
export const CASE_WHO_LABELS = { staff: "あなた", client: "お客さん", system: "自動処理" } as const;
export const CASE_TASK_STAGE_LABELS = { material: "資料", rough: "ラフ", lineart: "線画", coloring: "着彩", finish: "仕上げ", delivery: "納品" } as const;
/** One line for "who does what next", e.g. 「あなた：支払いリンクを送る」. */
export const caseWaitLine = (wait: { who: keyof typeof CASE_WHO_LABELS; text: string }) => `${CASE_WHO_LABELS[wait.who]}：${wait.text}`;
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
export function observationLabel(value: CaseObservation<unknown>, absent = "まだありません"): string {
  return value.state === "absent" ? absent : value.state === "not_requested" ? "まだ読み込んでいません"
    : value.state === "unavailable" ? value.reason === "read_failed" ? "読み込めませんでした"
      : value.reason === "incomplete" ? "一部を読み込めませんでした" : "この形式は表示できません" : "読み込み済み";
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

// Plain "next action" wording. Staff items are verbs; client/system items say what is awaited.
const attentionText: Readonly<Record<string, string>> = {
  quote_expired: "見積の期限が切れました。出し直すか決める", quote_acceptance_pending: "見積を確認中",
  quote_draft: "見積の下書きを仕上げて送る", quote_needed: "見積を作る",
  payment_notice_needed: "支払いリンクを送る", payment_pending: "お支払い待ち",
  payment_notice_unconfirmed: "支払いリンクのメールが届いたか確認",
  paid_link_stop_unconfirmed: "入金済みの支払いリンクが止まったか確認",
  current_notice_unconfirmed: "最新の条件のメールが届いたか確認",
  notification_failed: "送れなかったメールを確認",
  notification_projection_review: "メールの送信結果を確認",
  notification_unknown: "メールが届いたか確認",
  notification_pending: "メールの送信結果待ち", notification_sending: "メールの送信結果待ち",
  notification_state_error: "メールの送信結果を確認",
  rough_ok_unacknowledged: "ラフOKを確認して制作を進める", rough_response_pending: "ラフを確認中", rough_revision_pending: "ラフを直す", delivery_notice_unconfirmed: "納品メールが届いたか確認",
  consultation_response_required: "相談に返事する",
  production_attention: "制作を進める",
  receipt_pending: "納品の受け取り待ち", delivery_access_expired: "納品ページの期限切れ。延長するか決める",
};
// Button wording for the main next step, only where the target section can do it.
// The button only opens the section; sending still goes through its own confirmation.
const attentionButton: Readonly<Record<string, string>> = {
  payment_notice_needed: "支払いリンクを送る", consultation_response_required: "相談に返事する", rough_revision_pending: "ラフを直す",
};

/** Advisory navigation only. Never use this output to enable/disable commands. */
export function deriveCaseGuidance(record: CaseWorkspaceRecord): CaseGuidance {
  const { model: m, display: d } = record;
  const project = caseKnown(d.project), quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment);
  const link = caseKnown(m.facts.link), delivery = caseKnown(m.facts.delivery), receipt = caseKnown(d.receipt);
  const conversation = caseKnown(d.conversation);
  const waits: CaseGuidance["waits"][number][] = [];
  const buttons = new Map<string, string>();
  const unknown: string[] = [];
  const add = (key: string, who: "staff" | "client" | "system", text: string, section: CaseSection, button?: string) => {
    if (!waits.some(wait => wait.key === key || (wait.who === who && wait.text === text && wait.section === section))) {
      waits.push({ key, who, text, section });
      if (button && who === "staff") buttons.set(key, button);
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
    const text = attentionText[item.reason] ?? (item.domain === "operations" ? "前回の処理の結果を確認"
      : item.domain === "financialReview" ? "入金・返金の照合を確認"
        : item.domain === "quote" ? "見積と承諾の内容が合っているか確認"
          : item.domain === "link" ? "支払いリンクの状態を確認"
            : `${CASE_SECTION_LABELS[section]}の内容を確認`);
    add(item.key, item.waitingOn, text, section, attentionButton[item.reason]);
  }
  const inactive = !!project?.archivedAt || project?.rawStatus === "closed" || project?.rawStatus === "completed";
  const quoteUnconfirmed = !quote && (m.facts.quote.state === "unavailable" || m.facts.quote.state === "not_requested");
  // Missing quote evidence is not an earlier business stage. Preserve confirmed
  // downstream facts and the model's higher-priority operation checks.
  if (quoteUnconfirmed && !inactive && !receipt && !payment && !delivery) {
    add("quote-unconfirmed", "staff", "見積の状態を読み込めませんでした。取引を開いて確認", "transaction");
  }
  if (!inactive && !receipt) {
    if (conversation?.latestSender === "client") add("conversation", "staff", "お客さんの最新メッセージを確認", "consultation", "相談を開く");
    if (!delivery && payment && !waits.some(wait => wait.section === "production")) {
      const next = d.tasks.state === "ready" ? d.tasks.value.find(task => !task.done) : undefined;
      add("production", "staff", next ? `制作を進める（次は${CASE_TASK_STAGE_LABELS[next.stage]}）` : "制作を進める", "production");
    } else if (!payment && m.agreement === "accepted" && !link) {
      add("payment", "staff", "支払いリンクを送る", "transaction", "支払いリンクを送る");
    } else if (!payment && quote && (m.agreement === "needs_review" || quote.state === "draft")) {
      add("quote-review", "staff", quote.state === "draft" ? "見積の下書きを仕上げて送る" : "見積と承諾の内容が合っているか確認", "transaction");
    }
  }
  if (project?.origin === "unknown") unknown.push("どこから受け付けた案件かは分かりません（保存済みの状態は表示しています）。");
  if (d.tasks.state === "ready" && d.tasks.value.length) unknown.push("制作の各工程を実際に始めた・終えた時刻は記録していません。");
  if (conversation) unknown.push("相談は最後に書いた人だけを表示しています。既読や返事が必要かどうかは分かりません。");
  if (receipt?.correspondence === "unconfirmed") unknown.push("要確認：受け取りの記録はありますが、どの納品に対するものかを確認できていません。");
  if (payment?.correspondence === "unconfirmed") unknown.push("要確認：入金の記録はありますが、入金台帳と照らし合わせられていません。");
  const domains = [["入金・返金の照合", m.facts.financialReview], ["メール", m.facts.notifications],
    ["見積", m.facts.quote], ["支払いリンク", m.facts.link], ["納品", m.facts.delivery],
    ["制作の工程", d.tasks], ["相談", d.conversation]] as const;
  for (const [label, observation] of domains) {
    if (observation.state === "unavailable" || observation.state === "not_requested") {
      unknown.push(`${label}：${observationLabel(observation)}`);
    }
  }
  if (m.facts.payment.state === "unavailable" || m.facts.payment.state === "not_requested") {
    unknown.push(`入金：${observationLabel(m.facts.payment)}`);
  }
  const paymentUnread = m.facts.payment.state === "unavailable" || m.facts.payment.state === "not_requested";
  // Short stage names. They describe recorded facts only; they never unlock commands.
  let status = receipt ? "受取済み" : project?.archivedAt ? "保管中"
    : project?.rawStatus === "closed" ? "終了" : project?.rawStatus === "completed" ? "完了"
      : delivery ? "納品済み・受取待ち" : payment ? "制作中"
        : m.stage === "payment_notified" ? "入金待ち" : m.agreement === "accepted" ? paymentUnread ? "見積OK・入金は確認できません" : "見積OK・支払い前" : quoteUnconfirmed ? "見積の状態が分かりません"
          : quote?.state === "draft" ? "見積の準備中" : m.agreement === "needs_review" ? "見積の確認が必要" : quote ? "見積の返事待ち" : "相談中";
  if (!project && !receipt && !payment && !delivery && !quote) status = "状態を読み込めていません";
  const primary = waits[0] ? { label: buttons.get(waits[0].key) ?? `${CASE_SECTION_LABELS[waits[0].section]}を開く`, section: waits[0].section }
    : receipt || inactive ? { label: "履歴を開く", section: "history" as const }
      : { label: "相談を開く", section: "consultation" as const };
  return { status, primary, waits, unknown, facts: [
    { label: "見積", value: quote ? `${quote.version > 1 ? `${quote.version}回目の見積` : "見積"}${m.agreement === "accepted" ? "でOK" : m.agreement === "needs_review" ? "（内容の確認が必要）" : quote.state === "draft" ? "（下書き）" : "（返事待ち）"}`
      : observationLabel(m.facts.quote, "まだ") },
    { label: m.agreement === "needs_review" && quote?.acceptance ? "OKをもらった金額（要確認）" : "決まった金額",
      value: quote?.acceptance && (m.agreement === "accepted" || m.agreement === "needs_review") ? caseMoney(quote.acceptance.money) : quoteUnconfirmed ? "分かりません" : "まだ" },
    { label: "入金", value: payment ? `${caseMoney(payment.money)}・入金済み` : observationLabel(m.facts.payment, "まだ") },
    { label: "受取", value: receipt ? `${caseTime(receipt.acceptedAt)}・受取済み` : observationLabel(d.receipt, "まだ") },
    { label: "支払リンク", value: link ? link.state === "active" ? "使える状態" : "作成済み"
      : observationLabel(m.facts.link, "まだ") },
  ] };
}
