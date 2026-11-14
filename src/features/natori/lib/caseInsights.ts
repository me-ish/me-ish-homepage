// 案件ごとの「振り返り用の記録」。依頼の経路・見送りの理由・リピーターかどうか。
// どれも選択肢の値だけで、依頼者を指す情報を持たない（匿名化のあとも残す）。
import { z } from "zod";

export const CASE_SOURCES = ["x", "pixiv", "tsunagu", "referral", "other"] as const;
export const CASE_CLOSE_REASONS = ["budget", "schedule", "content", "no_reply", "other"] as const;

export type CaseSource = (typeof CASE_SOURCES)[number];
export type CaseCloseReason = (typeof CASE_CLOSE_REASONS)[number];

export const CASE_SOURCE_LABELS: Record<CaseSource, string> = {
  x: "X",
  pixiv: "pixiv",
  tsunagu: "つなぐ",
  referral: "紹介",
  other: "その他",
};

export const CASE_CLOSE_REASON_LABELS: Record<CaseCloseReason, string> = {
  budget: "予算が合わない",
  schedule: "納期が合わない",
  content: "内容が合わない",
  no_reply: "連絡が途絶えた",
  other: "その他",
};

export type CaseInsights = {
  source: CaseSource | null;
  closeReason: CaseCloseReason | null;
  repeatClient: boolean | null;
};

export const EMPTY_CASE_INSIGHTS: CaseInsights = { source: null, closeReason: null, repeatClient: null };

export const caseInsightsShape = z.object({
  source: z.enum(CASE_SOURCES).nullable(),
  closeReason: z.enum(CASE_CLOSE_REASONS).nullable(),
  repeatClient: z.boolean().nullable(),
});

/** 画面からの保存。渡された項目だけを書き換える。 */
export const caseInsightsUpdate = z.strictObject({
  projectId: z.uuid(),
  patch: caseInsightsShape.partial().refine((patch) => Object.keys(patch).length > 0),
});

/** 見送りのメモに残す 1 行。「予算が合わない：もう少し詳しく」の形。 */
export function closeReasonNote(kind: CaseCloseReason, detail: string): string {
  const label = CASE_CLOSE_REASON_LABELS[kind];
  const text = detail.trim();
  return text ? `${label}：${text}` : label;
}
