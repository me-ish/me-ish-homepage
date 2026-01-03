// src/lib/aiPortfolio/aiPortfolio.variant.ts

import type { FormInput } from "./aiPortfolio.schema";
import {
  PATTERNS,
  VARIANTS,
  WORLDVIEWS,
  SURFACES,
  SHOWCASES,
  LAYOUTS,
  isKnownPatternId,
  type VariantSpec,
  type Worldview,
  type Showcase,
  type Surface,
  type Layout,
  type PatternId,
  type Radius,
} from "./aiPortfolio.variant.base";

/* ---------------------------------------------------------
 * 小物ユーティリティ
 * --------------------------------------------------------- */
function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function strength01(n: number | undefined) {
  if (typeof n !== "number") return 0;
  return clamp01(n / 100);
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * looseness が 0 に近いほど arr[0] を強く採用する。
 * looseness が 1 に近づくと、後ろの要素も選ばれやすくなる。
 *
 * NOTE:
 * 既存仕様維持のため「重み付き」の実装は変えない。
 * arrの並び順（base→adjacent→wild）が重要。
 */
function pickWeighted<T>(rand: () => number, arr: T[], looseness: number) {
  if (arr.length === 0) throw new Error("empty array");
  if (arr.length === 1 || looseness <= 0.01) return arr[0];
  const r = rand();
  const idx = Math.floor(r * arr.length * clamp01(looseness));
  return arr[Math.min(arr.length - 1, idx)];
}

/* ---------------------------------------------------------
 * 近接 worldviews / wild worldviews（揺らぎ候補）
 * --------------------------------------------------------- */

const ADJACENT_WORLDVIEWS: Record<Worldview, Worldview[]> = {
  minimal: ["modern", "business"],
  modern: ["minimal", "business", "luxury"],
  business: ["modern", "minimal"],
  cute: ["pop", "retro"],
  pop: ["cute", "retro"],
  dark: ["cyber", "luxury"],
  cyber: ["dark", "modern"],
  natural: ["minimal", "retro"],
  luxury: ["modern", "dark"],
  retro: ["cute", "natural"],
};

const WILD_WORLDVIEWS: Record<Worldview, Worldview[]> = {
  minimal: ["retro"],
  modern: ["cyber"],
  business: ["natural"],
  cute: ["retro"],
  pop: ["cyber"],
  natural: ["business"],
  luxury: ["retro"],
  retro: ["modern"],
  cyber: ["luxury"],
  dark: ["retro"],
};

function worldviewLooseness(strength: number) {
  const s = clamp01((strength ?? 0) / 100);

  if (s <= 0.2) {
    return (s / 0.2) * 0.12; // 0.00..0.12
  }
  if (s <= 0.7) {
    const t = (s - 0.2) / 0.5;
    return 0.12 + t * 0.6; // 0.12..0.72
  }
  {
    const t = (s - 0.7) / 0.3;
    return 0.72 + t * 0.28; // 0.72..1.0
  }
}

function buildWorldviewPool(base: Worldview, strength: number): Worldview[] {
  const s = strength ?? 0;
  const pool: Worldview[] = [base];

  if (s >= 20) {
    const adj = ADJACENT_WORLDVIEWS[base] ?? [];
    for (const w of adj) pool.push(w);
  }
  if (s >= 70) {
    const wild = WILD_WORLDVIEWS[base] ?? [];
    for (const w of wild) pool.push(w);
  }

  return Array.from(new Set(pool));
}

/* ---------------------------------------------------------
 * worldviews / surfaces / showcases / patterns の定義
 * --------------------------------------------------------- */

const WORLDVIEW_SURFACES: Record<Worldview, Surface[]> = {
  minimal: ["simple", "card", "paper"],
  modern: ["simple", "glass", "card"],
  business: ["simple", "card", "paper"],
  cute: ["card", "glass", "simple"],
  pop: ["card", "neon", "simple"],
  dark: ["dark", "glass", "card"],
  cyber: ["glass", "neon", "dark"],
  natural: ["paper", "simple", "card"],
  luxury: ["dark", "glass", "card"],
  retro: ["paper", "card", "simple"],
};

const WORLDVIEW_SHOWCASES: Record<Worldview, Showcase[]> = {
  minimal: ["gallery", "card", "textRich"],
  modern: ["gallery", "card", "textRich"],
  business: ["card", "textRich", "gallery"],
  cute: ["gallery", "masonry", "card"],
  pop: ["masonry", "gallery", "card"],
  dark: ["gallery", "card"],
  cyber: ["gallery", "masonry"],
  natural: ["gallery", "card"],
  luxury: ["gallery", "card"],
  retro: ["gallery", "card", "textRich"],
};

/**
 * worldview ごとの「似合うパターン」候補
 * basePattern（フォーム指定）と組み合わせて使う
 */
const WORLDVIEW_PATTERNS: Record<Worldview, PatternId[]> = {
  minimal: [
    "none",
    "stripe-vertical-soft",
    "grid-thin",
    "texture-paper",
    "hatch-diagonal-soft",
  ],
  modern: [
    "grid-thin",
    "texture-noise",
    "texture-paper",
    "tile-iso-cubes-soft",
    "checker-fade",
    "topo-lines",
  ],
  business: [
    "none",
    "stripe-vertical-soft",
    "grid-thin",
    "texture-paper",
    "hatch-diagonal-soft",
    "checker-fade",
  ],
  cute: ["dot-soft", "dot-retro", "dot-dense-noise", "rings-sparse"],
  pop: ["dot-retro", "stripe-diagonal", "stripe-vertical-bold", "rings-sparse"],
  dark: ["texture-noise", "grid-subtle", "checker-fade", "scanlines-soft"],
  cyber: ["grid-cyber", "grid-neon", "texture-noise", "scanlines-soft", "topo-lines"],
  natural: ["fiber-soft", "texture-paper", "texture-noise", "dot-soft", "topo-lines"],
  luxury: [
    "diamond-soft",
    "stripe-vertical-soft",
    "texture-paper",
    "tile-iso-cubes-soft",
    "checker-fade",
  ],
  retro: ["dot-retro", "stripe-diagonal", "texture-paper", "rings-sparse"],
};

/* ---------------------------------------------------------
 * radius / shadow / density 派生
 * --------------------------------------------------------- */

function deriveRadius(surface: Surface, strength: number): Radius {
  const s = strength01(strength);

  let base: Radius;
  switch (surface) {
    case "simple":
    case "paper":
      base = "none";
      break;
    case "card":
    case "glass":
    case "dark":
    case "neon":
    default:
      base = "soft";
      break;
  }

  if (s <= 0.05) return base;
  if (s > 0.8) return "pill";
  if (s > 0.4) {
    if (base === "none") return "soft";
    return base;
  }
  return base;
}

function deriveShadow(surface: Surface, strength: number): "none" | "soft" | "strong" {
  const s = strength01(strength);

  let base: "none" | "soft" | "strong";
  switch (surface) {
    case "simple":
    case "paper":
      base = "none";
      break;
    case "card":
    case "glass":
      base = "soft";
      break;
    case "dark":
    case "neon":
      base = "strong";
      break;
    default:
      base = "soft";
      break;
  }

  if (s <= 0.05) return base;
  if (s > 0.8) return "strong";
  if (s > 0.4) {
    if (base === "none") return "soft";
    return base;
  }
  return base;
}

function deriveDensity(showcase: Showcase, strength: number) {
  const s = strength01(strength);
  if (showcase === "masonry") return s > 0.4 ? "compact" : "normal";
  if (showcase === "textRich") return s > 0.6 ? "dense" : "normal";
  if (s > 0.7) return "compact";
  if (s < 0.3) return "airy";
  return "normal";
}

/* ---------------------------------------------------------
 * 型安全な "asXxx"
 * --------------------------------------------------------- */
function asWorldview(v: string | undefined | null): Worldview {
  if (WORLDVIEWS.includes(v as Worldview)) return v as Worldview;
  return "minimal";
}

function asSurface(v: string | undefined | null): Surface {
  if (SURFACES.includes(v as Surface)) return v as Surface;
  return "simple";
}

function asShowcase(v: string | undefined | null): Showcase {
  if (SHOWCASES.includes(v as Showcase)) return v as Showcase;
  return "gallery";
}

function asLayout(v: string | undefined | null): Layout {
  if (LAYOUTS.includes(v as Layout)) return v as Layout;
  return "center";
}

/**
 * patternBase（フォームのベース指定）を PatternId にマップする
 *
 * ✅ TS2345 対策：
 * - PATTERNS.includes(...) に PatternId（ブランドstring）を渡さない
 * - isKnownPatternId(v) を使う
 */
function asPattern(v: string | undefined | null): PatternId {
  if (!v) return "none";

  // まず “既知ID” をそのまま通す
  if (isKnownPatternId(v)) return v;

  const normalized = v.toLowerCase();

  // 旧入力互換
  if (normalized === "dot" || normalized === "dots") return "dot-soft";
  if (normalized === "stripe") return "stripe-vertical-soft";
  if (normalized === "grid") return "grid-thin";
  if (normalized === "texture" || normalized === "paper") return "texture-paper";
  if (normalized === "noise") return "texture-noise";
  if (normalized === "circuit") return "grid-neon";
  if (normalized === "retro" || normalized === "retrolines") return "stripe-diagonal";

  // 新追加の “ざっくり互換” を少しだけ
  if (normalized === "diamond") return "diamond-soft";
  if (normalized === "subtlegrid") return "grid-subtle";
  if (normalized === "cybergrid") return "grid-cyber";
  if (normalized === "fiber") return "fiber-soft";
  if (normalized === "scanlines") return "scanlines-soft";
  if (normalized === "topo") return "topo-lines";

  // 不正値は安全に none
  return "none";
}

/* ---------------------------------------------------------
 * 1本スライダー（overall）を master として扱う
 * --------------------------------------------------------- */
function getMasterStrength(input: FormInput): number {
  const s = (input as any).aiStrength as
    | { overall?: number; [key: string]: number | undefined }
    | undefined;

  if (!s) return 0;
  if (typeof s.overall === "number") return s.overall;
  return 0;
}

function getStrengthFor(input: FormInput, key: string, master: number): number {
  const s = (input as any).aiStrength as { [k: string]: number | undefined } | undefined;
  if (!s) return master;

  const v = s[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return master;
}

/* ---------------------------------------------------------
 * メイン：designAnswers + aiStrength(実質1本) → VariantSpec
 * --------------------------------------------------------- */
export function deriveVariantFromAnswers(input: FormInput): VariantSpec {
  const d = input.designAnswers;

  const master = getMasterStrength(input);

  const seedBase =
    (input.email ?? "") +
    "|" +
    (input.name ?? "") +
    "|" +
    (input.role ?? "") +
    "|" +
    JSON.stringify(d);

  const seed = hashString(seedBase);
  const rand = mulberry32(seed);

  const worldviewStrength = getStrengthFor(input, "worldview", master);
  const surfaceStrength = getStrengthFor(input, "surface", master);
  const showcaseStrength = getStrengthFor(input, "structure", master);
  const layoutStrength = getStrengthFor(input, "layout", master);
  const patternStrength = getStrengthFor(input, "pattern", master);

  // worldview
  const baseWorldview = asWorldview(d.worldviewBase);
  const worldviewPool = buildWorldviewPool(baseWorldview, worldviewStrength);
  const wLooseness = worldviewLooseness(worldviewStrength);
  const worldview = pickWeighted(rand, worldviewPool, wLooseness);

  // surface
  const baseSurface = asSurface(d.surfaceStyle);
  const surfacePool = WORLDVIEW_SURFACES[worldview] ?? SURFACES;
  const surface =
    strength01(surfaceStrength) < 0.2
      ? baseSurface
      : pickWeighted(rand, [baseSurface, ...surfacePool], strength01(surfaceStrength));

  // showcase
  const baseShowcase = asShowcase(d.showcaseStyle);
  const showcasePool = WORLDVIEW_SHOWCASES[worldview] ?? SHOWCASES;
  const showcase =
    strength01(showcaseStrength) < 0.2
      ? baseShowcase
      : pickWeighted(rand, [baseShowcase, ...showcasePool], strength01(showcaseStrength));

  // layout
  const baseLayout = asLayout(d.layoutPref);
  const layoutPool: Layout[] = ["center", "split"];
  const layout =
    strength01(layoutStrength) < 0.2
      ? baseLayout
      : pickWeighted(rand, [baseLayout, ...layoutPool], strength01(layoutStrength));

  // pattern
  const basePattern = asPattern(d.patternBase);
  const patternPool = WORLDVIEW_PATTERNS[worldview] ?? PATTERNS;
  const pattern =
    strength01(patternStrength) < 0.2
      ? basePattern
      : pickWeighted(rand, [basePattern, ...patternPool], strength01(patternStrength));

  const radius = deriveRadius(surface, surfaceStrength);
  const shadow = deriveShadow(surface, surfaceStrength);
  const density = deriveDensity(showcase, showcaseStrength);

  const candidate =
    VARIANTS.find(
      (v) =>
        v.worldview === worldview &&
        v.surface === surface &&
        v.layout === layout &&
        v.showcase === showcase
    ) ??
    VARIANTS.find((v) => v.worldview === worldview && v.showcase === showcase) ??
    VARIANTS[0];

  return {
    id: candidate.id,
    worldview,
    showcase,
    surface,
    layout,
    pattern,
    radius,
    shadow,
    density,
  };
}
