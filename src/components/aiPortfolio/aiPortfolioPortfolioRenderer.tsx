// src/components/aiPortfolio/aiPortfolioPortfolioRenderer.tsx
"use client";

import React, { useMemo } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import {
  VARIANTS,
  type VariantSpec,
} from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { fontFamilyFromPreset } from "@/styles/aiPortfolioFonts";
import type {
  LayoutPref,
  SectionType,
  LayoutType,
} from "@/lib/aiPortfolio/aiPortfolio.layout";

/* ✅ NEW: Storage path → proxy URL */
import { auraAssetProxyUrl } from "@/lib/aiPortfolio/storage/auraAssets";

/* ✅ NEW: 共通の背景合成（プレビューと本番で一致させる） */
import { buildBackgroundStyle } from "@/lib/aiPortfolio/aiPortfolio.background";

/* NEW: HeroSwitcher (世界観ごとにHeroを切り替える) */
import { AiPortfolioHeroSwitcher } from "./sections/AiPortfolioHeroSwitcher";

/* 既存セクション */
import { AiPortfolioAboutSimple } from "./sections/aiPortfolioAboutSimple";
import { AiPortfolioGalleryGrid } from "./sections/aiPortfolioGalleryGrid";
import { AiPortfolioServices } from "./sections/aiPortfolioServices";
import { AiPortfolioSkills } from "./sections/aiPortfolioSkills";
import { AiPortfolioContact } from "./sections/aiPortfolioContact";

import { applyVariantStyle } from "./applyVariantStyle";

type ContentSection = Content["sections"][number];

type Props = {
  design: Design;
  content: Content;

  /**
   * 旧：プレビューで上書きする並び順（例: ["hero","works",...]）
   * 既存呼び出しの互換のため残す
   */
  sectionOrderOverride?: string[];

  /**
   * 新：Shell等から渡される並び順（こちらを優先させたいケース用）
   * （sectionOrderOverride と併存した場合は sectionOrder を優先）
   */
  sectionOrder?: string[];
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function isStoragePathLike(s: string) {
  const v = (s ?? "").trim();
  if (!v) return false;

  // 典型：works/... / avatars/...
  if (v.startsWith("works/") || v.startsWith("avatars/")) return true;

  // ついでに、誤って先頭スラッシュ付きで入るケースも救う
  if (v.startsWith("/works/") || v.startsWith("/avatars/")) return true;

  return false;
}

/* ---------------------------------------------------------
 * StoragePath → 表示URLの正規化（hero / works 共通）
 * --------------------------------------------------------- */
function normalizeImageUrl(
  imageUrl?: string | null,
  storagePath?: string | null
): string {
  const u = (imageUrl ?? "").trim();

  // ✅ imageUrl が “URLっぽい” ならそのまま
  // ただし、"works/..." のような storagePath が入ってる場合は proxy に変換する
  if (u) {
    if (isStoragePathLike(u)) {
      const p = u.startsWith("/") ? u.slice(1) : u;
      return auraAssetProxyUrl(p);
    }
    return u;
  }

  // ✅ imageUrl が空なら storagePath を使う
  const p0 = (storagePath ?? "").trim();
  if (!p0) return "";
  const p = p0.startsWith("/") ? p0.slice(1) : p0;

  return auraAssetProxyUrl(p);
}

function normalizeSection(sec: any): any {
  // 1) セクション直下に avatarUrl / avatarStoragePath があるケース
  if (
    typeof sec?.avatarUrl !== "undefined" ||
    typeof sec?.avatarStoragePath !== "undefined"
  ) {
    const nextAvatar = normalizeImageUrl(sec?.avatarUrl, sec?.avatarStoragePath);
    sec = { ...sec, avatarUrl: nextAvatar };
  }

  // 2) セクション直下に imageUrl / storagePath があるケース（将来の拡張も兼ねる）
  if (
    typeof sec?.imageUrl !== "undefined" ||
    typeof sec?.storagePath !== "undefined"
  ) {
    const nextUrl = normalizeImageUrl(sec?.imageUrl, sec?.storagePath);
    sec = { ...sec, imageUrl: nextUrl };
  }

  // 3) items 配列（works / hero / 任意のカード群）
  if (Array.isArray(sec?.items)) {
    const items = sec.items.map((it: any) => {
      // imageUrl / url どっちに入ってても拾う
      const rawUrl = (it?.imageUrl ?? it?.url ?? it?.src) as
        | string
        | undefined;

      // storagePath の別名も拾う（path で返す実装もある）
      const rawPath = (it?.storagePath ?? it?.path ?? it?.storage_path) as
        | string
        | undefined;

      const nextUrl = normalizeImageUrl(rawUrl, rawPath);

      // ✅ imageUrl を必ず埋める（Gallery側が url を見てても壊れないように両方入れる）
      if (nextUrl) {
        return {
          ...it,
          imageUrl: nextUrl,
          url: it?.url ? nextUrl : it?.url, // 既にurl運用なら上書き
          src: it?.src ? nextUrl : it?.src, // src運用も救う
        };
      }
      return it;
    });

    sec = { ...sec, items };
  }

  return sec;
}

/* ---------------------------------------------------------
 * MAIN RENDERER
 * --------------------------------------------------------- */
export default function AiPortfolioPortfolioRenderer({
  design,
  content,
  sectionOrderOverride,
  sectionOrder,
}: Props) {
  const theme = design.theme;

  const variant: VariantSpec =
    (design as any).variantSpec ??
    VARIANTS.find((v) => v.id === (design as any).variantId) ??
    VARIANTS[0];

  // ✅ content を描画前に “表示URLが必ず入る形” に正規化
  const normalizedContent: Content = useMemo(() => {
    const secs = Array.isArray(content?.sections) ? content.sections : [];
    const nextSections = secs.map((s) => normalizeSection(s));
    // Contentの他フィールドはそのまま（sectionsだけ置き換え）
    return { ...content, sections: nextSections };
  }, [content]);

  // 安全なセクション配列（Design側）
  const safeDesignSections = Array.isArray(design.sections)
    ? design.sections
    : [];

  // LayoutDecision（AI が決めた情報）があれば採用
  const layoutDecision = (design as any).layoutDecision as
    | {
        layoutPref?: LayoutPref;
        sectionOrder?: SectionType[];
        heroLayout?: string;
        worksLayout?: string;
        layoutType?: LayoutType;
      }
    | undefined;

  const aiSectionOrder = layoutDecision?.sectionOrder;

  // content側の type 一覧（Designのsectionsとズレた場合の救済）
  const contentTypes = uniq(normalizedContent.sections.map((s) => s.type));

  // --- 並び順決定ロジック（単一化） ------------------------------
  // 優先順：sectionOrder（新） > sectionOrderOverride（旧） > aiSectionOrder > design.order
  const baseOrder =
    Array.isArray(sectionOrder) && sectionOrder.length > 0
      ? sectionOrder
      : Array.isArray(sectionOrderOverride) && sectionOrderOverride.length > 0
      ? sectionOrderOverride
      : Array.isArray(aiSectionOrder) && aiSectionOrder.length > 0
      ? (aiSectionOrder as unknown as string[])
      : [];

  const preferredOrder = uniq(baseOrder);

  let orderedSections = [...safeDesignSections];

  if (preferredOrder.length > 0) {
    const map = new Map<string, (typeof safeDesignSections)[number]>();
    for (const sec of safeDesignSections) map.set(sec.type, sec);

    const picked: typeof safeDesignSections = [];
    for (const type of preferredOrder) {
      const hit = map.get(type);
      if (hit) {
        picked.push(hit);
        map.delete(type);
      }
    }
    for (const rest of map.values()) picked.push(rest);
    orderedSections = picked;
  } else {
    orderedSections.sort((a, b) => a.order - b.order);
  }

  // --- 表示セクションの最終補正（contentにしか無いtypeを末尾に追加） ----
  const orderedTypes = orderedSections.map((s) => s.type);
  const restContentTypes = contentTypes.filter((t) => !orderedTypes.includes(t));
  const finalOrderTypes = uniq([...orderedTypes, ...restContentTypes]);

  const findSection = (type: string): ContentSection | undefined =>
    normalizedContent.sections.find((sec) => sec.type === type);

  // LayoutPref は最終決定（ここが真実）
  const layoutPref: LayoutPref =
    layoutDecision?.layoutPref ??
    (variant.layout === "split" ? "split" : "center");

  // ✅ 強度（AIスライダー）を design 側から拾って variant に注入する
  // - design.overallStrength（推奨）
  // - design.aiDegree / design.aiStrength 等（互換）
  // - design.designAnswers 側に入っているケースも拾う
  const overallStrengthRaw =
    (design as any).overallStrength ??
    (design as any).aiStrength ??
    (design as any).aiDegree ??
    (design as any).strength ??
    (design as any).designAnswers?.overallStrength ??
    (design as any).designAnswers?.aiStrength ??
    (design as any).designAnswers?.aiDegree ??
    (design as any).designAnswers?.strength ??
    0;

  const overallStrength =
    typeof overallStrengthRaw === "string"
      ? Number(overallStrengthRaw)
      : Number(overallStrengthRaw);

  // 以降、Renderer内で使うvariantは必ずこれに統一（layout + strength）
  // ※ VariantSpec に overallStrength が無い型定義でも壊さないため as any で注入
  const renderVariant: VariantSpec = {
    ...variant,
    layout: layoutPref === "split" ? "split" : "center",
    overallStrength: Number.isFinite(overallStrength) ? overallStrength : 0,
  } as any;

  // v / background も renderVariant で計算（分裂を防ぐ）
  const v = applyVariantStyle(renderVariant, theme);

  const layoutBase =
    layoutPref === "split"
      ? "text-left md:text-left"
      : "text-center md:text-center";

  const presetKey: string =
    (theme as any).fontPreset ??
    (design as any).fontPreset ??
    (design as any).designAnswers?.fontPreset ??
    "cleanJa";

  const fontClass = fontFamilyFromPreset(presetKey);

  const DEBUG = process.env.NODE_ENV !== "production";
  if (DEBUG) {
    console.log("[Renderer] theme.fontPreset:", (theme as any).fontPreset);
    console.log("[Renderer] presetKey:", presetKey);
    console.log("[Renderer] fontClass:", fontClass);
    console.log("[Renderer] layoutPref:", layoutPref);
    console.log(
      "[Renderer] layoutDecision.sectionOrder:",
      layoutDecision?.sectionOrder
    );
    console.log("[Renderer] layoutDecision.layoutType:", layoutDecision?.layoutType);
    console.log("[Renderer] sectionOrder:", sectionOrder);
    console.log("[Renderer] sectionOrderOverride:", sectionOrderOverride);
    console.log(
      "[Renderer] overallStrength:",
      (renderVariant as any).overallStrength
    );
  }

  // ✅ 共通関数で背景を合成（プレビューと一致させる前提）
  const backgroundStyle = buildBackgroundStyle(theme, renderVariant);

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[BG] inlineStyle.backgroundImage:",
      (backgroundStyle as any).backgroundImage
    );
  }

  if (DEBUG) {
    console.log("[BG] theme.backgroundPattern:", (theme as any).backgroundPattern);
    console.log("[BG] theme.patternLayers:", (theme as any).patternLayers);
    console.log("[BG] theme.textureLayers:", (theme as any).textureLayers);
    console.log("[BG] theme.bgGradient:", (theme as any).bgGradient);
    console.log("[BG] theme.patternColor:", (theme as any).patternColor);
    console.log("[BG] computed backgroundStyle:", backgroundStyle);
  }

  return (
    <div
      className={`ai-portfolio-root min-h-[60vh] border ${layoutBase} ${fontClass}`}
      style={{
        borderColor: theme.colorPrimary,
        borderRadius: v.radius,
        boxShadow: v.shadow,
        ...backgroundStyle,
      }}
      data-layout-pref={layoutPref}
      data-layout-type={layoutDecision?.layoutType}
    >
      <div
        className="rounded-t-xl px-6 py-4 text-xs font-medium tracking-widest text-gray-500"
        style={{ background: theme.colorBG }}
      >
        PORTFOLIO
      </div>

      <div className="space-y-10 px-6 pb-10 pt-6">
        {finalOrderTypes.map((type) => {
          const data = findSection(type);
          if (!data) return null;

          switch (type) {
            case "hero":
              return (
                <AiPortfolioHeroSwitcher
                  key={type}
                  section={data}
                  theme={theme}
                  variant={renderVariant}
                />
              );

            case "about":
              return (
                <AiPortfolioAboutSimple
                  key={type}
                  section={data}
                  theme={theme}
                  variant={renderVariant}
                />
              );

            case "works":
              return (
                <AiPortfolioGalleryGrid
                  key={type}
                  section={data}
                  theme={theme}
                  variant={renderVariant}
                />
              );

            case "services":
              return (
                <AiPortfolioServices
                  key={type}
                  section={data}
                  theme={theme}
                  variant={renderVariant}
                />
              );

            case "skills":
              return (
                <AiPortfolioSkills
                  key={type}
                  section={data}
                  theme={theme}
                  variant={renderVariant}
                />
              );

            case "contact":
              return (
                <AiPortfolioContact
                  key={type}
                  section={data}
                  theme={theme}
                  variant={renderVariant}
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
