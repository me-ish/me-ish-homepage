// src/lib/aura/aura.surfaceRegistry.ts
import type { VariantSpec } from "@/lib/aura/aura.variant.base";
import type { Design } from "@/lib/aura/aura.schema";
import type { StyleTokens } from "@/lib/aura/aura.styleTokens";

/**
 * SurfaceRegistry の責務：
 * - 「surface（card / paper / glass / neon / dark / simple）」ごとの
 *   背景・枠・文字トーンを一元生成する（セクション側に散らさない）
 * - tokens（radiusPx / shadow / surfaceAlpha / borderAlpha / surface）を尊重する
 */

export type SurfaceBuildInput = {
  mode: VariantSpec["surface"];
  variant: VariantSpec;
  theme: Design["theme"];
  tokens: StyleTokens;
  isDark: boolean;
};

export type SurfaceBuildResult = {
  // cards
  radius: string;
  shadow: string;
  surfaceBG: string;

  // colors
  borderColor: string;
  textColor: string;
  mutedText: string;
  tagBG: string;

  // convenience
  accentColor: string;
};

function firstHexColor(input: unknown): string | null {
  const s = String(input ?? "");
  const m = s.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/);
  return m ? `#${m[1]}` : null;
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(15,23,42,${alpha})`;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function pickAccent(theme: Design["theme"]): string {
  const accent = (theme as any).colorAccent ?? (theme as any).colorPrimary;
  return typeof accent === "string" && accent.trim() ? accent : "#2563EB";
}

/**
 * borderColor は「primary基準」をデフォルトにする。
 * dark/neon のみ例外的に accent を強める。
 */
function baseBorderColor(
  theme: Design["theme"],
  tokens: StyleTokens,
  isDark: boolean
): string {
  const primary = (theme as any).colorPrimary ?? "#111827";
  const alpha = isDark ? Math.max(tokens.borderAlpha, 0.45) : tokens.borderAlpha;
  return hexToRgba(primary, alpha);
}

function baseTextColor(theme: Design["theme"], isDark: boolean): string {
  const t = (theme as any).colorText;
  if (typeof t === "string" && t.trim()) return t;
  return isDark ? "rgba(249,250,251,0.96)" : "rgba(15,23,42,0.92)";
}

function baseMutedText(isDark: boolean): string {
  return isDark ? "rgba(226,232,240,0.80)" : "rgba(55,65,81,0.78)";
}

function baseTagBG(isDark: boolean): string {
  return isDark ? "rgba(2,6,23,0.75)" : "rgba(255,255,255,0.98)";
}

function baseSurfaceBG(tokens: StyleTokens, isDark: boolean): string {
  if (isDark) return "rgba(15,23,42,0.78)";
  return `rgba(255,255,255,${clamp01(tokens.surfaceAlpha)})`;
}

/**
 * Surfaceごとの最終値を組み立てる
 * - radius / shadow は tokens を絶対値として採用（統一感の根）
 * - surfaceBG / border / text / muted / tag は surface mode により変える
 */
export function buildSurfaceStyle(input: SurfaceBuildInput): SurfaceBuildResult {
  const { mode, theme, tokens, isDark } = input;

  const accentColor = pickAccent(theme);
  const radius = `${tokens.radiusPx}px`;
  const shadow = tokens.shadow;

  // defaults
  let textColor = baseTextColor(theme, isDark);
  let mutedText = baseMutedText(isDark);
  let borderColor = baseBorderColor(theme, tokens, isDark);
  let surfaceBG = baseSurfaceBG(tokens, isDark);
  let tagBG = baseTagBG(isDark);

  // NOTE:
  // ここで「統一感」を担保するため、radius/shadow は tokens 以外から触らない。
  // つまり、Worksだけ別影…などはセクション側が勝手に影を持つのが原因になりやすい。
  // “影・角丸は v.radius/v.shadow を必ず使う” を徹底する設計。

  if (mode === "paper") {
    surfaceBG = isDark
      ? "rgba(15,23,42,0.82)"
      : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";
    // border は primary基準のまま
    borderColor = baseBorderColor(theme, tokens, isDark);
  } else if (mode === "glass") {
    surfaceBG = isDark
      ? "rgba(2,6,23,0.55)"
      : `rgba(255,255,255,${clamp01(tokens.surfaceAlpha)})`;
    borderColor = baseBorderColor(theme, tokens, isDark);
  } else if (mode === "simple") {
    surfaceBG = isDark
      ? "rgba(15,23,42,0.70)"
      : `rgba(255,255,255,${clamp01(tokens.surfaceAlpha)})`;
    borderColor = baseBorderColor(theme, tokens, isDark);
  } else if (mode === "dark") {
    surfaceBG = "rgba(2,6,23,0.90)";
    borderColor = hexToRgba(accentColor, 0.55);
    textColor = hexToRgba("#f9fafb", 0.97);
    mutedText = hexToRgba("#e5e7eb", 0.75);
    tagBG = hexToRgba("#020617", 0.80);
  } else if (mode === "neon") {
    // neon は “見た目の派手さ” を出すが、radius/shadow は tokens を守る（統一のため）
    const primary = (theme as any).colorPrimary ?? accentColor;
    surfaceBG = `radial-gradient(circle at 0% 0%, ${hexToRgba(
      accentColor,
      0.30
    )} 0, ${hexToRgba("#020617", 0.98)} 55%),
radial-gradient(circle at 100% 100%, ${hexToRgba(
      primary,
      0.22
    )} 0, ${hexToRgba("#020617", 1)} 45%)`;

    borderColor = hexToRgba(accentColor, 0.95);
    textColor = hexToRgba("#f9fafb", 0.98);
    mutedText = hexToRgba("#e5e7eb", 0.75);
    tagBG = hexToRgba("#020617", 0.95);
  } else {
    // card (default)
    surfaceBG = baseSurfaceBG(tokens, isDark);
    borderColor = baseBorderColor(theme, tokens, isDark);
  }

  return {
    radius,
    shadow,
    surfaceBG,
    borderColor,
    textColor,
    mutedText,
    tagBG,
    accentColor,
  };
}

/**
 * （任意）デバッグ用：themeのBGのhexが取りたい時に使う
 * 使わなければ削除してOK
 */
export function extractThemeBgHex(theme: Design["theme"]): string | null {
  return (
    firstHexColor((theme as any).colorBG) ?? firstHexColor((theme as any).bgGradient)
  );
}
