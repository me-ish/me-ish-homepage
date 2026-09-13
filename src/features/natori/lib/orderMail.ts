import { formatYen } from "@/features/natori/lib/pricing";

/**
 * ご依頼フォーム → 見積もり提示 → 支払い案内 の依頼者向けメール定型文。
 * DB 非依存の純関数のみ。実際の送信・Stripe リンク生成は
 * server/orderMailService.ts が担当する。
 */

/** 支払い依頼メール本文に入れるプレースホルダ。送信時に実URLへ差し替わる */
export const PAYMENT_LINK_PLACEHOLDER = "{支払いリンク}";

/** 見積もりメール本文に入れる承諾ページURLのプレースホルダ。送信時に実URLへ差し替わる */
export const ACCEPT_LINK_PLACEHOLDER = "{承諾リンク}";

/** 見積もりの有効期限（日数）。承諾リンクの有効期限もこれに連動する */
export const QUOTE_VALID_DAYS = 30;
/** 支払い案内メール送信日からの支払い期限（日数）。 */
export const PAYMENT_DUE_DAYS = 7;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveClientEmail(project: {
  clientEmail?: string | null;
  note?: string | null;
}): string | null {
  const fromColumn = project.clientEmail?.trim();
  if (fromColumn && EMAIL_RE.test(fromColumn)) return fromColumn;
  return extractClientEmailFromNote(project.note);
}

export function extractClientEmailFromNote(note: string | undefined | null): string | null {
  if (!note) return null;
  const auto = note.match(/メール:\s*([^\s\r\n]+)/);
  if (auto?.[1] && EMAIL_RE.test(auto[1])) return auto[1];

  const logMatches = Array.from(note.matchAll(/宛先:\s*([^\s\r\n/]+)/g));
  for (let i = logMatches.length - 1; i >= 0; i -= 1) {
    const candidate = logMatches[i][1];
    if (EMAIL_RE.test(candidate)) return candidate;
  }
  return null;
}

export type NatoriOrderMailDraft = {
  subject: string;
  body: string;
};

export type NatoriEstimateMailInput = {
  clientName: string;
  title: string;
  amount: number;
  breakdownLines?: string[];
  deliveryLead?: string;
  artistName?: string;
};

export function buildEstimateMailDraft(input: NatoriEstimateMailInput): NatoriOrderMailDraft {
  const artist = input.artistName?.trim() || "ナトリ";
  const deliveryLead = input.deliveryLead?.trim() || "ご入金確認後、約1ヶ月前後";
  const breakdown = (input.breakdownLines ?? [])
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `　・${line}`);
  const subject = `【お見積もり】${input.title} について（${artist}）`;
  const body = [
    `${input.clientName} 様`,
    "",
    "この度はご依頼のお問い合わせをいただき、ありがとうございます。",
    `イラストレーターの${artist}です。`,
    "",
    "いただいた内容をもとに、お見積もりをご案内いたします。",
    "",
    "──────────────",
    `■ ご依頼内容: ${input.title}`,
    `■ お見積もり金額: ${formatYen(input.amount)}`,
    ...breakdown,
    `■ 納期目安: ${deliveryLead}`,
    `■ お見積もり有効期限: 本メール送信日から${QUOTE_VALID_DAYS}日間`,
    "──────────────",
    "",
    "上記の内容でご依頼いただける場合は、下記の承諾ページを開いて",
    "「この内容で依頼を確定する」ボタンを押してください。",
    ACCEPT_LINK_PLACEHOLDER,
    "",
    "ご依頼の確定を確認しだい、お支払いのご案内をお送りいたします。",
    "内容のご調整やご不明な点がありましたら、確定前にお気軽にご返信ください。",
    "",
    "※このメールにそのままご返信いただけます。",
    artist,
  ].join("\n");
  return { subject, body };
}

export type NatoriPaymentMailInput = {
  clientName: string;
  title: string;
  amount: number;
  artistName?: string;
};

export function buildPaymentMailDraft(input: NatoriPaymentMailInput): NatoriOrderMailDraft {
  const artist = input.artistName?.trim() || "ナトリ";
  const subject = `【お支払いのご案内】${input.title} について（${artist}）`;
  const body = [
    `${input.clientName} 様`,
    "",
    "ご依頼の確定ありがとうございます。",
    "下記のリンクからお支払いをお願いいたします。",
    "",
    "──────────────",
    `■ ご依頼内容: ${input.title}`,
    `■ お支払い金額: ${formatYen(input.amount)}`,
    `■ お支払い期限: 本メール送信日から${PAYMENT_DUE_DAYS}日以内`,
    "■ お支払いリンク（カード決済）:",
    PAYMENT_LINK_PLACEHOLDER,
    "──────────────",
    "",
    "※お支払いリンクはご本人様専用・1回限り有効です。",
    "※以前のお支払いリンクをお送りしていた場合、そちらは無効となり、",
    "　本メールのリンクのみ有効です。",
    "",
    "ご入金の確認が取れ次第、制作を開始し、改めてご連絡いたします。",
    "リンクがうまく開けない場合や、別のお支払い方法をご希望の場合は、",
    "このメールにご返信ください。",
    "",
    "※このメールにそのままご返信いただけます。",
    artist,
  ].join("\n");
  return { subject, body };
}

export function injectPaymentLink(body: string, url: string): string {
  if (body.includes(PAYMENT_LINK_PLACEHOLDER)) {
    return body.split(PAYMENT_LINK_PLACEHOLDER).join(url);
  }
  return `${body}\n\n■ お支払いリンク:\n${url}`;
}

export function injectAcceptLink(body: string, url: string): string {
  if (body.includes(ACCEPT_LINK_PLACEHOLDER)) {
    return body.split(ACCEPT_LINK_PLACEHOLDER).join(url);
  }
  return `${body}\n\n■ ご承諾ページ:\n${url}`;
}

export type NatoriPaidConfirmationMailInput = {
  clientName: string;
  title: string;
  amount: number;
  artistName?: string;
};

export function buildPaidConfirmationMail(
  input: NatoriPaidConfirmationMailInput
): NatoriOrderMailDraft {
  const artist = input.artistName?.trim() || "ナトリ";
  const subject = `【ご入金確認】制作を開始いたします（${artist}）`;
  const body = [
    `${input.clientName} 様`,
    "",
    "ご入金を確認いたしました。ありがとうございます。",
    "",
    "──────────────",
    `■ ご依頼内容: ${input.title}`,
    `■ ご入金額: ${formatYen(input.amount)}`,
    "──────────────",
    "",
    "これより制作を開始いたします。",
    "ラフが完成しだい、このメールアドレス宛にご連絡いたしますので、",
    "今しばらくお待ちください。",
    "",
    "ご不明な点がありましたら、このメールにそのままご返信ください。",
    "",
    artist,
  ].join("\n");
  return { subject, body };
}

export function buildOrderMailLogEntry(
  kind: "estimate" | "payment" | "rough" | "delivery",
  dateISO: string,
  to: string,
  amount: number,
  paymentLinkUrl?: string
): string {
  const label = ORDER_MAIL_LOG_LABELS[kind];
  const base =
    kind === "rough" || kind === "delivery"
      ? `【${label} ${dateISO}】宛先: ${to}`
      : `【${label} ${dateISO}】宛先: ${to} / 金額: ${formatYen(amount)}`;
  return paymentLinkUrl ? `${base}\n支払いリンク: ${paymentLinkUrl}` : base;
}

const ORDER_MAIL_LOG_LABELS = {
  estimate: "見積もりメール送信",
  payment: "支払い依頼メール送信",
  rough: "ラフ提出メール送信",
  delivery: "納品メール送信",
} as const;

export const FILES_LINK_PLACEHOLDER = "{ファイルリンク}";
export const DELIVERY_LINK_PLACEHOLDER = "{納品ページリンク}";
export const ROUGH_LINK_VALID_DAYS = 14;
export const DELIVERY_VALID_DAYS = 30;

export type NatoriWorkMailInput = {
  clientName: string;
  title: string;
  artistName?: string;
};

export function buildRoughMailDraft(input: NatoriWorkMailInput): NatoriOrderMailDraft {
  const artist = input.artistName?.trim() || "ナトリ";
  const subject = `【ラフのご確認】${input.title} について（${artist}）`;
  const body = [
    `${input.clientName} 様`,
    "",
    "お世話になっております。",
    `イラストレーターの${artist}です。`,
    "",
    `「${input.title}」のラフが完成しましたので、ご確認をお願いいたします。`,
    "",
    "──────────────",
    "■ ラフ確認用リンク:",
    FILES_LINK_PLACEHOLDER,
    `■ リンクの有効期限: ${ROUGH_LINK_VALID_DAYS}日間`,
    "──────────────",
    "",
    "構図・表情・配色などをご確認ください。",
    "修正のご希望は、このメールにそのままご返信いただければ反映いたします。",
    "大きな修正はこのラフの段階でお願いできますと幸いです。",
    "",
    "問題がなければ、その旨ご返信ください。清書に進みます。",
    "",
    "※このメールにそのままご返信いただけます。",
    artist,
  ].join("\n");
  return { subject, body };
}

export function buildDeliveryMailDraft(input: NatoriWorkMailInput): NatoriOrderMailDraft {
  const artist = input.artistName?.trim() || "ナトリ";
  const subject = `【納品】${input.title} について（${artist}）`;
  const body = [
    `${input.clientName} 様`,
    "",
    "お待たせいたしました。",
    `「${input.title}」が完成しましたので、納品いたします。`,
    "",
    "──────────────",
    "■ 納品ページ（ダウンロードはこちら）:",
    DELIVERY_LINK_PLACEHOLDER,
    `■ ページの有効期限: ${DELIVERY_VALID_DAYS}日間`,
    "──────────────",
    "",
    "上記のページから完成データをダウンロードいただき、内容をご確認のうえ、",
    "ページ内の「受け取りました」ボタンを押していただけますと納品完了となります。",
    "",
    "この度はご依頼いただき、本当にありがとうございました。",
    "またの機会がありましたら、ぜひよろしくお願いいたします。",
    "",
    "※ご不明な点は、このメールにそのままご返信ください。",
    artist,
  ].join("\n");
  return { subject, body };
}

export function injectFilesLinks(body: string, lines: readonly string[]): string {
  const text = lines.join("\n");
  if (body.includes(FILES_LINK_PLACEHOLDER)) {
    return body.split(FILES_LINK_PLACEHOLDER).join(text);
  }
  return `${body}\n\n■ ラフ確認用リンク:\n${text}`;
}

export function injectDeliveryLink(body: string, url: string): string {
  if (body.includes(DELIVERY_LINK_PLACEHOLDER)) {
    return body.split(DELIVERY_LINK_PLACEHOLDER).join(url);
  }
  return `${body}\n\n■ 納品ページ:\n${url}`;
}
