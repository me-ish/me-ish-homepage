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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 依頼者メールの解決。client_email カラムを正とし、カラムが空の既存案件
 * （移行スクリプト未実行・手入力）に限って note からの抽出にフォールバックする。
 */
export function resolveClientEmail(project: {
  clientEmail?: string | null;
  note?: string | null;
}): string | null {
  const fromColumn = project.clientEmail?.trim();
  if (fromColumn && EMAIL_RE.test(fromColumn)) return fromColumn;
  return extractClientEmailFromNote(project.note);
}

/**
 * 【移行期の後方互換フォールバック】案件メモから依頼者のメールアドレスを取り出す。
 * client_email カラム化（2026-07 タスク3）以降の新規参照は resolveClientEmail を
 * 使うこと。note の手編集で壊れるため、このパースに新たに依存しない。
 * 1. 自動起票の「メール: xxx」行を優先
 * 2. 無ければ（手入力案件など）送信ログの「宛先: xxx」から最新のものを使う
 * どちらも無ければ null。
 */
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
  /** 見積もりツールから渡す内訳（例: "基本料金（全身）: ¥10,000"）。金額の下に並ぶ */
  breakdownLines?: string[];
  /** 納期目安の文言。省略時は「ご入金確認後、約1ヶ月前後」 */
  deliveryLead?: string;
  /** 署名・名乗り。省略時は「ナトリ」 */
  artistName?: string;
};

/** 見積もり提示メールの定型文（送信前に画面上で編集できる前提の下書き） */
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
    "上記の内容で制作を進めてよろしければ、下記の承諾ページを開いて",
    "「この内容でお願いする」ボタンを押してください。",
    ACCEPT_LINK_PLACEHOLDER,
    "（このメールへのご返信でご承諾いただくこともできます）",
    "",
    "ご承諾を確認しだい、お支払いのご案内をお送りいたします。",
    "内容のご調整やご不明な点がありましたら、お気軽にご返信ください。",
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

/**
 * 支払い依頼メールの定型文。本文中の PAYMENT_LINK_PLACEHOLDER は
 * 送信時にサーバーで Stripe の支払いリンクへ差し替えられる。
 */
export function buildPaymentMailDraft(input: NatoriPaymentMailInput): NatoriOrderMailDraft {
  const artist = input.artistName?.trim() || "ナトリ";
  const subject = `【お支払いのご案内】${input.title} について（${artist}）`;
  const body = [
    `${input.clientName} 様`,
    "",
    "ご依頼のご承諾をいただき、ありがとうございます。",
    "下記のリンクからお支払いをお願いいたします。",
    "",
    "──────────────",
    `■ ご依頼内容: ${input.title}`,
    `■ お支払い金額: ${formatYen(input.amount)}`,
    `■ お支払いリンク（カード決済）:`,
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

/**
 * 本文中のプレースホルダを実際の支払いリンクに差し替える。
 * プレースホルダが（編集で）消えていた場合は末尾にリンクを追記して、
 * リンク無しのまま送られる事故を防ぐ。
 */
export function injectPaymentLink(body: string, url: string): string {
  if (body.includes(PAYMENT_LINK_PLACEHOLDER)) {
    return body.split(PAYMENT_LINK_PLACEHOLDER).join(url);
  }
  return `${body}\n\n■ お支払いリンク:\n${url}`;
}

/**
 * 本文中のプレースホルダを実際の承諾ページURLに差し替える。
 * プレースホルダが（編集で）消えていた場合は末尾に追記する（injectPaymentLink と同じ思想）。
 */
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

/**
 * 入金確認後に依頼者へ自動送信する確認メール。
 * 決済直後の「ちゃんと処理されたか」という不安に応えるためのもので、
 * Stripe の完了画面表示と違いメールボックスに記録が残る。
 */
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

/** 送信ログとして案件メモ末尾に追記する1行を作る */
export function buildOrderMailLogEntry(
  kind: "estimate" | "payment" | "rough" | "delivery",
  dateISO: string,
  to: string,
  amount: number,
  paymentLinkUrl?: string
): string {
  const label = ORDER_MAIL_LOG_LABELS[kind];
  // ラフ提出・納品は金額の連絡ではないので宛先だけ記録する
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

/* ------------------------------------------------------------------
   ラフ提出・納品メール（納品フロー）
------------------------------------------------------------------- */

/** ラフ確認ファイルの署名URL一覧が差し込まれる位置 */
export const FILES_LINK_PLACEHOLDER = "{ファイルリンク}";
/** 納品ページURLが差し込まれる位置 */
export const DELIVERY_LINK_PLACEHOLDER = "{納品ページリンク}";
/** ラフ確認リンクの有効日数（署名URLの期限） */
export const ROUGH_LINK_VALID_DAYS = 14;
/** 納品ページの有効日数 */
export const DELIVERY_VALID_DAYS = 30;

export type NatoriWorkMailInput = {
  clientName: string;
  title: string;
  artistName?: string;
};

/** ラフ提出メールの定型文。ファイルリンクは送信時にサーバーで差し込まれる */
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

/** 納品メールの定型文。納品ページのURLは送信時にサーバーで差し込まれる */
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

/**
 * 本文中のプレースホルダをラフ確認ファイルのリンク一覧に差し替える。
 * プレースホルダが消えていた場合は末尾に追記（injectPaymentLink と同じ思想）。
 */
export function injectFilesLinks(body: string, lines: readonly string[]): string {
  const text = lines.join("\n");
  if (body.includes(FILES_LINK_PLACEHOLDER)) {
    return body.split(FILES_LINK_PLACEHOLDER).join(text);
  }
  return `${body}\n\n■ ラフ確認用リンク:\n${text}`;
}

/** 本文中のプレースホルダを納品ページURLに差し替える（消えていたら末尾に追記） */
export function injectDeliveryLink(body: string, url: string): string {
  if (body.includes(DELIVERY_LINK_PLACEHOLDER)) {
    return body.split(DELIVERY_LINK_PLACEHOLDER).join(url);
  }
  return `${body}\n\n■ 納品ページ:\n${url}`;
}
