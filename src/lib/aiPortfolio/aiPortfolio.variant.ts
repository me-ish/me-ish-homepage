// ============================================
// aiPortfolio.variant.ts
// - FormInput.designAnswers + aiStrength(実質1本スライダー) → VariantSpec
// - worldview / surface / showcase / layout / pattern を条件付き乱択
// - overall スライダーを master として使い、
//   個別の aiStrength が入っていればそれを優先する構成
// ============================================

import type { FormInput } from "./aiPortfolio.schema";
import {
  PATTERNS,
  VARIANTS,
  WORLDVIEWS,
  SURFACES,
  SHOWCASES,
  LAYOUTS,
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
 */
function pickWeighted<T>(rand: () => number, arr: T[], looseness: number) {
  if (arr.length === 0) throw new Error("empty array");
  if (arr.length === 1 || looseness <= 0.01) return arr[0];
  const r = rand();
  const idx = Math.floor(r * arr.length * clamp01(looseness));
  return arr[Math.min(arr.length - 1, idx)];
}

/* ---------------------------------------------------------
 * 近接 worldviews / surfaces / showcases / patterns の定義
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
  minimal: ["none", "stripe-vertical-soft", "grid-thin", "texture-paper"],
  modern: ["grid-thin", "texture-noise", "texture-paper"],
  business: ["none", "stripe-vertical-soft", "grid-thin", "texture-paper"],
  cute: ["dot-soft", "dot-retro", "dot-dense-noise"],
  pop: ["dot-retro", "stripe-diagonal", "stripe-vertical-bold"],
  dark: ["texture-noise", "grid-neon"],
  cyber: ["grid-neon", "texture-noise", "grid-thin"],
  natural: ["texture-paper", "texture-noise", "dot-soft"],
  luxury: ["stripe-vertical-soft", "texture-paper"],
  retro: ["dot-retro", "stripe-diagonal", "texture-paper"],
};

/* ---------------------------------------------------------
 * radius / shadow / density 派生（カードの“顔”を決める）
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
      base = "soft";
      break;
    case "dark":
    case "neon":
      base = "soft";
      break;
    default:
      base = "soft";
  }

  if (s <= 0.05) return base;
  if (s > 0.8) return "pill";
  if (s > 0.4) {
    if (base === "none") return "soft";
    return base;
  }
  return base;
}

/**
 * surface ごとの「基準の影」を決める。
 */
function deriveShadow(
  surface: Surface,
  strength: number
): "none" | "soft" | "strong" {
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
 * 型安全な "asXxx"（不正値が来たときのフォールバック）
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
 */
function asPattern(v: string | undefined | null): PatternId {
  if (!v) return "none";

  if (PATTERNS.includes(v as PatternId)) return v as PatternId;

  const normalized = v.toLowerCase();

  if (normalized === "dot" || normalized === "dots") return "dot-soft";
  if (normalized === "stripe") return "stripe-vertical-soft";
  if (normalized === "grid") return "grid-thin";
  if (normalized === "texture" || normalized === "paper") return "texture-paper";
  if (normalized === "noise") return "texture-noise";
  if (normalized === "circuit") return "grid-neon";
  if (normalized === "retro" || normalized === "retrolines")
    return "stripe-diagonal";

  return "none";
}

/* ---------------------------------------------------------
 * 1本スライダー（overall）を master として扱うヘルパ
 * --------------------------------------------------------- */

/**
 * aiStrength から master(overall) を取得。
 * 未設定の場合は 0 として扱う。
 */
function getMasterStrength(input: FormInput): number {
  const s = (input as any).aiStrength as
    | {
        overall?: number;
        [key: string]: number | undefined;
      }
    | undefined;

  if (!s) return 0;
  if (typeof s.overall === "number") return s.overall;
  return 0;
}

/**
 * 個別項目に値があればそれを優先し、なければ master を使う。
 * （将来スライダーを増やすときもこのまま使い回せる）
 */
function getStrengthFor(
  input: FormInput,
  key: string,
  master: number
): number {
  const s = (input as any).aiStrength as
    | {
        [k: string]: number | undefined;
      }
    | undefined;

  if (!s) return master;
  const v = s[key];
  if (typeof v === "number" && !Number.isNaN(v)) {
    return v;
  }
  return master;
}

/* ---------------------------------------------------------
 * メイン：designAnswers + aiStrength(実質1本) → VariantSpec
 * --------------------------------------------------------- */
export function deriveVariantFromAnswers(input: FormInput): VariantSpec {
  const d = input.designAnswers;

  // master（1本スライダー）をベースにする
  const master = getMasterStrength(input);

  // seed は name / role / email / designAnswers ベースで決定
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

  // worldview
  const baseWorldview = asWorldview(d.worldviewBase);
  const wLooseness = strength01(master); // 全体AI強度で worldview のゆらぎを制御

  const worldviewPool: Worldview[] = [
    baseWorldview,
    ...(ADJACENT_WORLDVIEWS[baseWorldview] ?? []),
  ];
  const worldview = pickWeighted(rand, worldviewPool, wLooseness);

  // 各強度（個別設定があればそれを優先、無ければ master）
  const surfaceStrength = getStrengthFor(input, "surface", master);
  const showcaseStrength = getStrengthFor(input, "structure", master);
  const layoutStrength = getStrengthFor(input, "layout", master);
  const patternStrength = getStrengthFor(input, "pattern", master);

  // surface
  const baseSurface = asSurface(d.surfaceStyle);
  const surfacePool = WORLDVIEW_SURFACES[worldview] ?? SURFACES;
  const surface =
    strength01(surfaceStrength) < 0.2
      ? baseSurface
      : pickWeighted(
          rand,
          [baseSurface, ...surfacePool],
          strength01(surfaceStrength)
        );

  // showcase（作品の見せ方）
  const baseShowcase = asShowcase(d.showcaseStyle);
  const showcasePool = WORLDVIEW_SHOWCASES[worldview] ?? SHOWCASES;
  const showcase =
    strength01(showcaseStrength) < 0.2
      ? baseShowcase
      : pickWeighted(
          rand,
          [baseShowcase, ...showcasePool],
          strength01(showcaseStrength)
        );

  // layout（center / split）
  const baseLayout = asLayout(d.layoutPref);
  const layoutPool: Layout[] = ["center", "split"];
  const layout =
    strength01(layoutStrength) < 0.2
      ? baseLayout
      : pickWeighted(
          rand,
          [baseLayout, ...layoutPool],
          strength01(layoutStrength)
        );

  // pattern（背景柄）
  const basePattern = asPattern(d.patternBase);
  const patternPool = WORLDVIEW_PATTERNS[worldview] ?? PATTERNS;
  const pattern =
    strength01(patternStrength) < 0.2
      ? basePattern
      : pickWeighted(
          rand,
          [basePattern, ...patternPool],
          strength01(patternStrength)
        );

  // radius / shadow / density（ここがカードの“顔”）
  const radius = deriveRadius(surface, surfaceStrength);
  const shadow = deriveShadow(surface, surfaceStrength);
  const density = deriveDensity(showcase, showcaseStrength);

  // 既存 VARIANTS から最も近いものを拾う（id 用）
  const candidate =
    VARIANTS.find(
      (v) =>
        v.worldview === worldview &&
        v.surface === surface &&
        v.layout === layout &&
        v.showcase === showcase
    ) ??
    VARIANTS.find(
      (v) => v.worldview === worldview && v.showcase === showcase
    ) ??
    VARIANTS[0];

  const spec: VariantSpec = {
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

  return spec;
}
