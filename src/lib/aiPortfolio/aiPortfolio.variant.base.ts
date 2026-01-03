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
  "dot-cute",
  "dot-soft", // 小さめ・控えめドット
  "dot-retro", // 大粒レトロドット
  "dot-dense-noise", // 細かいドットでノイズ寄り

  // stripe family
  "stripe-vertical-soft", // うっすら縦ストライプ
  "stripe-vertical-bold", // しっかり縦ストライプ
  "stripe-diagonal", // 斜めストライプ

  // grid family
  "grid-thin", // 細線グリッド
  "grid-neon", // サイバー寄りグリッド

  // ✅ 追加（grid派生）
  "grid-subtle", // dark向け低コントラスト格子
  "grid-cyber", // cyber向け回路寄り格子

  // geo / tile family
  "tile-iso-cubes",
  "tile-iso-cubes-soft", // ✅ 追加：薄い版（modern/luxury向け）

  // luxury / geo
  "diamond-soft", // ✅ 追加：luxury本命

  // texture family
  "texture-paper", // 紙っぽいムラ
  "texture-noise", // ラフなノイズ
  "fiber-soft", // ✅ 追加：紙繊維/布目ニュアンス

  // line / hatch
  "hatch-diagonal-soft", // ✅ 追加：薄い斜線ハッチ

  // checker
  "checker-fade", // ✅ 追加：市松フェード（面で出る）

  // rings / topo / scanline
  "rings-sparse", // ✅ 追加：疎な同心円
  "topo-lines", // ✅ 追加：等高線
  "scanlines-soft", // ✅ 追加：ソフト走査線
] as const;

/**
 * 既知パターン union（従来互換）
 */
export type KnownPatternId = (typeof PATTERNS)[number];

/**
 * PatternId は「既知 union」＋「将来拡張可能 string（ブランド型）」。
 * これにより、registryに新IDを追加しても union 更新で詰まらない。
 */
export type PatternId =
  | KnownPatternId
  | (string & { readonly __patternIdBrand: unique symbol });

/** 任意文字列を PatternId として扱う（入力検証はしない） */
export function asPatternId(id: string): PatternId {
  return id as PatternId;
}

/** 既知パターンかどうか（UIやフォールバック用） */
export function isKnownPatternId(id: string): id is KnownPatternId {
  return (PATTERNS as readonly string[]).includes(id);
}

/** 表面の質感 */
export const SURFACES = ["simple", "card", "glass", "paper", "neon", "dark"] as const;
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
    pattern: "none",
    radius: "soft",
    shadow: "none",
    density: "normal",
  },
  {
    id: "businessGalleryCenter",
    label: "Business / Gallery (center)",
    worldview: "business",
    showcase: "gallery",
    surface: "card",
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
    pattern: "grid-thin",
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
    pattern: "stripe-diagonal",
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
    pattern: "texture-noise",
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
    pattern: "texture-paper",
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
    pattern: "texture-paper",
    radius: "soft",
    shadow: "soft",
    density: "dense",
  },
];
