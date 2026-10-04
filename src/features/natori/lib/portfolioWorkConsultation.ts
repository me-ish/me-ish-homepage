// features/natori/lib/portfolioWorkConsultation.ts
// 作品の拡大表示にある「この雰囲気で相談する」から来たときに、ご依頼フォームへ入れておく文面。
// お客さまが送信前に読んで書き換えられる欄にだけ入れ、送信の仕組みは変えない。
import type { PortfolioWork } from "@/features/natori/types/portfolio";

/** フォームへ引き継ぐ作品。公開中で画像のある作品だけ（URLを直接書き換えても非公開作品の名前は出さない）。 */
export function portfolioConsultationWork(
  works: PortfolioWork[],
  workId: string | undefined,
): PortfolioWork | null {
  if (!workId) return null;
  const work = works.find((candidate) => candidate.id === workId);
  return work && work.published && work.image ? work : null;
}

function workLabel(title: string): string {
  const name = title.trim();
  return name ? `掲載作品「${name}」` : "掲載作品";
}

/** 構造化フォームの「内容」欄に入れる1文。 */
export function portfolioWorkConsultationMessage(title: string): string {
  return `${workLabel(title)}の雰囲気で相談したいです。`;
}

/** 旧フォームの「ご依頼の詳細」テンプレートの先頭に、参考にしたい作品を足す。 */
export function withPortfolioConsultationWork(template: string, title: string): string {
  return `【参考にしたい作品】\n${workLabel(title)}\n\n${template}`;
}
