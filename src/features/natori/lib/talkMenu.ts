import type { NatoriProjectStatus } from "../types/projects";

export type TalkMenuKey = "estimate" | "payment" | "delivery";
export type TalkMenuItem = {
  key: TalkMenuKey;
  label: string;
  /** When locked, why: shown instead of the button. */
  reason: string | null;
  /** Small extra line for an enabled item. */
  hint: string | null;
};
export type TalkMenu = { tip: string; recommended: TalkMenuKey | null; items: TalkMenuItem[] };
export type TalkMenuInput = {
  status: NatoriProjectStatus;
  paymentConfirmedAt: string | undefined;
  /** null = not accepted yet (locks the payment link); undefined = unknown, the server still decides. */
  quoteAcceptedAt?: string | null;
  /** The estimate tool link exists (it does not in the demo). */
  hasEstimateLink: boolean;
  /** Closed, archived or otherwise read-only. */
  readOnly: boolean;
};

const BEFORE_QUOTE: ReadonlySet<NatoriProjectStatus> = new Set(["inquiry", "consulting", "estimating"]);
const ESTIMATE_OPEN: ReadonlySet<NatoriProjectStatus> = new Set(["inquiry", "consulting", "estimating", "quoted"]);
const PAYMENT_OPEN: ReadonlySet<NatoriProjectStatus> = new Set(["quoted", "awaiting_payment"]);

/**
 * What the staff "＋" menu offers. The gates are the same ones the existing screens
 * already enforce (payment link only around the quote, delivery only after payment);
 * the menu only explains them. Rough drafts and files are never gated.
 */
export function buildTalkMenu(input: TalkMenuInput): TalkMenu {
  const { status, paymentConfirmedAt, quoteAcceptedAt, hasEstimateLink, readOnly } = input;
  const closed = "終了した案件のため、操作できません。";

  const estimate: TalkMenuItem = readOnly
    ? { key: "estimate", label: "見積もり", reason: closed, hint: null }
    : !ESTIMATE_OPEN.has(status)
      ? { key: "estimate", label: "見積もり", reason: "見積もりはすでに承認されています。", hint: null }
      : !hasEstimateLink
        ? { key: "estimate", label: "見積もり", reason: "このデモでは見積りページを開けません。", hint: null }
        : { key: "estimate", label: status === "quoted" ? "見積りを開く・再送" : "見積もりを作る", reason: null,
          hint: status === "quoted" ? "出し直しも見積りページから行えます。" : "依頼内容を見積りページに引き継ぎます。" };

  const payment: TalkMenuItem = readOnly
    ? { key: "payment", label: "支払いリンク", reason: closed, hint: null }
    : paymentConfirmedAt
      ? { key: "payment", label: "支払いリンク", reason: "お支払いは確認済みです。", hint: null }
      : BEFORE_QUOTE.has(status)
        ? { key: "payment", label: "支払いリンク", reason: "見積もりの承認後に送れます。", hint: null }
        : !PAYMENT_OPEN.has(status)
          ? { key: "payment", label: "支払いリンク", reason: "お支払いは確認済みです。", hint: null }
          : status === "quoted" && quoteAcceptedAt === null
            ? { key: "payment", label: "支払いリンク", reason: "依頼者が見積もりを承認すると送れます。", hint: null }
          : { key: "payment", label: status === "awaiting_payment" ? "支払いリンクを再送" : "支払いリンクを送る", reason: null,
            hint: status === "quoted" && quoteAcceptedAt === undefined ? "依頼者が見積もりを承認する前は送信できません。" : null };

  const delivery: TalkMenuItem = readOnly
    ? { key: "delivery", label: "納品", reason: closed, hint: null }
    : !paymentConfirmedAt
      ? { key: "delivery", label: "納品", reason: "お支払いの確認後に送れます。", hint: null }
      : { key: "delivery", label: status === "delivered" || status === "completed" ? "納品を確認・再送" : "納品する", reason: null,
        hint: "ファイルの追加と納品メールは案件ボードで行います。" };

  const recommended: TalkMenuKey | null = readOnly ? null
    : BEFORE_QUOTE.has(status) ? "estimate"
      : status === "awaiting_payment" || (status === "quoted" && Boolean(quoteAcceptedAt)) ? "payment"
        : status === "delivery_prep" || status === "delivered" ? "delivery" : null;
  const tip = readOnly ? "終了した案件です。履歴を見ることができます。"
    : BEFORE_QUOTE.has(status) ? "おすすめ：見積もりを送る（先に参考ラフを送ってもOK）"
      : status === "quoted" ? (quoteAcceptedAt ? "おすすめ：支払いリンクを送る（依頼者が見積もりを承認しました）" : "依頼者の承認を待っています。承認後に支払いリンクを送れます。")
        : status === "awaiting_payment" ? "おすすめ：支払いリンクを送る（送信済みなら、お支払いの確認待ちです）"
          : status === "delivery_prep" ? "おすすめ：納品する"
            : status === "delivered" ? "納品済みです。依頼者の受け取り確認を待っています。"
              : "制作中です。ラフや資料はいつでも送れます。";
  return { tip, recommended, items: [estimate, payment, delivery] };
}
