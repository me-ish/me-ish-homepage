// src/components/aiPortfolio/aiPortfolioPortfolioRenderer.tsx
// ============================================
// メインレンダラー（販売レベル改修版）
// ============================================
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import { VARIANTS, type VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { fontFamilyFromPreset } from "@/styles/aiPortfolioFonts";
import type { LayoutPref, SectionType, LayoutType } from "@/lib/aiPortfolio/aiPortfolio.layout";
import { SPACING, TYPOGRAPHY, TRANSITION } from "@/lib/aiPortfolio/aiPortfolio.designSystem";

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
function normalizeImageUrl(imageUrl?: string | null, storagePath?: string | null): string {
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
  if (typeof sec?.avatarUrl !== "undefined" || typeof sec?.avatarStoragePath !== "undefined") {
    const nextAvatar = normalizeImageUrl(sec?.avatarUrl, sec?.avatarStoragePath);
    sec = { ...sec, avatarUrl: nextAvatar };
  }

  // 2) セクション直下に imageUrl / storagePath があるケース（将来の拡張も兼ねる）
  if (typeof sec?.imageUrl !== "undefined" || typeof sec?.storagePath !== "undefined") {
    const nextUrl = normalizeImageUrl(sec?.imageUrl, sec?.storagePath);
    sec = { ...sec, imageUrl: nextUrl };
  }

  // 3) items 配列（works / hero / 任意のカード群）
  if (Array.isArray(sec?.items)) {
    const items = sec.items.map((it: any) => {
      // imageUrl / url / src どれに入ってても拾う
      const rawUrl = (it?.imageUrl ?? it?.url ?? it?.src) as string | undefined;

      // storagePath の別名も拾う（path で返す実装もある）
      const rawPath = (it?.storagePath ?? it?.path ?? it?.storage_path) as string | undefined;

      const nextUrl = normalizeImageUrl(rawUrl, rawPath);

      // ✅ imageUrl を必ず埋める（Gallery側が url/src を見てても壊れないように両方入れる）
      if (nextUrl) {
        return {
          ...it,
          imageUrl: nextUrl,
          url: it?.url ? nextUrl : it?.url,
          src: it?.src ? nextUrl : it?.src,
        };
      }
      return it;
    });

    sec = { ...sec, items };
  }

  return sec;
}

function sectionIdFromType(type: string) {
  // ナビ（About/Works...）と合わせる用：必要ならここでマッピング
  // 例: works -> works, contact -> contact
  return type;
}

type LanguageMode = "ja" | "en" | "jaEn";

function detectLanguageMode(design: any, content: any): LanguageMode {
  const v =
    content?.languageMode ??
    content?.lang ??
    design?.languageMode ??
    design?.designAnswers?.languageMode ??
    design?.designAnswers?.lang;

  if (v === "jaEn" || v === "ja-en" || v === "ja_en") return "jaEn";
  if (v === "ja" || v === "jp") return "ja";
  return "en";
}

function navLabel(type: string, mode: LanguageMode) {
  const labels: Record<LanguageMode, Record<string, string>> = {
    ja: {
      about: "自己紹介",
      works: "作品",
      services: "サービス",
      skills: "スキル",
      contact: "連絡",
    },
    jaEn: {
      about: "ABOUT / 自己紹介",
      works: "WORKS / 作品",
      services: "SERVICES / サービス",
      skills: "SKILLS / スキル",
      contact: "CONTACT / 連絡",
    },
    en: {
      about: "About",
      works: "Works",
      services: "Services",
      skills: "Skills",
      contact: "Contact",
    },
  };

  return labels[mode]?.[type] ?? type;
}

function toRgbaMaybe(input: string, alpha: number): string {
  const s = (input ?? "").trim();
  if (!s) return `rgba(255,255,255,${alpha})`;

  // rgba()/rgb()
  if (s.startsWith("rgba(")) {
    // alpha を差し替え（雑にやると壊れるので末尾だけ置換）
    const body = s.slice(5, -1).split(",").map((x) => x.trim());
    if (body.length === 4) {
      return `rgba(${body[0]}, ${body[1]}, ${body[2]}, ${alpha})`;
    }
    return s; // 想定外はそのまま
  }
  if (s.startsWith("rgb(")) {
    const body = s.slice(4, -1).split(",").map((x) => x.trim());
    if (body.length >= 3) {
      return `rgba(${body[0]}, ${body[1]}, ${body[2]}, ${alpha})`;
    }
    return s;
  }

  // hex #RGB / #RRGGBB
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full =
      hex.length === 3
        ? hex.split("").map((c) => c + c).join("")
        : hex.length === 6
        ? hex
        : null;

    if (full) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  // gradient 等はそのまま（alpha付与は不可）
  return s;
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
  const safeDesignSections = Array.isArray(design.sections) ? design.sections : [];

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
    layoutDecision?.layoutPref ?? (variant.layout === "split" ? "split" : "center");

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
    typeof overallStrengthRaw === "string" ? Number(overallStrengthRaw) : Number(overallStrengthRaw);

  // 以降、Renderer内で使うvariantは必ずこれに統一（layout + strength）
  // ※ VariantSpec に overallStrength が無い型定義でも壊さないため as any で注入
  const renderVariant: VariantSpec = {
    ...variant,
    layout: layoutPref === "split" ? "split" : "center",
    overallStrength: Number.isFinite(overallStrength) ? overallStrength : 0,
  } as any;

  // v / background も renderVariant で計算（分裂を防ぐ）
  const v = applyVariantStyle(renderVariant, theme);

  const layoutBase = layoutPref === "split" ? "text-left md:text-left" : "text-center md:text-center";

  const presetKey: string =
    (theme as any).fontPreset ??
    (design as any).fontPreset ??
    (design as any).designAnswers?.fontPreset ??
    "cleanJa";

  const fontClass = fontFamilyFromPreset(presetKey);

  const DEBUG = process.env.NODE_ENV !== "production";
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[Renderer] theme.fontPreset:", (theme as any).fontPreset);
    // eslint-disable-next-line no-console
    console.log("[Renderer] presetKey:", presetKey);
    // eslint-disable-next-line no-console
    console.log("[Renderer] fontClass:", fontClass);
    // eslint-disable-next-line no-console
    console.log("[Renderer] layoutPref:", layoutPref);
    // eslint-disable-next-line no-console
    console.log("[Renderer] layoutDecision.sectionOrder:", layoutDecision?.sectionOrder);
    // eslint-disable-next-line no-console
    console.log("[Renderer] layoutDecision.layoutType:", layoutDecision?.layoutType);
    // eslint-disable-next-line no-console
    console.log("[Renderer] sectionOrder:", sectionOrder);
    // eslint-disable-next-line no-console
    console.log("[Renderer] sectionOrderOverride:", sectionOrderOverride);
    // eslint-disable-next-line no-console
    console.log("[Renderer] overallStrength:", (renderVariant as any).overallStrength);
  }

  // ✅ 共通関数で背景を合成（プレビューと一致させる前提）
  const backgroundStyle = buildBackgroundStyle(theme, renderVariant);

    // ✅ V0型：スクロールでヘッダー表情を切り替え / SPは開閉メニュー
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    onScroll(); // 初期同期
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 表示しているセクションだけナビに出す（heroは除外）
  const languageMode = detectLanguageMode(design as any, normalizedContent as any);
  const allowedNav = useMemo(() => new Set(["about", "works", "services", "skills", "contact"]), []);
  const navTypes = useMemo(() => {
    return finalOrderTypes.filter((t) => allowedNav.has(t) && !!findSection(t));
  }, [finalOrderTypes, allowedNav]);

// ブランド表示：固定（Hero見出しと重複させない）
const brand = "Portfolio";

  // ヘッダー背景：スクロール前は透明、スクロール後は半透明＋blur＋shadow
  const headerBG = toRgbaMaybe(theme.colorBG ?? v.surfaceBG, 0.82);

  const scrollToId = useCallback((id: string) => {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }, []);

  const handleNavClick = useCallback(
    (id: string) => {
      scrollToId(id);
      setIsMobileMenuOpen(false);
    },
    [scrollToId]
  );

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[BG] theme.backgroundPattern:", (theme as any).backgroundPattern);
    // eslint-disable-next-line no-console
    console.log("[BG] theme.patternLayers:", (theme as any).patternLayers);
    // eslint-disable-next-line no-console
    console.log("[BG] theme.textureLayers:", (theme as any).textureLayers);
    // eslint-disable-next-line no-console
    console.log("[BG] theme.bgGradient:", (theme as any).bgGradient);
    // eslint-disable-next-line no-console
    console.log("[BG] theme.patternColor:", (theme as any).patternColor);
    // eslint-disable-next-line no-console
    console.log("[BG] computed backgroundStyle:", backgroundStyle);
  }

  /**
   * セクションラッパー
   * - セクション自体がpaddingを持つため、ここでは最小限に
   * - scroll-mt で固定ヘッダー対応
   */
  const sectionWrapperClass = `relative ${SPACING.scrollMargin}`;

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
      {/* ✅ Sticky Header Nav（V0式：スクロールで表情変化 / SPは開閉 / セクション可変） */}
      <div
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled ? "shadow-sm" : ""
        }`}
        style={{
          background: isScrolled ? headerBG : "transparent",
          backdropFilter: isScrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: isScrolled ? "blur(12px)" : "none",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          {/* 左：ブランド（トップへ） */}
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              history.replaceState(null, "", "#");
              setIsMobileMenuOpen(false);
            }}
            className="min-w-0 text-left"
            style={{ color: v.textColor }}
            aria-label="Back to top"
          >
            <div className="truncate text-[12px] font-semibold tracking-[0.24em] uppercase">
              {brand}
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Section navigation">
            {navTypes.map((t) => {
              const id = sectionIdFromType(t);
              const label = navLabel(t, languageMode);

              return (
                <button
                  key={t}
                  type="button"
                  className={`${TYPOGRAPHY.body.caption} font-medium tracking-wide ${TRANSITION.fast} hover:opacity-75`}
                  style={{ color: v.mutedText }}
                  onClick={() => handleNavClick(id)}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-lg px-2 py-2 text-[12px] font-semibold"
            style={{
              color: v.textColor,
              border: isScrolled ? `1px solid ${v.borderColor}` : "1px solid transparent",
              background: isScrolled ? toRgbaMaybe(theme.colorPrimary, 0.03) : "transparent",
            }}
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? "✕" : "≡"}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen ? (
          <div
            className="md:hidden px-6 pb-4"
            style={{
              background: isScrolled ? "transparent" : toRgbaMaybe(theme.colorBG ?? v.surfaceBG, 0.72),
            }}
          >
            <div
              className="rounded-xl p-3"
              style={{
                border: `1px solid ${v.borderColor}`,
                background: toRgbaMaybe(theme.colorBG ?? v.surfaceBG, 0.88),
              }}
            >
              <div className="flex flex-col gap-3">
                {navTypes.map((t) => {
                  const id = sectionIdFromType(t);
                  const label = navLabel(t, languageMode);

                  return (
                    <button
                      key={t}
                      type="button"
                      className="text-left text-[13px] font-medium"
                      style={{ color: v.mutedText }}
                      onClick={() => handleNavClick(id)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* セクション本体（余白は各セクションで管理） */}
      <div className="pb-8 md:pb-12">
        {finalOrderTypes.map((type) => {
          const data = findSection(type);
          if (!data) return null;

          const id = sectionIdFromType(type);

          switch (type) {
            case "hero":
              return (
<section key={type} id={id} className={sectionWrapperClass}>
  <AiPortfolioHeroSwitcher section={data} theme={theme} variant={renderVariant} />
</section>
              );

            case "about":
              return (
                <section key={type} id={id} className={sectionWrapperClass}>
                  <AiPortfolioAboutSimple section={data} theme={theme} variant={renderVariant} />
                </section>
              );

            case "works":
              return (
                <section key={type} id={id} className={sectionWrapperClass}>
                  <AiPortfolioGalleryGrid section={data} theme={theme} variant={renderVariant} />
                </section>
              );

            case "services":
              return (
                <section key={type} id={id} className={sectionWrapperClass}>
                  <AiPortfolioServices section={data} theme={theme} variant={renderVariant} />
                </section>
              );

            case "skills":
              return (
                <section key={type} id={id} className={sectionWrapperClass}>
                  <AiPortfolioSkills section={data} theme={theme} variant={renderVariant} />
                </section>
              );

            case "contact":
              return (
                <section key={type} id={id} className={sectionWrapperClass}>
                  <AiPortfolioContact section={data} theme={theme} variant={renderVariant} />
                </section>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
