import { formatYen } from "@/features/natori/lib/pricing";

/**
 * ご依頼フォーム → 見積もり提示 → 支払い案内 の依頼者向けメール定型文。
 * DB 非依存の純関数のみ。実際の送信・Stripe リンク生成は
 * server/orderMailService.ts が担当する。
 */

/** 支払い依頼メール本文に入れるプレースホルダ。送信時に実URLへ差し替わる */
export const PAYMENT_LINK_PLACEHOLDER = "{支払いリンク}";

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
    "──────────────",
    "",
    "上記の内容で制作を進めてよろしければ、このメールにご返信ください。",
    "ご返信を確認しだい、お支払いのご案内をお送りいたします。",
    "",
    "内容のご調整やご不明な点がありましたら、お気軽にご返信ください。",
    "",
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
    "ご入金の確認が取れ次第、制作を開始し、改めてご連絡いたします。",
    "リンクがうまく開けない場合や、別のお支払い方法をご希望の場合は、",
    "このメールにご返信ください。",
    "",
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

/** 送信ログとして案件メモ末尾に追記する1行を作る */
export function buildOrderMailLogEntry(
  kind: "estimate" | "payment",
  dateISO: string,
  to: string,
  amount: number,
  paymentLinkUrl?: string
): string {
  const label = kind === "estimate" ? "見積もりメール送信" : "支払い依頼メール送信";
  const base = `【${label} ${dateISO}】宛先: ${to} / 金額: ${formatYen(amount)}`;
  return paymentLinkUrl ? `${base}\n支払いリンク: ${paymentLinkUrl}` : base;
}
