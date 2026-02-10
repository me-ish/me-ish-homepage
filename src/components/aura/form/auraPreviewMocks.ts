// src/components/aura/form/auraPreviewMocks.ts
// Preview-only constants and builders extracted from AuraFormWizard.

import type { WorldviewBase } from "@/lib/aura/aura.worldviewPresets";
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";
import type { Design, Content } from "@/lib/aura/aura.schema";
import type { VariantSpec, PatternId } from "@/lib/aura/aura.variant.base";

/* =========================================================
 * Worldview colour / gradient maps
 * ========================================================= */
export const WORLDVIEW_COLORS: Record<WorldviewBase, { primary: string; accent: string; bg: string }> = {
  minimal: { primary: "#111827", accent: "#6B7280", bg: "#F9FAFB" },
  modern: { primary: "#38BDF8", accent: "#94A3B8", bg: "#020617" },
  business: { primary: "#2563EB", accent: "#0F172A", bg: "#EFF6FF" },
  cute: { primary: "#FB7185", accent: "#FDBA74", bg: "#FEF2F2" },
  pop: { primary: "#F97316", accent: "#EC4899", bg: "#FEF3C7" },
  dark: { primary: "#F97316", accent: "#E5E7EB", bg: "#020617" },
  cyber: { primary: "#22D3EE", accent: "#A855F7", bg: "#020617" },
  natural: { primary: "#22C55E", accent: "#A3E635", bg: "#ECFDF3" },
  luxury: { primary: "#FACC15", accent: "#FEFCE8", bg: "#020617" },
  retro: { primary: "#D97706", accent: "#78350F", bg: "#FFFBEB" },
};

export const WORLDVIEW_GRADIENTS: Record<WorldviewBase, string> = {
  minimal: "linear-gradient(145deg, #ffffff 0%, #f3f4f6 100%)",
  modern: "linear-gradient(145deg, #020617 0%, #0f172a 50%, #1e293b 100%)",
  business: "linear-gradient(145deg, #e2e8f0 0%, #f8fafc 100%)",
  cute: "linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)",
  pop: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%)",
  dark: "linear-gradient(145deg, #020617 0%, #020617 100%)",
  cyber: "linear-gradient(145deg, #020617 0%, #111827 40%, #312e81 75%, #4c1d95 100%)",
  natural: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%)",
  luxury: "linear-gradient(145deg, #020617 0%, #0b1220 55%, #111827 100%)",
  retro: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)",
};

/* =========================================================
 * Pure builder functions
 * ========================================================= */

const LIGHT_TEXT_WORLDVIEWS: ReadonlySet<WorldviewBase> = new Set([
  "minimal", "business", "cute", "pop", "retro",
]);

export function buildMockTheme(
  worldviewBase: WorldviewBase,
  presetForPreview: ReturnType<typeof getWorldviewPreset>,
): Design["theme"] {
  const colors = WORLDVIEW_COLORS[worldviewBase];
  const anyPreset = presetForPreview as any;
  const presetPatternLayers: string[] = Array.isArray(anyPreset.patternLayers) ? anyPreset.patternLayers : [];
  const presetTextureLayers: string[] = Array.isArray(anyPreset.textureLayers) ? anyPreset.textureLayers : [];
  const presetBgStyle = (anyPreset.bgStyle as React.CSSProperties | undefined) ?? undefined;

  const bgGradient: string | undefined =
    (typeof anyPreset.bgGradient === "string" && anyPreset.bgGradient.trim()
      ? anyPreset.bgGradient
      : WORLDVIEW_GRADIENTS[worldviewBase]) ?? undefined;

  const patternColor: string =
    typeof anyPreset.patternColor === "string" && anyPreset.patternColor.trim()
      ? anyPreset.patternColor
      : colors.primary;

  const backgroundPattern: PatternId | "none" = (presetForPreview.patternBase as any) ?? "none";

  return {
    colorPrimary: colors.primary,
    colorAccent: colors.accent,
    colorBG: colors.bg,
    colorText: LIGHT_TEXT_WORLDVIEWS.has(worldviewBase) ? "#111827" : "#E5E7EB",
    bgGradient,
    bgStyle: presetBgStyle,
    patternLayers:
      presetPatternLayers.length > 0
        ? presetPatternLayers
        : backgroundPattern === "none"
        ? []
        : [backgroundPattern],
    textureLayers: presetTextureLayers,
    patternColor,
    backgroundPattern,
    languageMode: presetForPreview.languageMode as any,
    fontPreset: presetForPreview.fontPreset as any,
  } as any;
}

export function buildMockVariant(
  worldviewBase: WorldviewBase,
  aiSwing: number,
): VariantSpec {
  const layout = aiSwing > 60 ? "split" : "centerBasic";
  const surface = aiSwing > 20 ? "glass" : "card";

  return {
    worldview: worldviewBase,
    layout: layout as any,
    surface: surface as any,
    pattern: "none" as any,
    showcase: "gallery" as any,
    variantId: "mock",
    shadow: aiSwing > 60 ? "deep" : "soft",
    radius: aiSwing >= 100 ? "extraLarge" : "large",
  } as any;
}

export function buildMockHeroSection(tagline: string): Content["sections"][number] {
  return {
    type: "hero" as const,
    headings: [
      tagline || "あなたのキャッチコピーがここに表示されます",
    ],
  };
}
