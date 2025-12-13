// src/components/aiPortfolio/aiPortfolioPortfolioRenderer.tsx
"use client";

import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import {
  VARIANTS,
  type PatternId,
  type VariantSpec,
} from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { fontFamilyFromPreset } from "@/styles/aiPortfolioFonts";
import type {
  LayoutPref,
  SectionType,
  LayoutType,
} from "@/lib/aiPortfolio/aiPortfolio.layout";

/* NEW: HeroSwitcher (世界観ごとにHeroを切り替える) */
import { AiPortfolioHeroSwitcher } from "./sections/AiPortfolioHeroSwitcher";

/* 既存セクション */
import { AiPortfolioAboutSimple } from "./sections/aiPortfolioAboutSimple";
import { AiPortfolioGalleryGrid } from "./sections/aiPortfolioGalleryGrid";
import { AiPortfolioServices } from "./sections/aiPortfolioServices";
import { AiPortfolioSkills } from "./sections/aiPortfolioSkills";
import { AiPortfolioContactCTA } from "./sections/aiPortfolioContactCTA";
import { AiPortfolioContact } from "./sections/aiPortfolioContact";

import { applyVariantStyle } from "./applyVariantStyle";

type ContentSection = Content["sections"][number];

type Props = {
  design: Design;
  content: Content;
  /** プレビューで上書きする並び順（例: ["hero","works",...]） */
  sectionOrderOverride?: string[];
};

/* ---------------------------------------------------------
 * PatternId → CSS 生成
 * --------------------------------------------------------- */
function patternStyle(
  pattern: PatternId | "none",
  color: string,
): React.CSSProperties {
  switch (pattern) {
    case "dot-soft":
      return {
        backgroundImage: `radial-gradient(${color}18 2px, transparent 2px)`,
        backgroundSize: "18px 18px",
      };
    case "dot-retro":
      return {
        backgroundImage: `radial-gradient(${color}33 6px, transparent 6px)`,
        backgroundSize: "40px 40px",
      };
    case "dot-dense-noise":
      return {
        backgroundImage: `radial-gradient(${color}1a 1.5px, transparent 1.5px)`,
        backgroundSize: "10px 10px",
      };

    case "stripe-vertical-soft":
      return {
        backgroundImage: `repeating-linear-gradient(
          90deg,
          ${color}12,
          ${color}12 2px,
          transparent 2px,
          transparent 16px
        )`,
      };
    case "stripe-vertical-bold":
      return {
        backgroundImage: `repeating-linear-gradient(
          90deg,
          ${color}26,
          ${color}26 6px,
          transparent 6px,
          transparent 22px
        )`,
      };
    case "stripe-diagonal":
      return {
        backgroundImage: `repeating-linear-gradient(
          135deg,
          ${color}18,
          ${color}18 3px,
          transparent 3px,
          transparent 15px
        )`,
      };

    case "grid-thin":
      return {
        backgroundImage: `
          linear-gradient(${color}12 1px, transparent 1px),
          linear-gradient(90deg, ${color}12 1px, transparent 1px)
        `,
        backgroundSize: "32px 32px",
      };
    case "grid-neon":
      return {
        backgroundImage: `
          linear-gradient(${color}40 1px, transparent 1px),
          linear-gradient(90deg, ${color}40 1px, transparent 1px)
        `,
        backgroundSize: "32px 32px",
      };

    case "texture-paper":
      return {
        backgroundImage: `
          radial-gradient(circle at 0 0, ${color}08 0, transparent 60%),
          radial-gradient(circle at 100% 100%, ${color}08 0, transparent 60%)
        `,
        backgroundSize: "80px 80px",
      };
    case "texture-noise":
      return {
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
        backgroundSize: "6px 6px",
      };

    case "none":
    default:
      return {};
  }
}

/* ---------------------------------------------------------
 * グリッド系のラインカラーを worldview ごとに出し分け
 * --------------------------------------------------------- */
function getGridLineColor(
  variant: VariantSpec,
  theme: Design["theme"],
): string {
  switch (variant.worldview) {
    case "minimal":
    case "business":
      return "#e5e7eb"; // slate-200
    case "dark":
    case "cyber":
    case "luxury":
      return theme.colorAccent || theme.colorPrimary;
    default:
      // pop / cute / natural / retro など
      return theme.colorPrimary;
  }
}

/* ---------------------------------------------------------
 * グラデーション＋柄レイヤー＋テクスチャ＋bgStyle を合成
 * --------------------------------------------------------- */
function buildBackgroundStyle(
  theme: Design["theme"],
  variant: VariantSpec,
): React.CSSProperties {
  const anyTheme = theme as any;
  const baseColor = theme.colorBG;

  // worldviewPreset から注入された bgStyle があれば最優先
  const presetBgStyle = anyTheme.bgStyle as
    | React.CSSProperties
    | undefined;

  if (presetBgStyle && Object.keys(presetBgStyle).length > 0) {
    return {
      backgroundColor: baseColor,
      ...presetBgStyle,
    };
  }

  // patternLayers / backgroundPattern / variant.pattern
  const rawPatternColor = anyTheme.patternColor || theme.colorPrimary;

  const rawPatternLayers: unknown = anyTheme.patternLayers;
  const patternLayers: (PatternId | "none")[] =
    Array.isArray(rawPatternLayers) && rawPatternLayers.length > 0
      ? (rawPatternLayers as (PatternId | "none")[])
      : ([
          ((theme.backgroundPattern as PatternId | undefined) ?? 
            (variant.pattern as PatternId | undefined) ?? 
            "none") as PatternId | "none",
        ] as (PatternId | "none")[]);

  const rawTextureLayers: unknown = anyTheme.textureLayers;
  const textureLayers: string[] = Array.isArray(rawTextureLayers)
    ? (rawTextureLayers as string[])
    : [];

  const bgGradient: string | undefined = anyTheme.bgGradient;

  const images: string[] = [];
  const sizes: string[] = [];

  /* 1) 柄レイヤー */
  for (const p of patternLayers) {
    let colorToUse = rawPatternColor;

    if (typeof p === "string" && p.startsWith("grid-")) {
      colorToUse = getGridLineColor(variant, theme);
    }

    const pat = patternStyle(p, colorToUse);
    if (!pat.backgroundImage) continue;

    images.push(pat.backgroundImage as string);
    sizes.push((pat.backgroundSize as string) || "auto");
  }

  /* 2) テクスチャレイヤー（ノイズ / 紙） */
  for (const layer of textureLayers) {
    if (layer === "noise-soft") {
      images.push(
        "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
      );
      sizes.push("4px 4px");
    } else if (layer === "paper-grain") {
      images.push(
        "radial-gradient(circle at 0 0, rgba(255,255,255,0.30) 0, transparent 60%)",
      );
      sizes.push("120px 120px");
    }
  }

  /* 3) グラデーションレイヤー */
  if (bgGradient) {
    const useGradient =
      textureLayers.includes("gradient") || textureLayers.length === 0;

    if (useGradient) {
      images.push(bgGradient);
      sizes.push("auto");
    }
  }

  const style: React.CSSProperties = {
    backgroundColor: baseColor,
  };

  if (images.length > 0) {
    style.backgroundImage = images.join(",");
    style.backgroundSize = sizes.join(",");
  }

  return style;
}

/* ---------------------------------------------------------
 * MAIN RENDERER
 * --------------------------------------------------------- */
export default function AiPortfolioPortfolioRenderer({
  design,
  content,
  sectionOrderOverride,
}: Props) {
  const theme = design.theme;

  // variantSpec が design に付いていれば優先、それ以外は id / 先頭
  const variant: VariantSpec =
    (design as any).variantSpec ??
    VARIANTS.find((v) => v.id === design.variantId) ??
    VARIANTS[0];

  const v = applyVariantStyle(variant, theme);

  // 安全なセクション配列
  const safeDesignSections = Array.isArray(design.sections)
    ? design.sections
    : [];

  // LayoutDecision（AI が決めた情報）があれば採用
  const layoutDecision = (design as any)
    .layoutDecision as
    | {
        layoutPref?: LayoutPref;
        sectionOrder?: SectionType[];
        heroLayout?: string;
        worksLayout?: string;
        layoutType?: LayoutType;
      }
    | undefined;

  const aiSectionOrder = layoutDecision?.sectionOrder;

  // --- 並び順決定ロジック ---------------------------------------
  let orderedSections = [...safeDesignSections];

  if (sectionOrderOverride && sectionOrderOverride.length > 0) {
    // ① ユーザー操作の override が最優先
    const map = new Map<string, (typeof safeDesignSections)[number]>();
    for (const sec of safeDesignSections) {
      map.set(sec.type, sec);
    }

    const picked: typeof safeDesignSections = [];

    for (const type of sectionOrderOverride) {
      const hit = map.get(type);
      if (hit) {
        picked.push(hit);
        map.delete(type);
      }
    }

    // override に含まれなかったセクションは末尾に
    for (const rest of map.values()) {
      picked.push(rest);
    }

    orderedSections = picked;
  } else if (aiSectionOrder && aiSectionOrder.length > 0) {
    // ② AI が決めた sectionOrder を使う
    const orderMap: Record<string, number> = {};
    aiSectionOrder.forEach((type, idx) => {
      orderMap[type] = idx;
    });

    orderedSections.sort((a, b) => {
      const aKey = (a.type || "") as SectionType;
      const bKey = (b.type || "") as SectionType;
      const ao =
        orderMap[aKey] !== undefined ? orderMap[aKey] : a.order ?? 999;
      const bo =
        orderMap[bKey] !== undefined ? orderMap[bKey] : b.order ?? 999;
      return ao - bo;
    });
  } else {
    // ③ どちらも無ければ従来どおり order 昇順
    orderedSections.sort((a, b) => a.order - b.order);
  }

  const findSection = (type: string): ContentSection | undefined =>
    content.sections.find((sec) => sec.type === type);

  // layoutBase: variant.layout ではなく layoutDecision.layoutPref を優先
  const layoutPref: LayoutPref =
    layoutDecision?.layoutPref ??
    (variant.layout === "split" ? "split" : "center");

  const layoutBase =
    layoutPref === "split"
      ? "text-left md:text-left"
      : "text-center md:text-center";

  // フォントプリセット → クラス名
  const presetKey: string =
    (theme as any).fontPreset ??
    (design as any).fontPreset ??
    (design as any).designAnswers?.fontPreset ??
    "cleanJa";

  const fontClass = fontFamilyFromPreset(presetKey);

  console.log("[Renderer] theme.fontPreset:", (theme as any).fontPreset);
  console.log("[Renderer] presetKey:", presetKey);
  console.log("[Renderer] fontClass:", fontClass);
  console.log("[Renderer] layoutPref:", layoutPref);
  console.log(
    "[Renderer] layoutDecision.sectionOrder:",
    layoutDecision?.sectionOrder,
  );
  console.log(
    "[Renderer] layoutDecision.layoutType:",
    layoutDecision?.layoutType,
  );
  console.log(
    "[Renderer] sectionOrderOverride:",
    sectionOrderOverride,
  );

  const backgroundStyle = buildBackgroundStyle(theme, variant);

  return (
    <div
      className={`ai-portfolio-root min-h-[60vh] border ${layoutBase} ${fontClass}`}
      style={{
        borderColor: theme.colorPrimary,
        borderRadius: v.radius,
        boxShadow: v.shadow,
        ...backgroundStyle,
      }}
      // ★ AIレイアウト情報を data 属性で埋め込んでおく（あとからCSSやデバッグで使える）
      data-layout-pref={layoutPref}
      data-layout-type={layoutDecision?.layoutType}
    >
      {/* 上部ラベルバー */}
      <div
        className="rounded-t-xl px-6 py-4 text-xs font-medium tracking-widest text-gray-500"
        style={{ background: theme.colorBG }}
      >
        PORTFOLIO
      </div>

      {/* セクション本体 */}
      <div className="space-y-10 px-6 pb-10 pt-6">
        {orderedSections.map((sec) => {
          const data = findSection(sec.type);
          if (!data) return null;

          switch (sec.type) {
            case "hero":
              return (
                <AiPortfolioHeroSwitcher
                  key={sec.type}
                  section={data}
                  theme={theme}
                  variant={variant}
                  // layoutDecision?.heroLayout / layoutDecision?.layoutType を
                  // 渡したくなったらここで props 拡張
                />
              );

            case "about":
              return (
                <AiPortfolioAboutSimple
                  key={sec.type}
                  section={data}
                  theme={theme}
                  variant={variant}
                />
              );

            case "works":
              return (
                <AiPortfolioGalleryGrid
                  key={sec.type}
                  section={data}
                  theme={theme}
                  variant={variant}
                  // layoutDecision?.worksLayout もここで将来使える
                />
              );

            case "services":
              return (
                <AiPortfolioServices
                  key={sec.type}
                  section={data}
                  theme={theme}
                  variant={variant}
                />
              );

            case "skills":
              return (
                <AiPortfolioSkills
                  key={sec.type}
                  section={data}
                  theme={theme}
                  variant={variant}
                />
              );

            case "contact":
              return (
                <AiPortfolioContact
                  key={sec.type}
                  section={data}
                  theme={theme}
                  variant={variant}
                />
              );

            case "cta":
              return (
                <AiPortfolioContactCTA
                  key={sec.type}
                  section={data}
                  theme={theme}
                  variant={variant}
                />
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
