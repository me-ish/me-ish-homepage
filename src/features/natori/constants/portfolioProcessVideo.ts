// features/natori/constants/portfolioProcessVideo.ts
// 制作過程の動画（タイムラプス）セクションの定数。
import type { PortfolioProcessVideoShape } from "@/features/natori/types/portfolio";

export const PROCESS_VIDEO_SHAPES = [
  "landscape",
  "square",
  "portrait",
] as const satisfies readonly PortfolioProcessVideoShape[];

export const PROCESS_VIDEO_SHAPE_LABELS: Record<PortfolioProcessVideoShape, string> = {
  landscape: "横長（16:9）",
  square: "正方形",
  portrait: "縦長（9:16）",
};

export const PROCESS_VIDEO_DEFAULT_SHAPE: PortfolioProcessVideoShape = "landscape";

/** 見出し「制作過程」の下に出す一文。編集画面で説明を書いていないときに使う */
export const PROCESS_VIDEO_DEFAULT_CAPTION = "作品ができるまでの様子を、早送りでご覧いただけます。";
