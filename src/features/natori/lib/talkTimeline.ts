import type { TalkCard, TalkFacts, TalkQuoteFact, TalkRoughFact, TalkStep, TalkTimeline } from "../types/talk";

const DATE = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" });
const day = (iso: string) => DATE.format(new Date(iso));
const past = (iso: string | null, now: Date) => iso !== null && Date.parse(iso) <= now.getTime();

/** Only Stripe-hosted payment pages are ever rendered as a button. */
export function isStripePaymentUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"));
  } catch { return false; }
}

function quoteCard(quote: TalkQuoteFact, latest: boolean, now: Date, linksAllowed: boolean): TalkCard {
  const base = { id: `quote-${quote.id}`, kind: "quote" as const, title: "お見積もり" };
  if (quote.acceptedAt) return { ...base, badge: { label: "承認済み", tone: "done" }, lines: [`${day(quote.acceptedAt)}に承認されました。`] };
  if (quote.supersededAt || !latest) return { ...base, badge: { label: "更新済み", tone: "muted" }, lines: ["新しいお見積もりが届いています。"] };
  const amount = `¥${quote.amount.toLocaleString("ja-JP")}`;
  if (past(quote.expiresAt, now)) return { ...base, amount, badge: { label: "期限切れ", tone: "muted" }, lines: ["有効期限が過ぎています。必要なときは下のトークでご連絡ください。"] };
  const lines = [`${day(quote.expiresAt)}まで有効です。`];
  if (!linksAllowed) return { ...base, amount, badge: { label: "確認待ち", tone: "action" }, lines: [...lines, "お見積もりのメールにあるリンクから、内容を確認して承認してください。"] };
  return { ...base, amount, badge: { label: "確認待ち", tone: "action" }, lines, action: { label: "内容を確認して承認", open: "quote" } };
}

function roughCard(rough: TalkRoughFact, linksAllowed: boolean): TalkCard {
  const base = { id: `rough-${rough.id}`, kind: "rough" as const, title: rough.beforeQuote ? "参考ラフ（見積もり前）" : "ラフ" };
  const where = "ラフは、下のやり取りの添付から確認できます。";
  if (rough.okAt) return { ...base, badge: { label: "OK済み", tone: "done" }, lines: [`${day(rough.okAt)}に「このラフでOK」をいただきました。`, where] };
  const lines = [`${day(rough.createdAt)}にラフが届きました。`, where, "直したい点は、下のやり取りでお送りください。",
    "「OK」は制作を進めるための連絡です。お見積もりの承認やお支払いの代わりにはなりません。"];
  return { ...base, badge: { label: "確認待ち", tone: "action" }, lines, ...(linksAllowed ? { action: { label: "このラフでOK", roughOk: rough.id } } : {}) };
}

export function buildTalkTimeline(facts: TalkFacts, now: Date): TalkTimeline {
  const ordered = [...facts.quotes].sort((a, b) => a.version - b.version);
  const latest = ordered.at(-1);
  const accepted = ordered.filter(quote => quote.acceptedAt).at(-1);
  const roughs = [...(facts.roughs ?? [])].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map(rough => ({ rough, card: roughCard(rough, facts.linksAllowed) }));
  // Roughs may come at any time: ones sent before a quote lead, the rest follow the quotes.
  const cards: TalkCard[] = [
    ...roughs.filter(({ rough }) => rough.beforeQuote).map(({ card }) => card),
    ...ordered.map(quote => quoteCard(quote, quote === latest, now, facts.linksAllowed)),
    ...roughs.filter(({ rough }) => !rough.beforeQuote).map(({ card }) => card),
  ];

  const { payment, delivery } = facts;
  if (accepted || payment.confirmedAt) {
    const amount = accepted ? `¥${accepted.amount.toLocaleString("ja-JP")}` : undefined;
    const base = { id: "payment", kind: "payment" as const, title: "お支払い", ...(amount ? { amount } : {}) };
    if (payment.confirmedAt) cards.push({ ...base, badge: { label: "支払い完了", tone: "done" }, lines: [`${day(payment.confirmedAt)}に確認しました。`] });
    else if (payment.processing) cards.push({ ...base, badge: { label: "確認中", tone: "wait" }, lines: ["お支払いの確認を待っています。二重にお支払いしないでください。"] });
    else if (isStripePaymentUrl(payment.linkUrl)) {
      if (past(payment.linkDeadline, now)) cards.push({ ...base, badge: { label: "期限切れ", tone: "muted" }, lines: ["お支払いの期限が過ぎています。必要なときは下のトークでご連絡ください。"] });
      else cards.push({ ...base, badge: { label: "支払い待ち", tone: "action" },
        lines: [payment.linkDeadline ? `${day(payment.linkDeadline)}までにお願いします。（カード決済）` : "カード決済でお支払いいただけます。"],
        action: { label: "お支払いへ進む", href: payment.linkUrl } });
    }
  }

  if (delivery.exists) {
    const base = { id: "delivery", kind: "delivery" as const, title: "納品" };
    const files = delivery.fileCount ? `ファイル ${delivery.fileCount}点` : null;
    const open = delivery.expiresAt !== null && !past(delivery.expiresAt, now);
    const canOpen = open && delivery.openable && facts.linksAllowed && Boolean(payment.confirmedAt);
    if (delivery.acceptedAt) cards.push({ ...base, badge: { label: "受け取り済み", tone: "done" },
      lines: [`${day(delivery.acceptedAt)}に受け取り確認がありました。`, ...(open && delivery.expiresAt ? [`ダウンロードは${day(delivery.expiresAt)}までできます。`] : [])],
      ...(canOpen ? { action: { label: "ダウンロードを開く", open: "delivery" as const } } : {}) });
    else if (!open) cards.push({ ...base, badge: { label: "期限切れ", tone: "muted" }, lines: ["ダウンロードの期限が過ぎています。再送が必要なときは下のトークでご連絡ください。"] });
    else cards.push({ ...base, badge: { label: "受け取り待ち", tone: "action" },
      lines: [...(files ? [files] : []), ...(delivery.expiresAt ? [`ダウンロードは${day(delivery.expiresAt)}までできます。`] : []),
        ...(canOpen ? [] : ["納品メールにあるリンクから受け取ってください。"])],
      ...(canOpen ? { action: { label: "ダウンロードして受け取る", open: "delivery" as const } } : {}) });
  }

  const steps: TalkStep[] = [
    { key: "quote", label: "見積もり承認", done: Boolean(accepted) },
    { key: "payment", label: "お支払い", done: Boolean(payment.confirmedAt) },
    { key: "delivery", label: "納品", done: delivery.exists },
  ];
  return { cards, steps };
}
