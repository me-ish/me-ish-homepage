// src/components/aura/form/auraPreviewMocks.ts
// Preview-only constants and builders extracted from AuraFormWizard.

import type { WorldviewBase } from "@/lib/aura/aura.worldviewPresets";
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";
import type { Design, Content } from "@/lib/aura/aura.schema";
import type { VariantSpec, PatternId } from "@/lib/aura/aura.variant.base";
import type { AuraFormData } from "./auraFormTypes";

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
  colorOverride?: string,
  fontOverride?: string,
  avatarShape?: string,
  avatarSize?: string,
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
    colorPrimary: colorOverride || colors.primary,
    colorAccent: colorOverride || colors.accent,
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
    fontPreset: (fontOverride || presetForPreview.fontPreset) as any,
    avatarShape: avatarShape ?? "circle",
    avatarSize: avatarSize ?? "md",
  } as any;
}

export function buildMockVariant(
  worldviewBase: WorldviewBase,
  aiSwing: number,
  surfaceOverride?: string,
  showcaseOverride?: string,
  layoutOverride?: string,
): VariantSpec {
  const layout = layoutOverride || (aiSwing > 60 ? "split" : "centerBasic");
  const surface = surfaceOverride || (aiSwing > 20 ? "glass" : "card");
  const showcase = showcaseOverride || "gallery";

  return {
    worldview: worldviewBase,
    layout: layout as any,
    surface: surface as any,
    pattern: "none" as any,
    showcase: showcase as any,
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

/* =========================================================
 * フォームデータ → Content（全セクション）
 * ========================================================= */
export function buildMockContent(data: AuraFormData): Content {
  const skills = [
    ...data.skillPresets,
    ...(data.manualSkills
      ? data.manualSkills.split(",").map((s) => s.trim()).filter(Boolean)
      : []),
  ];

  const filledServices = data.services.filter((s) => s.name);
  const hasContact = data.twitter || data.instagram || data.behance || data.website;

  const sections: Content["sections"] = [];

  // Hero（常に先頭）：キャッチコピー → 大見出し、名前 → 小見出し
  sections.push({
    type: "hero",
    headings: [
      data.tagline || "あなたのキャッチコピーがここに表示されます",
      data.name || "",
    ].filter(Boolean) as string[],
    paragraphs: [],
    avatarUrl: data.avatarPreviewUrl || undefined,
  } as any);

  // About（データ未入力時はプレースホルダー）
  if (data.sections.about) {
    sections.push({
      type: "about",
      headings: [
        "About",
        data.name || "Your Name",
        data.title || "",
      ].filter(Boolean) as string[],
      paragraphs: [
        data.bio ||
          "自己紹介テキストがここに表示されます。あなたの経歴・強み・こだわりなどを入力してください。",
      ],
      avatarUrl: data.avatarPreviewUrl || undefined,
      aboutLayout: data.aboutLayout,
    } as any);
  }

  // Works（データ未入力時はプレースホルダー）
  if (data.sections.works) {
    const workItems =
      data.images.length > 0
        ? data.images.map((img) => ({
            imageUrl: img.imageUrl,
            title: img.title,
            description: img.description,
          }))
        : [
            { imageUrl: "", title: "作品タイトル 1", description: "作品の説明テキスト" },
            { imageUrl: "", title: "作品タイトル 2", description: "作品の説明テキスト" },
            { imageUrl: "", title: "作品タイトル 3", description: "作品の説明テキスト" },
          ];
    sections.push({ type: "works", items: workItems } as any);
  }

  // Services（データ未入力時はプレースホルダー）
  if (data.sections.services) {
    const serviceItems =
      filledServices.length > 0
        ? filledServices.map((s) => ({
            title: s.name,
            priceHint: s.price,
            description: s.desc,
          }))
        : [
            { title: "サービス A", description: "提供するサービスの説明" },
            { title: "サービス B", description: "提供するサービスの説明" },
          ];
    sections.push({ type: "services", items: serviceItems } as any);
  }

  // Skills（データ未入力時はプレースホルダー）
  if (data.sections.skills) {
    const skillItems =
      skills.length > 0
        ? skills.map((s) => ({ label: s }))
        : ["Illustration", "Design", "Photoshop", "Procreate"].map((s) => ({ label: s }));
    sections.push({ type: "skills", items: skillItems } as any);
  }

  // Contact（データ未入力時はプレースホルダー）
  if (data.sections.contact) {
    const contactLinks = [
      ...(data.twitter ? [{ label: "X", href: data.twitter }] : []),
      ...(data.instagram ? [{ label: "Instagram", href: data.instagram }] : []),
      ...(data.behance ? [{ label: "Behance", href: data.behance }] : []),
      ...(data.website ? [{ label: "Web", href: data.website }] : []),
    ];
    sections.push({
      type: "contact",
      email: data.contactEmail || undefined,
      links: contactLinks.length > 0 ? contactLinks : undefined,
    } as any);
  }

  return { sections };
}

/* =========================================================
 * フォームデータ → Design（モック）
 * ========================================================= */
export function buildMockDesign(
  worldviewBase: WorldviewBase,
  aiSwing: number,
  preset: ReturnType<typeof getWorldviewPreset>,
  color?: string,
  overrides?: {
    fontPreset?: string;
    surfaceStyle?: string;
    showcaseStyle?: string;
    layoutPref?: string;
    avatarShape?: string;
    avatarSize?: string;
  },
): Design {
  const theme = buildMockTheme(
    worldviewBase,
    preset,
    color,
    overrides?.fontPreset,
    overrides?.avatarShape,
    overrides?.avatarSize,
  );
  const variant = buildMockVariant(
    worldviewBase,
    aiSwing,
    overrides?.surfaceStyle,
    overrides?.showcaseStyle,
    overrides?.layoutPref,
  );

  return {
    theme,
    variantId: "mock",
    // AuraPortfolioRenderer が (design as any).variantSpec で読む
    variantSpec: variant,
    // strength を注入（HeroMinimal の cardMode 判定に使われる）
    overallStrength: aiSwing,
    sections: [
      { type: "hero",     order: 0 },
      { type: "about",    order: 1 },
      { type: "works",    order: 2 },
      { type: "services", order: 3 },
      { type: "skills",   order: 4 },
      { type: "contact",  order: 5 },
    ],
  } as any;
}
