// src/styles/aiPortfolioFonts.ts

export type FontPreset =
  | "cleanJa"
  | "modernSans"
  | "formalMincho"
  | "cuteRound"
  | "popBold"
  | "techMono"
  | "luxurySerif"
  | "retroPixel"
  // --- legacy aliases（過去データ互換用） ---
  | "formalJa"
  | "cuteJa"
  | "globalBold"
  | "serifJa"
  | "retroPop";

/**
 * FontPreset → 実際に付与するクラス名
 * （Tailwind の safelist と globals.css 側で定義）
 */
const PRESET_TO_CLASS: Record<FontPreset, string> = {
  // 新プリセット
  cleanJa: "ai-portfolio-font-cleanJa",
  modernSans: "ai-portfolio-font-modernSans",
  formalMincho: "ai-portfolio-font-formalMincho",
  cuteRound: "ai-portfolio-font-cuteRound",
  popBold: "ai-portfolio-font-popBold",
  techMono: "ai-portfolio-font-techMono",
  luxurySerif: "ai-portfolio-font-luxurySerif",
  retroPixel: "ai-portfolio-font-retroPixel",

  // 互換用エイリアス
  formalJa: "ai-portfolio-font-formalMincho",
  cuteJa: "ai-portfolio-font-cuteRound",
  globalBold: "ai-portfolio-font-popBold",
  serifJa: "ai-portfolio-font-luxurySerif",
  retroPop: "ai-portfolio-font-retroPixel",
};

/**
 * 不正値が来ても必ず何かしら返す安全版
 */
export function fontFamilyFromPreset(preset?: string | null): string {
  if (!preset) return PRESET_TO_CLASS.cleanJa;

  if ((PRESET_TO_CLASS as Record<string, string>)[preset]) {
    return (PRESET_TO_CLASS as Record<string, string>)[preset];
  }

  return PRESET_TO_CLASS.cleanJa;
}

/** UI などで一覧を出したくなったとき用 */
export const AVAILABLE_FONT_PRESETS: { id: FontPreset; label: string }[] = [
  { id: "cleanJa", label: "Clean JP Sans" },
  { id: "modernSans", label: "Modern Sans" },
  { id: "formalMincho", label: "Formal Mincho" },
  { id: "cuteRound", label: "Cute Round" },
  { id: "popBold", label: "Pop Bold" },
  { id: "techMono", label: "Tech Mono" },
  { id: "luxurySerif", label: "Luxury Serif" },
  { id: "retroPixel", label: "Retro Pixel" },
];

