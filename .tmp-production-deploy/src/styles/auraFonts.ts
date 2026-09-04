// src/styles/auraFonts.ts

export type FontPreset =
  | "cleanJa"
  | "modernSans"
  | "formalMincho"
  | "cuteRound"
  | "popBold"
  | "techMono"
  | "luxurySerif"
  | "retroPixel"
  // ✅ me-ish / homepage 用（Tailwind class を信用しない止血用）
  | "zen"
  | "lilita"
  // --- legacy aliases（過去データ互換用） ---
  | "formalJa"
  | "cuteJa"
  | "globalBold"
  | "serifJa"
  | "retroPop";

/**
 * FontPreset → 実際に付与するクラス名
 * - ai-portfolio 側は既存どおり ai-portfolio-font-xxx を使用
 * - zen / lilita は "font-zen" / "font-lilita" を返す（CSS 側で実体化する前提）
 *
 * （Tailwind の safelist と globals.css / auraFonts.css 側で定義）
 */
const PRESET_TO_CLASS: Record<FontPreset, string> = {
  // 新プリセット（aura）
  cleanJa: "ai-portfolio-font-cleanJa",
  modernSans: "ai-portfolio-font-modernSans",
  formalMincho: "ai-portfolio-font-formalMincho",
  cuteRound: "ai-portfolio-font-cuteRound",
  popBold: "ai-portfolio-font-popBold",
  techMono: "ai-portfolio-font-techMono",
  luxurySerif: "ai-portfolio-font-luxurySerif",
  retroPixel: "ai-portfolio-font-retroPixel",

  // ✅ homepage/me-ish 用（止血）
  // ※ Tailwind の fontFamily が壊れていても、CSS に `.font-zen{...}` があれば必ず効く
  zen: "font-zen",
  lilita: "font-lilita",

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

  const map = PRESET_TO_CLASS as Record<string, string>;
  if (map[preset]) return map[preset];

  return PRESET_TO_CLASS.cleanJa;
}

/**
 * UI などで一覧を出したくなったとき用
 */
export const AVAILABLE_FONT_PRESETS: { id: FontPreset; label: string }[] = [
  { id: "cleanJa", label: "Clean JP Sans" },
  { id: "modernSans", label: "Modern Sans" },
  { id: "formalMincho", label: "Formal Mincho" },
  { id: "cuteRound", label: "Cute Round" },
  { id: "popBold", label: "Pop Bold" },
  { id: "techMono", label: "Tech Mono" },
  { id: "luxurySerif", label: "Luxury Serif" },
  { id: "retroPixel", label: "Retro Pixel" },

  // ✅ homepage/me-ish 用（必要ならUIに出せる）
  { id: "zen", label: "Zen Maru Gothic" },
  { id: "lilita", label: "Lilita One" },
];
