// features/natori/components/portfolio/edit/portfolioSaveProblemMessage.ts
// 保存できなかった場所（findPortfolioSaveProblem の結果）を、編集画面に出す日本語の一文にする。
import type { PortfolioSaveProblem } from "@/features/natori/lib/portfolioSaveProblem";

/**
 * 例: 「作品」の3件目に、文字数が上限（200文字）を超えている欄があります。
 * sectionLabel が分からないとき（編集画面に欄がない項目）は null を渡すと、場所を言わない一文になる。
 */
export function describePortfolioSaveProblem(
  problem: PortfolioSaveProblem,
  sectionLabel: string | null
): string {
  const where = sectionLabel
    ? `「${sectionLabel}」${problem.itemIndex !== null ? `の${problem.itemIndex + 1}件目` : ""}`
    : "";
  if (problem.reason === "too-many") {
    return where
      ? `${where}の項目数が上限（${problem.limit}件）を超えています。`
      : `項目数が上限（${problem.limit}件）を超えているところがあります。`;
  }
  if (problem.reason === "too-long") {
    return where
      ? `${where}に、文字数が上限（${problem.limit}文字）を超えている欄があります。`
      : `文字数が上限（${problem.limit}文字）を超えている欄があります。`;
  }
  if (problem.detail) {
    const detail = problem.detail.replace(/。$/u, "");
    return where ? `${where}：${detail}。` : `${detail}。`;
  }
  return where ? `${where}に、空欄や形式を確認してほしい欄があります。` : "空欄や形式を確認してください。";
}
