/**
 * 問い合わせ管理画面用: 案件メモ（note）の内容を表示用に構造化する純関数群。
 *
 * メモには2種類の内容が混在する:
 * 1. フォーム自動起票の本文（buildInquiryNote が生成。ラベル行とセクション）
 * 2. 追記ログ（`【見積もりメール送信 2026-07-12】...` のような日付付きエントリ。
 *    orderMailService / closeNatoriProject が末尾に追記する）
 */

export type NatoriInquiryLogEntry = {
  /** 例: 見積もりメール送信 / 支払い依頼メール送信 / 入金確認（Stripe） / 見送り */
  label: string;
  /** "2026-07-12" 形式 */
  dateISO: string;
  /** ログ本文（複数行は改行区切りで保持） */
  body: string;
};

export type NatoriInquiryNoteView = {
  /** フォーム自動起票のメモかどうか */
  isAutoInquiry: boolean;
  /** 依頼者のメールアドレス（自動起票の「メール:」行） */
  email: string | null;
  /** 種類・プラン・オプション・予算・納期などのラベル付き項目（値が "-" のものは除外） */
  fields: Array<{ label: string; value: string }>;
  /** 添付されたキャラクター資料画像のURL */
  refImages: string[];
  /** 画像以外の資料テキスト（旧形式の参考URLなど） */
  refText: string;
  /** ご依頼の詳細 */
  details: string;
  /** その他・ご質問 */
  message: string;
  /** 対応履歴（古い順） */
  logs: NatoriInquiryLogEntry[];
  /** 自動起票でないメモの本文（手入力案件用。ログ部分を除く） */
  plainNote: string;
};

const AUTO_HEADER = "【ご依頼フォームからの自動起票】";
const LOG_START_RE = /^【(.+?)\s+(\d{4}-\d{2}-\d{2})】(.*)$/;
const SECTION_RE = /^---\s*(.+?)\s*---$/;

export function parseInquiryNote(note: string | null | undefined): NatoriInquiryNoteView {
  const empty: NatoriInquiryNoteView = {
    isAutoInquiry: false,
    email: null,
    fields: [],
    refImages: [],
    refText: "",
    details: "",
    message: "",
    logs: [],
    plainNote: "",
  };
  if (!note || !note.trim()) return empty;

  const lines = note.split(/\r?\n/);

  // ログは常にメモ末尾へ追記されるので、最初のログ開始行から後ろをログ扱いにする
  const firstLogIndex = lines.findIndex((line) => LOG_START_RE.test(line.trim()));
  const contentLines = firstLogIndex >= 0 ? lines.slice(0, firstLogIndex) : lines;
  const logLines = firstLogIndex >= 0 ? lines.slice(firstLogIndex) : [];

  const logs: NatoriInquiryLogEntry[] = [];
  for (const raw of logLines) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(LOG_START_RE);
    if (match) {
      logs.push({ label: match[1], dateISO: match[2], body: match[3].trim() });
    } else if (logs.length > 0) {
      const current = logs[logs.length - 1];
      current.body = current.body ? `${current.body}\n${line}` : line;
    }
  }

  const contentText = contentLines.join("\n").trim();
  const isAutoInquiry = contentText.startsWith(AUTO_HEADER);
  if (!isAutoInquiry) {
    return { ...empty, logs, plainNote: contentText };
  }

  // セクションで分割（先頭部分はラベル行のかたまり）
  type Section = { name: string | null; lines: string[] };
  const sections: Section[] = [{ name: null, lines: [] }];
  for (const raw of contentText.split("\n")) {
    const line = raw.trim();
    if (line === AUTO_HEADER) continue;
    const section = line.match(SECTION_RE);
    if (section) {
      sections.push({ name: section[1], lines: [] });
    } else {
      sections[sections.length - 1].lines.push(raw);
    }
  }

  let email: string | null = null;
  const fields: Array<{ label: string; value: string }> = [];
  for (const raw of sections[0].lines) {
    const line = raw.trim();
    if (!line) continue;
    const sep = line.indexOf(": ");
    if (sep < 0) continue;
    const label = line.slice(0, sep).trim();
    const value = line.slice(sep + 2).trim();
    if (!value || value === "-") continue;
    if (label === "メール") {
      email = value;
    } else {
      fields.push({ label, value });
    }
  }

  const refImages: string[] = [];
  const refTextLines: string[] = [];
  let details = "";
  let message = "";
  for (const section of sections.slice(1)) {
    const name = section.name ?? "";
    const text = section.lines.join("\n").trim();
    if (name.includes("キャラクター資料")) {
      for (const raw of section.lines) {
        const line = raw.trim();
        if (!line || line === "-") continue;
        const image = line.match(/^添付画像\d+:\s*(\S+)$/);
        if (image) refImages.push(image[1]);
        else refTextLines.push(line);
      }
    } else if (name.includes("ご依頼の詳細")) {
      details = text;
    } else if (name.includes("その他")) {
      message = text;
    }
  }

  return {
    isAutoInquiry,
    email,
    fields,
    refImages,
    refText: refTextLines.join("\n"),
    details,
    message,
    logs,
    plainNote: "",
  };
}

/**
 * 問い合わせの内容を、見積もりツールの「依頼文を貼り付け」欄に入れる
 * テキストに組み立てる（/natori/estimate?inquiry=<id> の深リンク連携用）。
 * 料金表のキーワード判定（全身・背景・商用など）が効くよう、
 * ラベル付き項目と詳細本文をそのまま並べる。
 */
export function buildEstimateInputFromInquiry(view: NatoriInquiryNoteView): string {
  const lines: string[] = [];
  for (const field of view.fields) {
    lines.push(`${field.label}: ${field.value}`);
  }
  if (view.details) {
    lines.push("", view.details);
  }
  if (view.message) {
    lines.push("", view.message);
  }
  return lines.join("\n").trim();
}

/** 最後の対応日（ログの最新日付。ログが無ければ fallback = 受付日） */
export function getInquiryLastActivityISO(
  view: NatoriInquiryNoteView,
  fallbackISO: string
): string {
  let latest = fallbackISO;
  for (const log of view.logs) {
    if (log.dateISO > latest) latest = log.dateISO;
  }
  return latest;
}

/** ISO日付から today までの経過日数（today より未来なら 0） */
export function daysSinceISO(iso: string, today: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const from = new Date(y, m - 1, d);
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  return Math.max(0, diff);
}
