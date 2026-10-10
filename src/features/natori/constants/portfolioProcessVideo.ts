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

/** 動画ファイルを置く公開バケットとフォルダ。保存できる公開URLの形はこの2つで決まる */
export const PROCESS_VIDEO_BUCKET = "natori-portfolio";
export const PROCESS_VIDEO_FOLDER = "videos";

/** 動画ファイルの形式。どのブラウザでも再生できる MP4（H.264）だけを受け付ける */
export const PROCESS_VIDEO_FILE_CONTENT_TYPE = "video/mp4";
export const PROCESS_VIDEO_FILE_EXTENSION = ".mp4";

/** 動画ファイルの大きさの上限。Supabase Storage の既定の上限（50MiB）に収まる値にしている */
export const PROCESS_VIDEO_FILE_MAX_BYTES = 50_000_000;
export const PROCESS_VIDEO_FILE_MAX_LABEL = "50MB";
