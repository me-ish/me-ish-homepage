// src/lib/aiPortfolio/aiPortfolio.worldviewPresets.ts

import type { CSSProperties } from "react";
import type { LayoutPref } from "./aiPortfolio.layout";

/** 世界観（10種） */
export type WorldviewBase =
  | "minimal"
  | "modern"
  | "business"
  | "cute"
  | "pop"
  | "dark"
  | "cyber"
  | "natural"
  | "luxury"
  | "retro";

/** サーフェススタイル（Variant の SURFACES と揃えておく） */
export type SurfaceStyle =
  | "simple"
  | "card"
  | "glass"
  | "paper"
  | "neon"
  | "dark";

/** 世界観プリセット 1件ぶんの構造 */
export type WorldviewPreset = {
  id: WorldviewBase;
  label: string;
  description: string;

  // カラーパレット（ThemeSchema と 1:1 対応）
  colorPrimary: string;
  colorAccent: string;
  colorBG: string;
  colorText: string;
  bgGradient?: string;

  // 三種の神器
  surfaceStyle: SurfaceStyle;
  patternBase: string; // Pattern ID（"dot-soft" など）
  layoutPref: LayoutPref; // "center" | "split"

  // その他の初期値
  showcaseStyle: "gallery" | "masonry" | "card" | "textRich";
  languageMode: "ja" | "en";
  fontPreset: string;

  // NEW: 背景レイヤー情報（ThemeSchema.patternLayers / textureLayers 用）
  patternLayers?: string[];
  textureLayers?: string[];

  // フォーム PREVIEW / 本番共通のリッチ背景（ThemeSchema.bgStyle）
  bgStyle?: CSSProperties;
};

/* -------------------------------------------------
 *  カラーパレット（フォーム / 本番共通）
 * ------------------------------------------------- */

const COLOR_PRESETS: Record<
  WorldviewBase,
  {
    primary: string;
    accent: string;
    bg: string;
    text: string;
    gradient?: string;
  }
> = {
  minimal: {
    primary: "#111827",
    accent: "#6B7280",
    bg: "#F9FAFB",
    text: "#111827",
    gradient: "linear-gradient(145deg, #ffffff 0%, #f3f4f6 100%)",
  },
  modern: {
    primary: "#38BDF8",
    accent: "#6366F1",
    bg: "#020617",
    text: "#E5E7EB",
    gradient: "linear-gradient(145deg, #0f172a 0%, #020617 100%)",
  },
  business: {
    primary: "#2563EB",
    accent: "#0F172A",
    bg: "#EFF6FF",
    text: "#111827",
    gradient: "linear-gradient(145deg, #e2e8f0 0%, #f8fafc 100%)",
  },
  cute: {
    primary: "#FB7185",
    accent: "#FDBA74",
    bg: "#FEF2F2",
    text: "#7F1D1D",
    gradient: "linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)",
  },
  pop: {
    primary: "#F97316",
    accent: "#EC4899",
    bg: "#FEF3C7",
    text: "#78350F",
    gradient: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%)",
  },
  dark: {
    primary: "#F97316",
    accent: "#E5E7EB",
    bg: "#020617",
    text: "#E5E7EB",
    gradient: "linear-gradient(145deg, #020617 0%, #020617 100%)",
  },
  cyber: {
    primary: "#22D3EE",
    accent: "#6366F1",
    bg: "#020617",
    text: "#E5E7EB",
    gradient: "linear-gradient(145deg, #020617 0%, #0f172a 50%, #1e293b 100%)",
  },
  natural: {
    primary: "#22C55E",
    accent: "#15803D",
    bg: "#F0FDF4",
    text: "#064E3B",
    gradient: "linear-gradient(145deg, #ecfdf5 0%, #dcfce7 100%)",
  },
  luxury: {
    primary: "#EAB308",
    accent: "#F97316",
    bg: "#1C1917",
    text: "#FAFAF5",
    gradient: "linear-gradient(145deg, #0c0a09 0%, #1c1917 60%, #292524 100%)",
  },
  retro: {
    primary: "#F97316",
    accent: "#10B981",
    bg: "#FFFBEB",
    text: "#422006",
    gradient: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)",
  },
};

/* -------------------------------------------------
 *  世界観ごとの CSS パターン（フォーム PREVIEW 用を正式採用）
 * ------------------------------------------------- */

const BG_STYLES: Record<WorldviewBase, CSSProperties> = {
  minimal: {
    backgroundColor: "#f9fafb",
    backgroundImage: "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)",
    backgroundSize: "24px 24px",
  },
  modern: {
    backgroundColor: "#f1f5f9",
    backgroundImage:
      "linear-gradient(135deg, #e2e8f0 25%, transparent 25%)," +
      "linear-gradient(225deg, #e2e8f0 25%, transparent 25%)," +
      "linear-gradient(45deg, #e2e8f0 25%, transparent 25%)," +
      "linear-gradient(315deg, #e2e8f0 25%, transparent 25%)",
    backgroundPosition: "10px 0, 10px 0, 0 0, 0 0",
    backgroundSize: "20px 20px",
    backgroundRepeat: "repeat",
  },
  business: {
    backgroundColor: "#eff6ff",
    backgroundImage:
      "linear-gradient(0deg, transparent 24%, #dbeafe 25%, #dbeafe 26%, transparent 27%, transparent 74%, #dbeafe 75%, #dbeafe 76%, transparent 77%, transparent)," +
      "linear-gradient(90deg, transparent 24%, #dbeafe 25%, #dbeafe 26%, transparent 27%, transparent 74%, #dbeafe 75%, #dbeafe 76%, transparent 77%, transparent)",
    backgroundSize: "50px 50px",
  },
  cute: {
    backgroundColor: "#fff1f2",
    backgroundImage:
      "radial-gradient(#fda4af 2px, transparent 2px), radial-gradient(#fda4af 2px, transparent 2px)",
    backgroundSize: "32px 32px",
    backgroundPosition: "0 0, 16px 16px",
  },
  pop: {
    backgroundColor: "#fffbeb",
    backgroundImage:
      "repeating-linear-gradient(45deg, #fde68a 0, #fde68a 2px, transparent 0, transparent 50%)",
    backgroundSize: "20px 20px",
  },
  dark: {
    backgroundColor: "#020617",
    backgroundImage: "radial-gradient(#334155 1.5px, transparent 1.5px)",
    backgroundSize: "20px 20px",
  },
  cyber: {
    backgroundColor: "#020617",
    backgroundImage:
      "linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px)," +
      "linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
  },
  natural: {
    backgroundColor: "#f0fdf4",
    backgroundImage:
      "repeating-linear-gradient(-45deg, #dcfce7, #dcfce7 5px, transparent 5px, transparent 25px)",
  },
  luxury: {
    backgroundColor: "#1c1917",
    backgroundImage:
      "linear-gradient(30deg, #44403c 12%, transparent 12.5%, transparent 87%, #44403c 87.5%, #44403c)," +
      "linear-gradient(150deg, #44403c 12%, transparent 12.5%, transparent 87%, #44403c 87.5%, #44403c)," +
      "linear-gradient(30deg, #44403c 12%, transparent 12.5%, transparent 87%, #44403c 87.5%, #44403c)," +
      "linear-gradient(150deg, #44403c 12%, transparent 12.5%, transparent 87%, #44403c 87.5%, #44403c)," +
      "linear-gradient(60deg, #78716c 25%, transparent 25.5%, transparent 75%, #78716c 75%, #78716c)," +
      "linear-gradient(60deg, #78716c 25%, transparent 25.5%, transparent 75%, #78716c 75%, #78716c)",
    backgroundSize: "40px 70px",
    backgroundPosition: "0 0, 0 0, 20px 35px, 20px 35px, 0 0, 20px 35px",
    opacity: 0.8,
  },
  retro: {
    backgroundColor: "#fffbeb",
    backgroundImage: "radial-gradient(#d97706 2px, transparent 2px)",
    backgroundSize: "16px 16px",
  },
};

/* -------------------------------------------------
 *  世界観ごとの「三種の神器」定義
 * ------------------------------------------------- */

const WORLDVIEW_DEFINITIONS: Record<
  WorldviewBase,
  {
    surface: SurfaceStyle;
    pattern: string;
    layout: LayoutPref;
  }
> = {
  minimal: {
    surface: "paper",
    pattern: "dot-soft",
    layout: "center",
  },
  modern: {
    surface: "glass",
    pattern: "grid-thin",
    layout: "split",
  },
  business: {
    surface: "card",
    pattern: "none",
    layout: "center",
  },
  cute: {
    surface: "simple",
    pattern: "dot-cute",
    layout: "center",
  },
  pop: {
    surface: "card",
    pattern: "stripe-diagonal",
    layout: "center",
  },
  dark: {
    surface: "dark",
    pattern: "grid-subtle",
    layout: "split",
  },
  cyber: {
    surface: "neon",
    pattern: "grid-cyber",
    layout: "split",
  },
  natural: {
    surface: "paper",
    pattern: "fiber-soft",
    layout: "center",
  },
  luxury: {
    surface: "glass",
    pattern: "diamond-soft",
    layout: "center",
  },
  retro: {
    surface: "paper",
    pattern: "dot-retro",
    layout: "center",
  },
};

/* -------------------------------------------------
 *  実際に使う PRESETS 本体
 * ------------------------------------------------- */

const PRESETS: Record<WorldviewBase, WorldviewPreset> = {
  minimal: {
    id: "minimal",
    label: "Minimal",
    description:
      "余白とタイポグラフィを主役にした、静かなミニマルデザイン。",
    colorPrimary: COLOR_PRESETS.minimal.primary,
    colorAccent: COLOR_PRESETS.minimal.accent,
    colorBG: COLOR_PRESETS.minimal.bg,
    colorText: COLOR_PRESETS.minimal.text,
    bgGradient: COLOR_PRESETS.minimal.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.minimal.surface,
    patternBase: WORLDVIEW_DEFINITIONS.minimal.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.minimal.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "cleanJa",
    patternLayers: ["texture-paper"], // generate 側での fallback と合わせて軽めに定義
    textureLayers: [],
    bgStyle: BG_STYLES.minimal,
  },
  modern: {
    id: "modern",
    label: "Modern",
    description:
      "コントラストとグリッドを効かせた、モダンでシャープな世界観。",
    colorPrimary: COLOR_PRESETS.modern.primary,
    colorAccent: COLOR_PRESETS.modern.accent,
    colorBG: COLOR_PRESETS.modern.bg,
    colorText: COLOR_PRESETS.modern.text,
    bgGradient: COLOR_PRESETS.modern.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.modern.surface,
    patternBase: WORLDVIEW_DEFINITIONS.modern.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.modern.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "modernSans",
    patternLayers: ["grid-thin", "texture-noise"],
    textureLayers: ["texture-noise"],
    bgStyle: BG_STYLES.modern,
  },
  business: {
    id: "business",
    label: "Business",
    description: "信頼感と読みやすさを重視した、ビジネスライクなトーン。",
    colorPrimary: COLOR_PRESETS.business.primary,
    colorAccent: COLOR_PRESETS.business.accent,
    colorBG: COLOR_PRESETS.business.bg,
    colorText: COLOR_PRESETS.business.text,
    bgGradient: COLOR_PRESETS.business.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.business.surface,
    patternBase: WORLDVIEW_DEFINITIONS.business.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.business.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "formalMincho",
    patternLayers: ["stripe-vertical-soft", "texture-paper"],
    textureLayers: ["texture-paper"],
    bgStyle: BG_STYLES.business,
  },
  cute: {
    id: "cute",
    label: "Cute",
    description:
      "丸みとパステルカラーでまとめた、やわらかく可愛い世界観。",
    colorPrimary: COLOR_PRESETS.cute.primary,
    colorAccent: COLOR_PRESETS.cute.accent,
    colorBG: COLOR_PRESETS.cute.bg,
    colorText: COLOR_PRESETS.cute.text,
    bgGradient: COLOR_PRESETS.cute.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.cute.surface,
    patternBase: WORLDVIEW_DEFINITIONS.cute.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.cute.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "cuteRound",
    patternLayers: ["dot-soft"],
    textureLayers: [],
    bgStyle: BG_STYLES.cute,
  },
  pop: {
    id: "pop",
    label: "Pop",
    description:
      "元気な色使いとリズムのあるパターンで見せるポップな世界観。",
    colorPrimary: COLOR_PRESETS.pop.primary,
    colorAccent: COLOR_PRESETS.pop.accent,
    colorBG: COLOR_PRESETS.pop.bg,
    colorText: COLOR_PRESETS.pop.text,
    bgGradient: COLOR_PRESETS.pop.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.pop.surface,
    patternBase: WORLDVIEW_DEFINITIONS.pop.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.pop.layout,
    showcaseStyle: "masonry",
    languageMode: "ja",
    fontPreset: "popBold",
    patternLayers: ["stripe-diagonal"],
    textureLayers: [],
    bgStyle: BG_STYLES.pop,
  },
  dark: {
    id: "dark",
    label: "Dark",
    description:
      "ダークトーンで作品を際立たせる、落ち着いた世界観。",
    colorPrimary: COLOR_PRESETS.dark.primary,
    colorAccent: COLOR_PRESETS.dark.accent,
    colorBG: COLOR_PRESETS.dark.bg,
    colorText: COLOR_PRESETS.dark.text,
    bgGradient: COLOR_PRESETS.dark.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.dark.surface,
    patternBase: WORLDVIEW_DEFINITIONS.dark.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.dark.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "techMono",
    patternLayers: ["texture-noise"],
    textureLayers: ["texture-noise"],
    bgStyle: BG_STYLES.dark,
  },
  cyber: {
    id: "cyber",
    label: "Cyber",
    description:
      "ネオンとグリッドで魅せるサイバーパンク寄りの世界観。",
    colorPrimary: COLOR_PRESETS.cyber.primary,
    colorAccent: COLOR_PRESETS.cyber.accent,
    colorBG: COLOR_PRESETS.cyber.bg,
    colorText: COLOR_PRESETS.cyber.text,
    bgGradient: COLOR_PRESETS.cyber.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.cyber.surface,
    patternBase: WORLDVIEW_DEFINITIONS.cyber.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.cyber.layout,
    showcaseStyle: "masonry",
    languageMode: "ja",
    fontPreset: "techMono",
    patternLayers: ["grid-neon", "texture-noise"],
    textureLayers: ["texture-noise"],
    bgStyle: BG_STYLES.cyber,
  },
  natural: {
    id: "natural",
    label: "Natural",
    description:
      "グリーンと柔らかな質感で構成した、ナチュラルで落ち着いた世界観。",
    colorPrimary: COLOR_PRESETS.natural.primary,
    colorAccent: COLOR_PRESETS.natural.accent,
    colorBG: COLOR_PRESETS.natural.bg,
    colorText: COLOR_PRESETS.natural.text,
    bgGradient: COLOR_PRESETS.natural.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.natural.surface,
    patternBase: WORLDVIEW_DEFINITIONS.natural.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.natural.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "cleanJa",
    patternLayers: ["texture-paper", "dot-soft"],
    textureLayers: [],
    bgStyle: BG_STYLES.natural,
  },
  luxury: {
    id: "luxury",
    label: "Luxury",
    description:
      "深いトーンと金色アクセントでまとめた、ラグジュアリーな世界観。",
    colorPrimary: COLOR_PRESETS.luxury.primary,
    colorAccent: COLOR_PRESETS.luxury.accent,
    colorBG: COLOR_PRESETS.luxury.bg,
    colorText: COLOR_PRESETS.luxury.text,
    bgGradient: COLOR_PRESETS.luxury.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.luxury.surface,
    patternBase: WORLDVIEW_DEFINITIONS.luxury.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.luxury.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "luxurySerif",
    patternLayers: ["stripe-vertical-soft", "texture-paper"],
    textureLayers: ["texture-paper"],
    bgStyle: BG_STYLES.luxury,
  },
  retro: {
    id: "retro",
    label: "Retro",
    description:
      "少し黄味がかったトーンとドット柄で構成したレトロ調の世界観。",
    colorPrimary: COLOR_PRESETS.retro.primary,
    colorAccent: COLOR_PRESETS.retro.accent,
    colorBG: COLOR_PRESETS.retro.bg,
    colorText: COLOR_PRESETS.retro.text,
    bgGradient: COLOR_PRESETS.retro.gradient,
    surfaceStyle: WORLDVIEW_DEFINITIONS.retro.surface,
    patternBase: WORLDVIEW_DEFINITIONS.retro.pattern,
    layoutPref: WORLDVIEW_DEFINITIONS.retro.layout,
    showcaseStyle: "gallery",
    languageMode: "ja",
    fontPreset: "retroPixel",
    patternLayers: ["dot-retro"],
    textureLayers: [],
    bgStyle: BG_STYLES.retro,
  },
};

/* -------------------------------------------------
 *  エクスポート
 * ------------------------------------------------- */

export const WORLDVIEW_PRESETS = PRESETS;
export const WORLDVIEW_KEYS = Object.keys(PRESETS) as WorldviewBase[];

/** フォームや generate 用のヘルパー */
export function getWorldviewPreset(
  id: WorldviewBase | string
): WorldviewPreset {
  if ((WORLDVIEW_KEYS as string[]).includes(id)) {
    return PRESETS[id as WorldviewBase];
  }
  // 万一不正値が来た場合は business をデフォルトに
  return PRESETS.business;
}
