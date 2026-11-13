// features/natori/lib/portfolioClientEstimate.ts
// 依頼フォームの「この内容の目安」。先生の画面で見積もりの下書きを作るのと同じ計算
// （createNatoriEstimateSuggestionV1）を使い、依頼者が見る金額と先生が最初に見る金額をそろえる。
// 金額として読めない料金は足さず、「別途」として名前だけ返す。確定はあくまで正式な見積もり。
import {
  createPortfolioStructuredPricingConfig,
  parsePortfolioYenRange,
} from "@/features/natori/lib/portfolioPricing";
import { createNatoriEstimateSuggestionV1 } from "@/features/natori/lib/pricingSuggestion";
import {
  buildNatoriRequestDataV1,
  type PortfolioOptionChoice,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

export type PortfolioClientEstimateLine = {
  id: string;
  label: string;
  quantity: number;
  /** この行の金額（幅があるときは下限） */
  amount: number;
  /** 幅があるときの上限 */
  amountMax: number;
  base: boolean;
};

export type PortfolioClientEstimate = {
  lines: PortfolioClientEstimateLine[];
  min: number;
  max: number;
  /** 選んだが金額を足せなかったもの（料金が金額として読めない・個別見積もり） */
  unpriced: string[];
};

const BASE_KINDS = new Set(["base"]);

/**
 * 基本料金が決まる選択（SD／胸上／膝〜腰上／全身／量産イラスト）のときだけ返す。
 * 「それ以外」や未選択では null（金額を出さない）。
 */
export function portfolioClientEstimate(
  state: PortfolioRequestFormState,
  choices: PortfolioOptionChoice[],
  content: PortfolioContent,
): PortfolioClientEstimate | null {
  const requestData = buildNatoriRequestDataV1(state, choices);
  const suggestion = createNatoriEstimateSuggestionV1({
    // 種別からの基本料金は使わない。範囲・SD・量産で決まったときだけ目安を出す。
    projectType: "undecided",
    requestData,
    pricingConfig: createPortfolioStructuredPricingConfig(content),
  });
  if (!suggestion.automaticItems.some((item) => BASE_KINDS.has(item.kind))) return null;

  const lines = suggestion.automaticItems.map((item): PortfolioClientEstimateLine => {
    const range = item.kind === "fixed"
      ? parsePortfolioYenRange(content.options.find((option) => option.id === item.presetItemId)?.price ?? "")
      : null;
    const amountMax = range && range.min === item.unitAmount ? range.max * item.quantity : item.amount;
    return {
      id: item.presetItemId,
      label: item.labelSnapshot,
      quantity: item.quantity,
      amount: item.amount,
      amountMax: Math.max(item.amount, amountMax),
      base: item.kind === "base",
    };
  });
  const priced = new Set(lines.map((line) => line.id));
  const unpriced = requestData.options
    .filter((option) => !priced.has(option.id))
    .map((option) => option.label);
  return {
    lines,
    min: lines.reduce((sum, line) => sum + line.amount, 0),
    max: lines.reduce((sum, line) => sum + line.amountMax, 0),
    unpriced: [...new Set(unpriced)],
  };
}

export function formatPortfolioEstimateRange(min: number, max: number): string {
  const yen = (value: number) => value.toLocaleString("ja-JP");
  return max > min ? `${yen(min)}〜${yen(max)}円` : `${yen(min)}円`;
}
