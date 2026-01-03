// src/components/aiPortfolio/applyVariantStyle.ts
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import type { Design } from "@/lib/aiPortfolio/aiPortfolio.schema";

import type { WorldviewBase } from "@/lib/aiPortfolio/aiPortfolio.worldviewPresets";
import {
  BASELINE_TOKENS,
  WORLDVIEW_NEIGHBORS,
  WORLDVIEW_TOKENS,
  isDarkWorldview,
  type StyleTokens,
} from "@/lib/aiPortfolio/aiPortfolio.styleTokens";

/** ✅ NEW: Surfaceの単一正 */
import { buildSurfaceStyle } from "@/lib/aiPortfolio/aiPortfolio.surfaceRegistry";

export type VariantStyle = {
  // ベースカラー
  borderColor: string;
  textColor: string;
  accentColor: string;

  /** ダークテーマ判定 */
  isDark: boolean;

  // カード系
  radius: string;
  shadow: string;
  surfaceBG: string;

  // 補助
  mutedText: string;
  tagBG: string;

  // デバッグ/追跡（任意）
  _tokenSourceWorldview?: string;
  _tokenBorrow?: string;
};

/** 文字列から最初の hex カラー (#rgb / #rrggbb) を拾う */
function firstHexColor(input: unknown): string | null {
  const s = String(input ?? "");
  const m = s.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/);
  return m ? `#${m[1]}` : null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

/** 相対輝度（ざっくり） */
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function isDarkTheme(variant: VariantSpec, theme: Design["theme"]): boolean {
  // worldview を最優先（プロダクト上の「意図」）
  const w = (variant.worldview ?? "business") as WorldviewBase;
  if (isDarkWorldview(w)) return true;

  // colorBG / bgGradient から推定
  const bgHex =
    firstHexColor((theme as any).colorBG) ?? firstHexColor((theme as any).bgGradient);
  if (!bgHex) return false;

  const rgb = hexToRgb(bgHex);
  if (!rgb) return false;

  return relativeLuminance(rgb) < 0.22;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/** どこかに strength を入れていれば拾う（無ければ0扱い） */
function getOverallStrength(variant: VariantSpec): number {
  const raw =
    (variant as any).overallStrength ??
    (variant as any).aiStrength ??
    (variant as any).aiDegree ??
    (variant as any).strength ??
    0;
  const n = typeof raw === "string" ? Number(raw) : Number(raw);
  return clampInt(n, 0, 100);
}

function hashToInt(s: string): number {
  // 軽い決定論ハッシュ（ビルド/環境でブレない）
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type BorrowCategory = "radius" | "shadow" | "surface";

/**
 * strength に応じて token を決める
 * - 0-20: baseline
 * - 20-60: worldview固定
 * - 60-99: neighbor から 1カテゴリだけ借りる（破綻防止）
 * - 100: 全世界観から参照可（ただし light/dark 整合）
 */
function resolveStyleTokens(
  worldview: WorldviewBase,
  strength: number
): { tokens: StyleTokens; debugSource: string; debugBorrow?: string } {
  if (strength <= 20) {
    return { tokens: BASELINE_TOKENS, debugSource: "baseline" };
  }

  const base = WORLDVIEW_TOKENS[worldview] ?? WORLDVIEW_TOKENS.business;

  if (strength <= 60) {
    return { tokens: base, debugSource: worldview };
  }

  // 60-99: neighbor borrowing（カテゴリ1つ）
  const neighbors = WORLDVIEW_NEIGHBORS[worldview] ?? [];
  const pickNeighbor =
    neighbors.length > 0
      ? neighbors[hashToInt(`${worldview}:${strength}`) % neighbors.length]
      : worldview;

  const neighborTokens = WORLDVIEW_TOKENS[pickNeighbor] ?? base;

  const categories: BorrowCategory[] = ["radius", "shadow", "surface"];
  const cat =
    categories[hashToInt(`${worldview}:cat:${strength}`) % categories.length];

  const merged: StyleTokens = { ...base };
  if (cat === "radius") merged.radiusPx = neighborTokens.radiusPx;
  if (cat === "shadow") merged.shadow = neighborTokens.shadow;
  if (cat === "surface") merged.surface = neighborTokens.surface;

  // 100: global
  if (strength >= 100) {
    const all = Object.keys(WORLDVIEW_TOKENS) as WorldviewBase[];
    const wantDark = isDarkWorldview(worldview);
    const pool = all.filter((w) => isDarkWorldview(w) === wantDark);
    const w2 =
      pool.length > 0
        ? pool[hashToInt(`${worldview}:global:${strength}`) % pool.length]
        : worldview;
    const t2 = WORLDVIEW_TOKENS[w2] ?? base;

    // 100 は 2カテゴリまで許容（still破綻防止）
    const cat2 =
      categories[hashToInt(`${worldview}:cat2:${strength}`) % categories.length];

    const merged2: StyleTokens = { ...base };
    // 1カテゴリ目
    if (cat === "radius") merged2.radiusPx = t2.radiusPx;
    if (cat === "shadow") merged2.shadow = t2.shadow;
    if (cat === "surface") merged2.surface = t2.surface;
    // 2カテゴリ目（被ったらスキップ）
    if (cat2 !== cat) {
      if (cat2 === "radius") merged2.radiusPx = t2.radiusPx;
      if (cat2 === "shadow") merged2.shadow = t2.shadow;
      if (cat2 === "surface") merged2.surface = t2.surface;
    }

    return {
      tokens: merged2,
      debugSource: worldview,
      debugBorrow: `global:${w2}(${cat}${cat2 !== cat ? `+${cat2}` : ""})`,
    };
  }

  return {
    tokens: merged,
    debugSource: worldview,
    debugBorrow: `neighbor:${pickNeighbor}(${cat})`,
  };
}

/** surface を token で強制する（統一のため） */
function resolveSurfaceModeFromTokens(
  tokens: StyleTokens,
  variant: VariantSpec
): VariantSpec["surface"] {
  // 既存variant.surfaceを尊重したいならここで条件分岐できるが、
  // 今回の目的は「世界観ごとの統一」なので tokens を優先
  return tokens.surface as any;
}

export function applyVariantStyle(
  variant: VariantSpec,
  theme: Design["theme"]
): VariantStyle {
  const worldview = (variant.worldview ?? "business") as WorldviewBase;
  const strength = getOverallStrength(variant);
  const isDark = isDarkTheme(variant, theme);

  const { tokens, debugSource, debugBorrow } = resolveStyleTokens(worldview, strength);

  const mode = resolveSurfaceModeFromTokens(tokens, variant) ?? "card";

  // ✅ surface 生成は registry に一本化（ここが統一感の根）
  const s = buildSurfaceStyle({
    mode,
    variant,
    theme,
    tokens,
    isDark,
  });

  return {
    borderColor: s.borderColor,
    textColor: s.textColor,
    accentColor: s.accentColor,
    isDark,
    radius: s.radius,
    shadow: s.shadow,
    surfaceBG: s.surfaceBG,
    mutedText: s.mutedText,
    tagBG: s.tagBG,
    _tokenSourceWorldview: debugSource,
    _tokenBorrow: debugBorrow,
  };
}
