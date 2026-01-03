// src/lib/aiPortfolio/aiPortfolio.patternRegistry.ts
import type { CSSProperties } from "react";
import {
  PATTERNS,
  type PatternId,
  type KnownPatternId,
  asPatternId,
} from "./aiPortfolio.variant.base";

/**
 * パターン定義
 * - buildStyle: 背景合成用のCSSProperties（inline）
 * - freq: 後で「事故防止抽選」に使える
 * - tags: worldviewとの相性（将来の重み付け用）
 */
export type PatternDef = {
  id: PatternId;
  label?: string;
  freq?: "low" | "mid" | "high";
  tags?: Array<
    | "minimal"
    | "modern"
    | "business"
    | "cute"
    | "pop"
    | "dark"
    | "cyber"
    | "natural"
    | "luxury"
    | "retro"
  >;
  buildStyle: (color: string) => CSSProperties;
};

export const PATTERN_REGISTRY: Record<string, PatternDef> = {};

/* =========================================================
 * utils
 * ========================================================= */

function hexToRgba(hex: string, alpha: number): string {
  const h = (hex ?? "").trim().replace("#", "");
  const isShort = h.length === 3;

  const r = parseInt(isShort ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(isShort ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(isShort ? h[2] + h[2] : h.slice(4, 6), 16);

  const a = Math.max(0, Math.min(1, alpha));
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(0,0,0,${a})`;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** register helper */
export function registerPattern(def: PatternDef) {
  PATTERN_REGISTRY[String(def.id)] = def;
}

/** get definition */
export function getPatternDef(id: PatternId): PatternDef | null {
  return PATTERN_REGISTRY[String(id)] ?? null;
}

/** all ids (for random pick pool) */
export function getAllPatternIds(): PatternId[] {
  return Object.keys(PATTERN_REGISTRY).map((k) => asPatternId(k));
}

/* =========================================================
 * 初期登録（既存PATTERNSをすべて辞書化）
 * ========================================================= */

const KNOWN = PATTERNS as readonly KnownPatternId[];

/* none */
registerPattern({
  id: "none",
  label: "None",
  freq: "low",
  tags: [],
  buildStyle: () => ({}),
});

/* =========================================================
 * dot family
 * ========================================================= */

registerPattern({
  id: "dot-cute",
  label: "Dot Cute",
  freq: "high",
  tags: ["cute", "pop"],
  buildStyle: (color) => ({
    backgroundImage: `radial-gradient(${hexToRgba(color, 0.22)} 2.6px, transparent 2.6px)`,
    backgroundSize: "20px 20px",
  }),
});

registerPattern({
  id: "dot-soft",
  label: "Dot Soft",
  freq: "high",
  tags: ["minimal", "modern", "business", "natural"],
  buildStyle: (color) => ({
    backgroundImage: `radial-gradient(${hexToRgba(color, 0.09)} 2px, transparent 2px)`,
    backgroundSize: "18px 18px",
  }),
});

registerPattern({
  id: "dot-retro",
  label: "Dot Retro",
  freq: "high",
  tags: ["retro", "pop", "cute"],
  buildStyle: (color) => ({
    backgroundImage: `radial-gradient(${color}33 6px, transparent 6px)`,
    backgroundSize: "40px 40px",
  }),
});

registerPattern({
  id: "dot-dense-noise",
  label: "Dot Dense Noise",
  freq: "high",
  tags: ["cyber", "dark", "modern"],
  buildStyle: (color) => ({
    backgroundImage: `radial-gradient(${color}1a 1.5px, transparent 1.5px)`,
    backgroundSize: "10px 10px",
  }),
});

/* =========================================================
 * stripe family
 * ========================================================= */

registerPattern({
  id: "stripe-vertical-soft",
  label: "Stripe Vertical Soft",
  freq: "mid",
  tags: ["business", "minimal", "modern", "luxury"],
  buildStyle: (color) => ({
    backgroundImage: `repeating-linear-gradient(
      90deg,
      ${color}12,
      ${color}12 2px,
      transparent 2px,
      transparent 16px
    )`,
  }),
});

registerPattern({
  id: "stripe-vertical-bold",
  label: "Stripe Vertical Bold",
  freq: "mid",
  tags: ["business", "luxury", "modern"],
  buildStyle: (color) => ({
    backgroundImage: `repeating-linear-gradient(
      90deg,
      ${color}26,
      ${color}26 6px,
      transparent 6px,
      transparent 22px
    )`,
  }),
});

registerPattern({
  id: "stripe-diagonal",
  label: "Stripe Diagonal",
  freq: "mid",
  tags: ["pop", "retro", "cute", "cyber"],
  buildStyle: (color) => ({
    backgroundImage: `repeating-linear-gradient(
      135deg,
      ${color}18,
      ${color}18 3px,
      transparent 3px,
      transparent 15px
    )`,
  }),
});

/* =========================================================
 * grid family
 * ========================================================= */

registerPattern({
  id: "grid-thin",
  label: "Grid Thin",
  freq: "low",
  tags: ["minimal", "business", "modern"],
  buildStyle: (color) => ({
    backgroundImage: `
      linear-gradient(${color}12 1px, transparent 1px),
      linear-gradient(90deg, ${color}12 1px, transparent 1px)
    `,
    backgroundSize: "32px 32px",
  }),
});

registerPattern({
  id: "grid-neon",
  label: "Grid Neon",
  freq: "low",
  tags: ["cyber", "dark"],
  buildStyle: (color) => ({
    backgroundImage: `
      linear-gradient(${color}40 1px, transparent 1px),
      linear-gradient(90deg, ${color}40 1px, transparent 1px)
    `,
    backgroundSize: "32px 32px",
  }),
});

registerPattern({
  id: "grid-subtle",
  label: "Grid Subtle",
  freq: "mid",
  tags: ["dark", "luxury", "modern"],
  buildStyle: (color) => ({
    backgroundImage: `
      linear-gradient(${hexToRgba(color, 0.06)} 1px, transparent 1px),
      linear-gradient(90deg, ${hexToRgba(color, 0.06)} 1px, transparent 1px)
    `,
    backgroundSize: "48px 48px",
  }),
});

registerPattern({
  id: "grid-cyber",
  label: "Grid Cyber",
  freq: "mid",
  tags: ["cyber", "dark"],
  buildStyle: (color) => ({
    backgroundImage: `
      linear-gradient(${hexToRgba(color, 0.14)} 1px, transparent 1px),
      linear-gradient(90deg, ${hexToRgba(color, 0.14)} 1px, transparent 1px),
      linear-gradient(${hexToRgba(color, 0.08)} 2px, transparent 2px),
      linear-gradient(90deg, ${hexToRgba(color, 0.08)} 2px, transparent 2px)
    `,
    backgroundSize: "24px 24px, 24px 24px, 96px 96px, 96px 96px",
  }),
});

/* =========================================================
 * geo / tile family
 * ========================================================= */

registerPattern({
  id: "tile-iso-cubes",
  label: "Tile Iso Cubes",
  freq: "low",
  tags: ["luxury", "modern", "dark", "cyber"],
  buildStyle: (color) => {
    const c2 = hexToRgba(color, 0.18);
    const k1 = "rgba(0,0,0,0.10)";
    const k2 = "rgba(0,0,0,0.18)";
    return {
      backgroundImage: `
        linear-gradient(30deg, ${k2} 12%, transparent 12.5%, transparent 87%, ${k2} 87.5%, ${k2}),
        linear-gradient(150deg, ${k2} 12%, transparent 12.5%, transparent 87%, ${k2} 87.5%, ${k2}),
        linear-gradient(90deg, ${k1} 12%, transparent 12.5%, transparent 87%, ${k1} 87.5%, ${k1}),
        linear-gradient(30deg, ${c2} 12%, transparent 12.5%, transparent 87%, ${c2} 87.5%, ${c2}),
        linear-gradient(150deg, ${c2} 12%, transparent 12.5%, transparent 87%, ${c2} 87.5%, ${c2})
      `,
      backgroundSize: "48px 84px",
      backgroundPosition: "0 0, 0 0, 24px 42px, 0 0, 0 0",
      backgroundRepeat: "repeat",
    };
  },
});

registerPattern({
  id: "tile-iso-cubes-soft",
  label: "Tile Iso Cubes Soft",
  freq: "mid",
  tags: ["modern", "luxury", "business"],
  buildStyle: (color) => {
    const c2 = hexToRgba(color, 0.10);
    const k1 = "rgba(0,0,0,0.06)";
    const k2 = "rgba(0,0,0,0.10)";
    return {
      backgroundImage: `
        linear-gradient(30deg, ${k2} 12%, transparent 12.5%, transparent 87%, ${k2} 87.5%, ${k2}),
        linear-gradient(150deg, ${k2} 12%, transparent 12.5%, transparent 87%, ${k2} 87.5%, ${k2}),
        linear-gradient(90deg, ${k1} 12%, transparent 12.5%, transparent 87%, ${k1} 87.5%, ${k1}),
        linear-gradient(30deg, ${c2} 12%, transparent 12.5%, transparent 87%, ${c2} 87.5%, ${c2}),
        linear-gradient(150deg, ${c2} 12%, transparent 12.5%, transparent 87%, ${c2} 87.5%, ${c2})
      `,
      backgroundSize: "56px 98px",
      backgroundPosition: "0 0, 0 0, 28px 49px, 0 0, 0 0",
      backgroundRepeat: "repeat",
    };
  },
});

/* =========================================================
 * luxury / natural
 * ========================================================= */

registerPattern({
  id: "diamond-soft",
  label: "Diamond Soft",
  freq: "mid",
  tags: ["luxury", "modern", "dark"],
  buildStyle: (color) => ({
    backgroundImage: `
      linear-gradient(45deg, ${hexToRgba(color, 0.10)} 25%, transparent 25%),
      linear-gradient(-45deg, ${hexToRgba(color, 0.10)} 25%, transparent 25%),
      linear-gradient(135deg, ${hexToRgba(color, 0.10)} 25%, transparent 25%),
      linear-gradient(-135deg, ${hexToRgba(color, 0.10)} 25%, transparent 25%)
    `,
    backgroundSize: "40px 40px",
    backgroundPosition: "0 0, 0 20px, 20px -20px, -20px 0",
  }),
});

registerPattern({
  id: "fiber-soft",
  label: "Fiber Soft",
  freq: "mid",
  tags: ["natural", "minimal", "business"],
  buildStyle: (color) => ({
    backgroundImage: `
      repeating-linear-gradient(0deg, ${hexToRgba(color, 0.06)} 0, ${hexToRgba(color, 0.06)} 1px, transparent 1px, transparent 18px),
      repeating-linear-gradient(90deg, ${hexToRgba(color, 0.05)} 0, ${hexToRgba(color, 0.05)} 1px, transparent 1px, transparent 22px),
      radial-gradient(${hexToRgba(color, 0.05)} 1px, transparent 1px)
    `,
    backgroundSize: "auto, auto, 24px 24px",
  }),
});

/* =========================================================
 * additional
 * ========================================================= */

registerPattern({
  id: "hatch-diagonal-soft",
  label: "Hatch Diagonal Soft",
  freq: "mid",
  tags: ["modern", "business", "luxury"],
  buildStyle: (color) => ({
    backgroundImage: `repeating-linear-gradient(
      135deg,
      ${hexToRgba(color, 0.07)} 0,
      ${hexToRgba(color, 0.07)} 1px,
      transparent 1px,
      transparent 14px
    )`,
  }),
});

registerPattern({
  id: "checker-fade",
  label: "Checker Fade",
  freq: "mid",
  tags: ["dark", "luxury", "modern"],
  buildStyle: (color) => ({
    backgroundImage: `
      linear-gradient(45deg, ${hexToRgba(color, 0.07)} 25%, transparent 25%),
      linear-gradient(-45deg, ${hexToRgba(color, 0.07)} 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, ${hexToRgba(color, 0.07)} 75%),
      linear-gradient(-45deg, transparent 75%, ${hexToRgba(color, 0.07)} 75%)
    `,
    backgroundSize: "64px 64px",
    backgroundPosition: "0 0, 0 32px, 32px -32px, -32px 0",
  }),
});

registerPattern({
  id: "rings-sparse",
  label: "Rings Sparse",
  freq: "low",
  tags: ["cute", "pop", "retro"],
  buildStyle: (color) => ({
    backgroundImage: `repeating-radial-gradient(
      circle at 50% 40%,
      ${hexToRgba(color, 0.08)} 0,
      ${hexToRgba(color, 0.08)} 2px,
      transparent 2px,
      transparent 28px
    )`,
  }),
});

registerPattern({
  id: "topo-lines",
  label: "Topo Lines",
  freq: "low",
  tags: ["natural", "modern", "cyber"],
  buildStyle: (color) => ({
    backgroundImage: `
      repeating-radial-gradient(circle at 20% 30%, ${hexToRgba(color, 0.06)} 0, ${hexToRgba(color, 0.06)} 1px, transparent 1px, transparent 18px),
      repeating-radial-gradient(circle at 80% 70%, ${hexToRgba(color, 0.05)} 0, ${hexToRgba(color, 0.05)} 1px, transparent 1px, transparent 22px)
    `,
  }),
});

registerPattern({
  id: "scanlines-soft",
  label: "Scanlines Soft",
  freq: "mid",
  tags: ["cyber", "dark"],
  buildStyle: (color) => ({
    backgroundImage: `repeating-linear-gradient(
      0deg,
      ${hexToRgba(color, 0.06)} 0,
      ${hexToRgba(color, 0.06)} 1px,
      transparent 1px,
      transparent 6px
    )`,
  }),
});

/* =========================================================
 * texture family（Premium Grain）
 * ========================================================= */

function grainSvgDataUrl(): string {
  const svg = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="matrix"
      values="
        0.35 0    0    0 0
        0    0.35 0    0 0
        0    0    0.35 0 0
        0    0    0    0.10 0
      "/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)"/>
</svg>`.trim();

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

registerPattern({
  id: "texture-paper",
  label: "Texture Paper",
  freq: "low",
  tags: ["natural", "minimal", "luxury", "business"],
  buildStyle: (color) => ({
    backgroundImage: `
      radial-gradient(circle at 0 0, ${color}08 0, transparent 60%),
      radial-gradient(circle at 100% 100%, ${color}08 0, transparent 60%)
    `,
    backgroundSize: "80px 80px",
  }),
});

registerPattern({
  id: "texture-noise",
  label: "Premium Grain",
  freq: "high",
  tags: ["dark", "cyber", "retro", "modern", "minimal", "luxury", "business", "natural"],
  buildStyle: () => ({
    backgroundImage: grainSvgDataUrl(),
    backgroundSize: "200px 200px",
    backgroundRepeat: "repeat",
    backgroundPosition: "0 0",
  }),
});

/* =========================================================
 * safety: PATTERNS未登録分をno-opで補完
 * ========================================================= */

for (const id of KNOWN) {
  if (!PATTERN_REGISTRY[id]) {
    registerPattern({
      id,
      label: id,
      freq: "mid",
      tags: [],
      buildStyle: () => ({}),
    });
  }
}
