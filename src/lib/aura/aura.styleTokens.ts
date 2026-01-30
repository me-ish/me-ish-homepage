// src/lib/aura/aura.styleTokens.ts
import type { WorldviewBase, SurfaceStyle } from "@/lib/aura/aura.worldviewPresets";

export type StyleTokens = {
  radiusPx: number; // カード角丸
  shadow: string; // box-shadow
  surface: SurfaceStyle; // "card" | "glass" | "paper" | "neon" | "dark" | "simple"
  borderAlpha: number; // borderColor の alpha
  surfaceAlpha: number; // surface の alpha（glass/card等の透過）
};

export const BASELINE_TOKENS: StyleTokens = {
  radiusPx: 18,
  shadow: "0 16px 34px rgba(15,23,42,0.14)",
  surface: "paper",
  borderAlpha: 0.28,
  surfaceAlpha: 0.92,
};

export const WORLDVIEW_TOKENS: Record<WorldviewBase, StyleTokens> = {
  minimal: {
    radiusPx: 16,
    shadow: "0 14px 30px rgba(15,23,42,0.12)",
    surface: "paper",
    borderAlpha: 0.22,
    surfaceAlpha: 0.94,
  },
  modern: {
    radiusPx: 18,
    shadow: "0 18px 40px rgba(15,23,42,0.18)",
    surface: "glass",
    borderAlpha: 0.22,
    surfaceAlpha: 0.70,
  },
  business: {
    radiusPx: 18,
    shadow: "0 16px 36px rgba(15,23,42,0.16)",
    surface: "card",
    borderAlpha: 0.30,
    surfaceAlpha: 0.92,
  },
  cute: {
    radiusPx: 22,
    shadow: "0 18px 40px rgba(251,113,133,0.24)",
    surface: "simple",
    borderAlpha: 0.26,
    surfaceAlpha: 0.95,
  },
  pop: {
    radiusPx: 20,
    shadow: "0 20px 46px rgba(15,23,42,0.22)",
    surface: "card",
    borderAlpha: 0.28,
    surfaceAlpha: 0.92,
  },
  dark: {
    radiusPx: 18,
    shadow: "0 22px 56px rgba(0,0,0,0.72)",
    surface: "dark",
    borderAlpha: 0.55,
    surfaceAlpha: 0.90,
  },
  cyber: {
    radiusPx: 18,
    shadow: "0 24px 60px rgba(0,0,0,0.78)",
    surface: "neon",
    borderAlpha: 0.95,
    surfaceAlpha: 1.0,
  },
  natural: {
    radiusPx: 20,
    shadow: "0 16px 36px rgba(15,23,42,0.16)",
    surface: "paper",
    borderAlpha: 0.24,
    surfaceAlpha: 0.94,
  },
  luxury: {
    radiusPx: 20,
    shadow: "0 22px 52px rgba(2,6,23,0.55)",
    surface: "glass",
    borderAlpha: 0.55,
    surfaceAlpha: 0.62,
  },
  retro: {
    radiusPx: 18,
    shadow: "0 18px 40px rgba(15,23,42,0.18)",
    surface: "paper",
    borderAlpha: 0.26,
    surfaceAlpha: 0.94,
  },
};

/**
 * 近接世界観（破綻しにくい並び）
 * ※ここは後であなたの “worldview graph” があれば置き換え前提
 */
export const WORLDVIEW_NEIGHBORS: Record<WorldviewBase, WorldviewBase[]> = {
  minimal: ["business", "natural", "modern", "retro"],
  modern: ["business", "cyber", "minimal", "luxury"],
  business: ["minimal", "modern", "natural", "retro"],
  cute: ["pop", "natural", "retro", "business"],
  pop: ["cute", "retro", "business", "modern"],
  dark: ["luxury", "cyber", "modern", "business"],
  cyber: ["modern", "dark", "luxury", "pop"],
  natural: ["minimal", "business", "cute", "retro"],
  luxury: ["dark", "modern", "cyber", "business"],
  retro: ["natural", "business", "pop", "cute"],
};

export function isDarkWorldview(w: WorldviewBase): boolean {
  return w === "dark" || w === "cyber" || w === "luxury";
}
