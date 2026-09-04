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
    shadow: "0 14px 30px rgba(15,23,42,0.10)",
    surface: "paper",
    borderAlpha: 0.18,
    surfaceAlpha: 0.96,
  },
  modern: {
    radiusPx: 18,
    // cyan tint でモダン感を演出
    shadow: "0 18px 44px rgba(56,189,248,0.12), 0 6px 16px rgba(0,0,0,0.40)",
    surface: "glass",
    borderAlpha: 0.28,
    surfaceAlpha: 0.68,
  },
  business: {
    radiusPx: 18,
    // blue tint で信頼感
    shadow: "0 16px 36px rgba(37,99,235,0.10), 0 4px 12px rgba(15,23,42,0.08)",
    surface: "card",
    borderAlpha: 0.32,
    surfaceAlpha: 0.96,
  },
  cute: {
    radiusPx: 24, // より丸く
    // pink tint でキュート感を倍増
    shadow: "0 18px 44px rgba(251,113,133,0.30), 0 4px 12px rgba(251,113,133,0.12)",
    surface: "paper",
    borderAlpha: 0.28,
    surfaceAlpha: 0.96,
  },
  pop: {
    radiusPx: 20,
    // orange tint でポップ感
    shadow: "0 20px 46px rgba(249,115,22,0.18), 0 4px 12px rgba(15,23,42,0.10)",
    surface: "card",
    borderAlpha: 0.30,
    surfaceAlpha: 0.94,
  },
  dark: {
    radiusPx: 18,
    // orange accent glow でダークに温かみ
    shadow: "0 8px 20px rgba(0,0,0,0.70), 0 24px 60px rgba(249,115,22,0.10)",
    surface: "dark",
    borderAlpha: 0.50,
    surfaceAlpha: 0.88,
  },
  cyber: {
    radiusPx: 14, // 鋭角でサイバー感
    // cyan glow でネオン感
    shadow: "0 8px 20px rgba(0,0,0,0.76), 0 24px 64px rgba(34,211,238,0.18)",
    surface: "neon",
    borderAlpha: 0.90,
    surfaceAlpha: 1.0,
  },
  natural: {
    radiusPx: 20,
    // green tint でナチュラル感
    shadow: "0 16px 36px rgba(34,197,94,0.12), 0 4px 10px rgba(15,23,42,0.08)",
    surface: "paper",
    borderAlpha: 0.24,
    surfaceAlpha: 0.95,
  },
  luxury: {
    radiusPx: 20,
    // gold glow でラグジュアリー感
    shadow: "0 8px 20px rgba(2,6,23,0.60), 0 24px 56px rgba(234,179,8,0.14)",
    surface: "glass",
    borderAlpha: 0.50,
    surfaceAlpha: 0.65,
  },
  retro: {
    radiusPx: 14, // 角張ったレトロ感
    // amber tint でノスタルジー
    shadow: "0 18px 40px rgba(180,83,9,0.18), 0 4px 10px rgba(15,23,42,0.10)",
    surface: "paper",
    borderAlpha: 0.32,
    surfaceAlpha: 0.96,
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
