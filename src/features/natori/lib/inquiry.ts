import type { NatoriProjectType } from "@/features/natori/types/projects";

/**
 * ご依頼フォーム（/natori/portfolio）の入力から、案件（natori_projects）の
 * 下書きを組み立てる純関数群。DB 非依存でテストできるようにここに置く。
 * Phase 1: フォーム送信を `inquiry` ステータスの案件として自動起票する。
 */

export type NatoriInquiryInput = {
  name: string;
  email: string;
  requestType: string;
  plan?: string;
  options?: string[];
  budget?: string;
  deadline?: string;
  refUrls?: string;
  /** フォームから添付されたキャラクター資料画像の公開URL */
  refImages?: string[];
  details: string;
  message?: string;
};

/**
 * 依頼種別・プラン文言から案件タイプ（icon/sd/standing/illustration）を推定する。
 * 判定できないものは illustration（一枚絵）に寄せる。ナトリ先生が案件画面で
 * あとから直せる前提の、あくまで初期値。
 */
export function inferNatoriProjectType(requestType: string, plan?: string): NatoriProjectType {
  const haystack = `${requestType} ${plan ?? ""}`;
  if (/アイコン|icon/i.test(haystack)) return "icon";
  if (/立ち絵|立絵|standing/i.test(haystack)) return "standing";
  if (/\bSD\b|ちび|デフォルメ|chibi/i.test(haystack)) return "sd";
  return "illustration";
}

/** 案件一覧・カレンダーで見て分かるタイトルを作る。 */
export function buildInquiryTitle(input: NatoriInquiryInput): string {
  const plan = input.plan?.trim();
  const base = input.requestType.trim() || "ご依頼";
  if (plan && !plan.startsWith("未定")) {
    return `${base}・${plan}`;
  }
  return base;
}

/**
 * フォームの全項目を、案件のメモ欄に読める形でまとめる。メール本文と同じ内容を
 * 案件側にも残すことで、メールを見落としても案件から全容を追える。
 */
export function buildInquiryNote(input: NatoriInquiryInput): string {
  const options = input.options && input.options.length ? input.options.join(" / ") : "なし";
  const refLines = [
    ...(input.refImages ?? []).map((url, index) => `添付画像${index + 1}: ${url}`),
    ...(input.refUrls?.trim() ? [input.refUrls.trim()] : []),
  ];
  const lines: string[] = [
    "【ご依頼フォームからの自動起票】",
    `メール: ${input.email}`,
    `ご依頼の種類: ${input.requestType || "-"}`,
    `サイズ / プラン: ${input.plan?.trim() || "-"}`,
    `追加オプション: ${options}`,
    `ご予算: ${input.budget?.trim() || "-"}`,
    `希望納期: ${input.deadline?.trim() || "-"}`,
    "",
    "--- キャラクター資料 ---",
    refLines.length ? refLines.join("\n") : "-",
    "",
    "--- ご依頼の詳細 ---",
    input.details.trim(),
  ];
  const message = input.message?.trim();
  if (message) {
    lines.push("", "--- その他・ご質問 ---", message);
  }
  return lines.join("\n");
}

export type NatoriInquiryProjectDraft = {
  title: string;
  clientName: string;
  type: NatoriProjectType;
  note: string;
};

/** フォーム入力から案件下書き（タイトル・依頼者名・タイプ・メモ）を作る。 */
export function buildInquiryProjectDraft(input: NatoriInquiryInput): NatoriInquiryProjectDraft {
  return {
    title: buildInquiryTitle(input),
    clientName: input.name.trim(),
    type: inferNatoriProjectType(input.requestType, input.plan),
    note: buildInquiryNote(input),
  };
}
