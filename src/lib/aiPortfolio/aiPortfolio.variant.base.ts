// src/lib/aiPortfolio/aiPortfolio.variant.base.ts

/** 世界観（10種） */
export const WORLDVIEWS = [
  "minimal",
  "modern",
  "business",
  "cute",
  "pop",
  "dark",
  "cyber",
  "natural",
  "luxury",
  "retro",
] as const;
export type Worldview = (typeof WORLDVIEWS)[number];

/** パターン（UI側セレクトとマッピングで対応） */
export const PATTERNS = [
  "none",

  // dot family
  "dot-soft",        // 小さめ・控えめドット
  "dot-retro",       // 大粒レトロドット
  "dot-dense-noise", // 細かいドットでノイズ寄り

  // stripe family
  "stripe-vertical-soft", // うっすら縦ストライプ
  "stripe-vertical-bold", // しっかり縦ストライプ
  "stripe-diagonal",      // 斜めストライプ

  // grid family
  "grid-thin",  // 細線グリッド
  "grid-neon",  // サイバー寄りグリッド

  // texture family
  "texture-paper", // 紙っぽいムラ
  "texture-noise", // ラフなノイズ
] as const;
export type PatternId = (typeof PATTERNS)[number];

/** 表面の質感 */
export const SURFACES = [
  "simple",
  "card",
  "glass",
  "paper",
  "neon",
  "dark",
] as const;
export type Surface = (typeof SURFACES)[number];

/** 作品の見せ方 */
export const SHOWCASES = ["gallery", "masonry", "card", "textRich"] as const;
export type Showcase = (typeof SHOWCASES)[number];

/** レイアウト傾向 */
export const LAYOUTS = ["center", "split"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** 角丸 */
export const RADII = ["none", "soft", "pill"] as const;
export type Radius = (typeof RADII)[number];

export const DENSITIES = ["compact", "normal", "airy", "dense"] as const;
export type Density = (typeof DENSITIES)[number];

export type VariantSpec = {
  id: string;
  worldview: Worldview;
  showcase: Showcase;
  surface: Surface;
  layout: Layout;
  pattern: PatternId;
  radius: Radius;
  shadow: "none" | "soft" | "strong";
  density: Density;
  label?: string;
};

/**
 * 代表的なバリアント一覧
 * （AI側はここから「それっぽい」ものを選んで使う）
 */
export const VARIANTS: VariantSpec[] = [
  {
    id: "minimalClean",
    worldview: "minimal",
    showcase: "gallery",
    surface: "simple",
    layout: "center",
    pattern: "none", // 余白重視
    radius: "soft",
    shadow: "none",
    density: "normal",
  },
  {
    id: "businessGalleryCenter",
    label: "Business / Gallery (center)",
    worldview: "business",
    showcase: "gallery",
    surface: "card",              // 好きな surface に調整してOK
    layout: "center",
    pattern: "none",
    radius: "soft",
    shadow: "soft",
    density: "normal",
  },
  {
    id: "businessGallerySplit",
    label: "Business / Gallery (split)",
    worldview: "business",
    showcase: "gallery",
    surface: "card",
    layout: "split",
    pattern: "none",
    radius: "soft",
    shadow: "soft",
    density: "normal",
  },
  {
    id: "cardGrid",
    worldview: "modern",
    showcase: "card",
    surface: "card",
    layout: "split",
    pattern: "grid-thin", // きれいめグリッド
    radius: "soft",
    shadow: "soft",
    density: "normal",
  },
  {
    id: "popMasonry",
    worldview: "pop",
    showcase: "masonry",
    surface: "card",
    layout: "center",
    pattern: "stripe-diagonal", // 動きのあるポップ系
    radius: "soft",
    shadow: "strong",
    density: "compact",
  },
  {
    id: "darkHero",
    worldview: "dark",
    showcase: "gallery",
    surface: "dark",
    layout: "split",
    pattern: "texture-noise", // ダーク寄りノイズ
    radius: "soft",
    shadow: "strong",
    density: "normal",
  },
  {
    id: "naturalGrid",
    worldview: "natural",
    showcase: "gallery",
    surface: "paper",
    layout: "center",
    pattern: "texture-paper", // 紙系テクスチャ
    radius: "soft",
    shadow: "soft",
    density: "airy",
  },
  {
    id: "textHeavyCard",
    worldview: "modern",
    showcase: "textRich",
    surface: "card",
    layout: "split",
    pattern: "texture-paper", // 読ませる系なので控えめテクスチャ
    radius: "soft",
    shadow: "soft",
    density: "dense",
  },
];
