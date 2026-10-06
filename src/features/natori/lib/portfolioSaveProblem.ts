// features/natori/lib/portfolioSaveProblem.ts
// ポートフォリオ編集の保存前検証で弾かれたとき、どの欄が原因かを調べる（DB非依存の純関数）。
// 検証そのものは preparePortfolioContentForSave と同じ schema・同じ正規化を使う。
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { normalizePortfolioContentForSave, portfolioContentSchema } from "./portfolioContent";

/**
 * PortfolioContent のトップレベル項目 → 編集画面のセクション id。
 * id は PortfolioEditor の SECTION_NAV / SectionCard の id と一致させる。
 */
export const PORTFOLIO_SECTION_ID_BY_CONTENT_KEY: Readonly<Record<string, string>> = {
  commissionOpen: "section-status",
  massProductionIllustrationOpen: "section-status",
  artistName: "section-basic",
  roleEn: "section-basic",
  heroTitleAccent: "section-basic",
  heroTitleTail: "section-basic",
  heroDescription: "section-basic",
  copyright: "section-basic",
  heroImage: "section-images",
  heroImages: "section-images",
  aboutImage: "section-images",
  massProductionSamples: "section-images",
  profileName: "section-profile",
  profileRole: "section-profile",
  aboutParagraphs: "section-profile",
  services: "section-services",
  collections: "section-collections",
  galleryIntro: "section-works",
  works: "section-works",
  plans: "section-plans",
  options: "section-options",
  deliveryLead: "section-delivery",
  deliveryNotes: "section-delivery",
  workflow: "section-workflow",
  requests: "section-requests",
  faqs: "section-faqs",
  socialLinks: "section-sns",
};

export type PortfolioSaveProblemReason = "too-long" | "too-many" | "format";

export type PortfolioSaveProblem = {
  /** 編集画面のセクション id（特定できない項目は null） */
  sectionId: string | null;
  /** 一覧項目の中の問題なら 0 始まりの位置（「3件目」の表示は +1 する） */
  itemIndex: number | null;
  reason: PortfolioSaveProblemReason;
  /** reason が "too-long" / "too-many" のときの上限（文字数 / 件数） */
  limit: number | null;
  /** schema 側が日本語で用意した理由（関連リンクの URL 形式など） */
  detail: string | null;
};

type IssueLike = {
  code: string;
  path: ReadonlyArray<PropertyKey>;
  message?: string;
  origin?: string;
  maximum?: number | bigint;
};

function containsJapanese(text: string): boolean {
  return /[぀-ヿ㐀-鿿]/u.test(text);
}

/**
 * 保存前検証で弾かれる内容のうち、最初の問題の場所と理由を返す。問題がなければ null。
 * 表示用の文言は呼び出し側（編集画面）が組み立てる。
 */
export function findPortfolioSaveProblem(content: PortfolioContent): PortfolioSaveProblem | null {
  const result = portfolioContentSchema.safeParse(normalizePortfolioContentForSave(content));
  if (result.success) return null;
  const issue = result.error.issues[0] as IssueLike | undefined;
  if (!issue) return null;

  const [first, second] = issue.path;
  const key = typeof first === "string" ? first : null;
  const sectionId = key ? (PORTFOLIO_SECTION_ID_BY_CONTENT_KEY[key] ?? null) : null;
  const itemIndex = typeof second === "number" ? second : null;

  if (issue.code === "too_big" && typeof issue.maximum !== "undefined") {
    const limit = Number(issue.maximum);
    // 配列そのものの上限か、文字列の上限かは origin で分かる
    if (issue.origin === "array") {
      return { sectionId, itemIndex: null, reason: "too-many", limit, detail: null };
    }
    if (issue.origin === "string") {
      return { sectionId, itemIndex, reason: "too-long", limit, detail: null };
    }
  }
  const detail =
    issue.code === "custom" && issue.message && containsJapanese(issue.message) ? issue.message : null;
  return { sectionId, itemIndex, reason: "format", limit: null, detail };
}
