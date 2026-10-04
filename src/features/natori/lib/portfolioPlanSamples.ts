// features/natori/lib/portfolioPlanSamples.ts
// 料金表に添える作例を、プランの sampleWorkId と掲載中の作品から選ぶ純関数。
import type { PortfolioPlan, PortfolioWork } from "@/features/natori/types/portfolio";

export type PortfolioPlanSample = {
  title: string;
  image: string;
};

/** 公開中で画像のある作品だけを作例にする。未設定・非公開・削除済み・画像なしなら null。 */
export function portfolioPlanSample(
  plan: Pick<PortfolioPlan, "sampleWorkId">,
  works: PortfolioWork[],
): PortfolioPlanSample | null {
  if (!plan.sampleWorkId) return null;
  const work = works.find((candidate) => candidate.id === plan.sampleWorkId);
  if (!work || !work.published || !work.image) return null;
  return { title: work.title, image: work.image };
}
