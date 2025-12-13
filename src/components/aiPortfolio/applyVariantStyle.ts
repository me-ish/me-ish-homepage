// src/components/aiPortfolio/applyVariantStyle.ts
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import type { Design } from "@/lib/aiPortfolio/aiPortfolio.schema";

export type VariantStyle = {
  // ベースカラー
  borderColor: string;
  textColor: string;
  accentColor: string;

  // カード系
  radius: string;
  shadow: string;
  surfaceBG: string; // カード背景

  // 補助
  mutedText: string;
  tagBG: string;
};

/** hexカラー → rgb 文字列（透過つき） */
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
  // fallback
  return `rgba(15,23,42,${alpha})`;
}

/** radius は string/number どちらでも受けて安全な値にする */
function resolveRadius(raw: unknown): string {
  if (typeof raw === "number") return `${raw}px`;
  if (typeof raw === "string" && raw.trim()) {
    // "soft" / "round" などのプリセットっぽい値はマップ
    const v = raw.trim();
    switch (v) {
      case "none":
        return "0px";
      case "soft":
        return "16px";
      case "md":
        return "20px";
      case "lg":
        return "24px";
      case "xl":
        return "32px";
      case "round":
        return "999px";
      default:
        // px や rem 指定はそのまま使う
        return v;
    }
  }
  return "20px";
}

/** worldview＋shadow指定から「中くらいの影」を決める */
function resolveShadow(worldview: VariantSpec["worldview"], raw?: unknown): string {
  if (typeof raw === "string" && raw.trim() && raw !== "none") {
    // 既に box-shadow 文字列ならそれを優先
    if (raw.includes("px") && raw.includes("rgba")) return raw;
  }

  // Q5: 中レベルの shadow をベースに、worldviewごとに少しだけ変える
  switch (worldview) {
    case "cute":
      return "0 18px 40px rgba(244,114,182,0.30)";
    case "pop":
      return "0 20px 46px rgba(15,23,42,0.28)";
    case "cyber":
      return "0 24px 60px rgba(0,0,0,0.80)";
    case "luxury":
      return "0 22px 52px rgba(15,23,42,0.60)";
    case "dark":
      return "0 22px 52px rgba(0,0,0,0.75)";
    case "natural":
      return "0 16px 32px rgba(15,23,42,0.20)";
    case "modern":
      return "0 20px 44px rgba(15,23,42,0.35)";
    case "business":
      return "0 18px 40px rgba(15,23,42,0.28)";
    case "retro":
      return "0 18px 40px rgba(55,48,163,0.32)";
    case "minimal":
    default:
      return "0 14px 30px rgba(15,23,42,0.18)";
  }
}

/**
 * variant + theme からカードUI用のスタイルを算出
 *
 * Q4: glass 強度は worldview ごとに変更
 * Q5: shadow は「中」ベース
 */
export function applyVariantStyle(
  variant: VariantSpec,
  theme: Design["theme"]
): VariantStyle {
  const primary = theme.colorPrimary;
  const accent = theme.colorAccent;
  const bg = theme.colorBG;
  const text = theme.colorText;

  const radius = resolveRadius((variant as any).radius);
  const shadow = resolveShadow(variant.worldview, (variant as any).shadow);

  const borderBase = hexToRgba(primary, 0.55);
  const mutedTextBase = hexToRgba(text, 0.65);

  // worldview ごとに glass / paper / solid を決める
  type SurfaceMode = "glassStrong" | "glassSoft" | "paper" | "solid" | "neon";
  let mode: SurfaceMode = "paper";

  switch (variant.worldview) {
    case "cyber":
      mode = "neon"; // 強めglass＋ネオン
      break;
    case "luxury":
    case "modern":
      mode = "glassStrong";
      break;
    case "dark":
      mode = "glassSoft";
      break;
    case "cute":
    case "pop":
      mode = "glassSoft";
      break;
    case "natural":
      mode = "paper";
      break;
    case "business":
    case "minimal":
    case "retro":
    default:
      mode = "paper";
      break;
  }

  let surfaceBG = bg;
  let borderColor = borderBase;
  let textColor = text;
  let mutedText = mutedTextBase;
  let tagBG = hexToRgba(bg, 0.8);

  if (mode === "paper") {
    // 少しだけ陰影をつけたペーパー質感
    surfaceBG = `linear-gradient(
      135deg,
      ${hexToRgba(bg, 0.98)} 0%,
      ${hexToRgba(bg, 0.96)} 55%,
      ${hexToRgba(primary, 0.04)} 100%
    )`;
    borderColor = hexToRgba(primary, 0.25);
    tagBG = hexToRgba(primary, 0.08);
  } else if (mode === "glassSoft") {
    surfaceBG = `linear-gradient(
      135deg,
      ${hexToRgba("#ffffff", 0.06)} 0%,
      ${hexToRgba(accent, 0.10)} 45%,
      ${hexToRgba("#000000", 0.30)} 100%
    )`;
    borderColor = hexToRgba(accent, 0.70);
    textColor = hexToRgba("#f9fafb", 0.96);
    mutedText = hexToRgba("#e5e7eb", 0.70);
    tagBG = hexToRgba("#020617", 0.85);
  } else if (mode === "glassStrong") {
    surfaceBG = `linear-gradient(
      140deg,
      ${hexToRgba("#ffffff", 0.07)} 0%,
      ${hexToRgba(accent, 0.25)} 35%,
      ${hexToRgba("#020617", 0.95)} 100%
    )`;
    borderColor = `linear-gradient(
      120deg,
      ${hexToRgba(accent, 0.2)},
      ${hexToRgba("#ffffff", 0.45)},
      ${hexToRgba(accent, 0.8)}
    )`;
    // 実際には borderColor は outline 用にも使う
    textColor = hexToRgba("#f9fafb", 0.97);
    mutedText = hexToRgba("#e5e7eb", 0.75);
    tagBG = hexToRgba("#020617", 0.80);
  } else if (mode === "neon") {
    surfaceBG = `radial-gradient(
        circle at 0% 0%,
        ${hexToRgba(accent, 0.30)} 0,
        ${hexToRgba("#020617", 0.98)} 55%
      ),
      radial-gradient(
        circle at 100% 100%,
        ${hexToRgba(primary, 0.22)} 0,
        ${hexToRgba("#020617", 1)} 45%
      )`;
    borderColor = hexToRgba(accent, 0.95);
    textColor = hexToRgba("#f9fafb", 0.98);
    mutedText = hexToRgba("#e5e7eb", 0.75);
    tagBG = hexToRgba("#020617", 0.95);
  }

  return {
    borderColor,
    textColor,
    accentColor: accent,
    radius,
    shadow,
    surfaceBG,
    mutedText,
    tagBG,
  };
}
