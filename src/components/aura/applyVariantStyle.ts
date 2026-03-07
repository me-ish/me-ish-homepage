// src/components/aura/applyVariantStyle.ts
import type { VariantSpec } from "@/lib/aura/aura.variant.base";
import type { Design } from "@/lib/aura/aura.schema";

import type { WorldviewBase } from "@/lib/aura/aura.worldviewPresets";
import {
  BASELINE_TOKENS,
  WORLDVIEW_NEIGHBORS,
  WORLDVIEW_TOKENS,
  isDarkWorldview,
  type StyleTokens,
} from "@/lib/aura/aura.styleTokens";

/** ✅ Surfaceの単一正（surfaceの見た目はここに集約） */
import { buildSurfaceStyle } from "@/lib/aura/aura.surfaceRegistry";

export type VariantStyle = {
  // ベースカラー
  borderColor: string;
  textColor: string;
  accentColor: string;

  /** ダークテーマ判定 */
  isDark: boolean;

  // カード系（統一値）
  radius: string;
  shadow: string;
  surfaceBG: string;

  // 補助
  mutedText: string;
  tagBG: string;

  // ✅ SectionCard（セクション囲みカード）用の統一値
  sectionCardBG: string;
  sectionCardBorderColor: string;
  sectionCardShadow: string;

  // デバッグ/追跡（任意）
  _tokenSourceWorldview?: string;
  _tokenBorrow?: string;
};

/* ---------------- helpers ---------------- */

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

function rgbaFromHex(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  const alpha = Math.max(0, Math.min(1, a));
  if (!rgb) return `rgba(15,23,42,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
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
  const cat = categories[hashToInt(`${worldview}:cat:${strength}`) % categories.length];

  const merged: StyleTokens = { ...base };
  if (cat === "radius") merged.radiusPx = neighborTokens.radiusPx;
  if (cat === "shadow") merged.shadow = neighborTokens.shadow;
  if (cat === "surface") merged.surface = neighborTokens.surface;

  // 100: global（同一light/dark内で2カテゴリまで借りる）
  if (strength >= 100) {
    const all = Object.keys(WORLDVIEW_TOKENS) as WorldviewBase[];
    const wantDark = isDarkWorldview(worldview);
    const pool = all.filter((w) => isDarkWorldview(w) === wantDark);
    const w2 =
      pool.length > 0
        ? pool[hashToInt(`${worldview}:global:${strength}`) % pool.length]
        : worldview;
    const t2 = WORLDVIEW_TOKENS[w2] ?? base;

    const cat2 = categories[hashToInt(`${worldview}:cat2:${strength}`) % categories.length];

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

function resolveSurfaceModeFromTokens(tokens: StyleTokens): VariantSpec["surface"] {
  return tokens.surface as any;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * ✅ SectionCard用トークン生成（重要）
 * - v（surfaceRegistry結果）と tokens を元に「セクション枠」だけを作る
 * - “白い箱が浮く問題” を止めつつ、世界観トーンは崩さない
 *
 * 方針：
 * - BG：lightは白に寄せるが tokens.surfaceAlpha で透明度を制御
 *       darkは theme.colorBG（or fallback）を薄く重ね、沈みすぎを回避
 * - Border：tokens.borderAlpha を基準に、dark時は少しだけ上げて視認性確保
 * - Shadow：tokens.shadow を採用（統一感の核）。ただし dark/neon は影が強いので軽く薄める
 */
function buildSectionCardTokens(args: {
  theme: Design["theme"];
  isDark: boolean;
  tokens: StyleTokens;
  surface: {
    accentColor: string;
  };
}) {
  const { theme, isDark, tokens, surface } = args;

  const bgHex =
    firstHexColor((theme as any).colorBG) ??
    firstHexColor((theme as any).bgGradient) ??
    (isDark ? "#0b1220" : "#ffffff");

  const primaryHex =
    firstHexColor((theme as any).colorPrimary) ??
    firstHexColor((theme as any).colorAccent) ??
    "#111827";

  // BG alpha：surfaceAlpha を基準に “SectionCardは少し薄め” にする
  // light: 0.90〜0.98付近 / dark: 0.45〜0.70付近
  const baseA = clamp01(tokens.surfaceAlpha);
  const bgA = isDark ? clamp01(0.35 + baseA * 0.35) : clamp01(0.75 + baseA * 0.25);

  const bg = isDark
    ? rgbaFromHex(bgHex, bgA) // 背景色を薄く重ねる（白箱化を防ぐ）
    : `rgba(255,255,255,${bgA})`;

  // Border alpha：tokens.borderAlpha を基準。darkは視認性のため少しだけ底上げ
  const ba = clamp01(isDark ? Math.max(tokens.borderAlpha, 0.35) : tokens.borderAlpha);
  const border = rgbaFromHex(primaryHex, ba);

  // Shadow：tokens.shadow を基本にするが、modeによって “少しだけ軽く”
  // （shadow文字列の解析はやりすぎなので、ここは safe に固定シャドウへ寄せる）
  // - neon/dark は tokens.shadow が激しいので、SectionCardは一段弱い影に
  const wantsSofter =
    (tokens.surface as string) === "neon" || (tokens.surface as string) === "dark";

  const shadow = wantsSofter
    ? (isDark ? "0 18px 45px rgba(0,0,0,0.45)" : "0 18px 45px rgba(15,23,42,0.10)")
    : tokens.shadow;

  // cyber(neon) など border を強く見せたい場合でも、SectionCardは “主張しすぎない” を優先
  // ただし borderAlpha が極端に小さいケースの救済として accent を僅かに混ぜる余地を残す
  // （現状は未使用だが、将来ここで border を accent に寄せられる）
  void surface.accentColor;

  return { bg, border, shadow };
}

/* ---------------- main ---------------- */

export function applyVariantStyle(variant: VariantSpec, theme: Design["theme"]): VariantStyle {
  const worldview = (variant.worldview ?? "business") as WorldviewBase;
  const strength = getOverallStrength(variant);
  const isDark = isDarkTheme(variant, theme);

  const { tokens, debugSource, debugBorrow } = resolveStyleTokens(worldview, strength);

  const mode = (variant.surface as VariantSpec["surface"]) ?? resolveSurfaceModeFromTokens(tokens) ?? "card";

  // ✅ surface の生成は registry に一本化（tokensを尊重）
  const s = buildSurfaceStyle({
    mode,
    variant,
    theme,
    tokens,
    isDark,
  });

  // ✅ SectionCard（Renderer側の囲み）用
  const sectionCard = buildSectionCardTokens({
    theme,
    isDark,
    tokens,
    surface: { accentColor: s.accentColor },
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

    sectionCardBG: sectionCard.bg,
    sectionCardBorderColor: sectionCard.border,
    sectionCardShadow: sectionCard.shadow,

    _tokenSourceWorldview: debugSource,
    _tokenBorrow: debugBorrow,
  };
}
