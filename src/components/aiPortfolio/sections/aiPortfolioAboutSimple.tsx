// src/components/aiPortfolio/sections/aiPortfolioAboutSimple.tsx
"use client";

import React, { useMemo } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";
import { AiPortfolioSectionPillHeader } from "./_shared/AiPortfolioSectionPillHeader";
import { sectionAccentColor } from "@/lib/aiPortfolio/aiPortfolio.sectionAccent";
import { buildSectionBackgroundStyle } from "@/lib/aiPortfolio/aiPortfolio.background";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

type LanguageMode = "ja" | "en" | "jaEn";
type AboutLayout = "center" | "splitTextLeft" | "splitTextRight" | "stacked";

function getDefaultHeading(languageMode: LanguageMode) {
  switch (languageMode) {
    case "ja":
      return "自己紹介";
    case "jaEn":
      return "ABOUT / 自己紹介";
    case "en":
    default:
      return "ABOUT";
  }
}

function getDefaultNameLabel(languageMode: LanguageMode) {
  switch (languageMode) {
    case "ja":
      return "作家名";
    case "jaEn":
      return "NAME / 作家名";
    case "en":
    default:
      return "NAME";
  }
}

function getDefaultRoleLabel(languageMode: LanguageMode) {
  switch (languageMode) {
    case "ja":
      return "肩書き";
    case "jaEn":
      return "ROLE / 肩書き";
    case "en":
    default:
      return "ROLE";
  }
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

function getInitials(name: string) {
  const n = (name || "").trim();
  if (!n) return "PF";
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (/^[a-zA-Z]+$/.test(n)) return n.slice(0, 2).toUpperCase();
  return n.slice(0, 2);
}

/** worldview -> Aboutレイアウト */
function aboutLayoutByWorldview(worldview?: string): AboutLayout {
  switch (worldview) {
    case "minimal":
    case "modern":
    case "business":
      return "splitTextLeft";

    case "cute":
    case "pop":
      return "splitTextLeft";

    case "luxury":
    case "retro":
      return "splitTextRight";

    case "dark":
    case "cyber":
      return "splitTextLeft";

    case "natural":
      return "splitTextLeft";

    default:
      return "splitTextLeft";
  }
}

export const AiPortfolioAboutSimple: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  const v = applyVariantStyle(variant, theme);

  const languageMode = (theme.languageMode ?? "ja") as LanguageMode;

  // overallStrength は “背景の濃さ” など演出に使えるので残す
  const overallStrength = useMemo(() => {
    const raw = (variant as any)?.overallStrength;
    const n = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [variant]);

  const heading = section.headings?.[0] ?? getDefaultHeading(languageMode);

  // 規約：headings[1]=作家名 / headings[2]=肩書き
  const name = safeStr(section.headings?.[1]);
  const role = safeStr(section.headings?.[2]);

  const avatarUrl =
    safeStr((section as any).avatarUrl) ||
    safeStr((section as any).iconUrl) ||
    "";

  const paragraphs =
    section.paragraphs && section.paragraphs.length > 0
      ? section.paragraphs
      : ["自己紹介文がここに表示されます。"];

  const isDarkWorld = v.isDark;

  const textColor = isDarkWorld ? v.textColor ?? "#E5E7EB" : "#111827";
  const bodyColor = isDarkWorld
    ? "rgba(226,232,240,0.92)"
    : "rgba(55,65,81,0.90)";
  const muted = isDarkWorld
    ? "rgba(226,232,240,0.75)"
    : "rgba(107,114,128,0.85)";

  const accentBase = theme.colorAccent || theme.colorPrimary;
  const sectionType = (section as any)?.type ?? "about";
  const accent = sectionAccentColor(accentBase, sectionType);

  const baseLayout = aboutLayoutByWorldview((variant as any)?.worldview);
  const aboutLayout: AboutLayout =
    (safeStr((section as any)?.aboutLayout) as AboutLayout) || baseLayout;

  const cards = Array.isArray((section as any)?.cards)
    ? ((section as any).cards as any[])
    : [];
  const hasCards = cards.length > 0;

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const gridClass = useMemo(() => {
    if (aboutLayout === "center") return "grid gap-6 md:grid-cols-1";
    return "grid gap-10 md:grid-cols-2 md:gap-12 md:items-center";
  }, [aboutLayout]);

  const profileColOrder =
    aboutLayout === "splitTextLeft"
      ? "md:order-2"
      : aboutLayout === "splitTextRight"
        ? "md:order-1"
        : "md:order-none";

  const textColOrder =
    aboutLayout === "splitTextLeft"
      ? "md:order-1"
      : aboutLayout === "splitTextRight"
        ? "md:order-2"
        : "md:order-none";

  const profileWrapClass = useMemo(() => {
    if (aboutLayout === "center")
      return "flex flex-col items-center gap-3 text-center";
    if (aboutLayout === "splitTextRight") {
      return "flex items-center gap-4 md:flex-col md:items-start md:gap-3 md:text-left";
    }
    return "flex items-center gap-4 md:flex-col md:items-center md:gap-3 md:text-center";
  }, [aboutLayout]);

  const ProfileBlock = (
    <div className={profileWrapClass}>
      <div className="relative flex-shrink-0">
        <div
          className="h-20 w-20 overflow-hidden rounded-2xl border-2 shadow-sm md:h-32 md:w-32"
          style={{
            borderColor: "rgba(255,255,255,0.88)",
            background: avatarUrl ? "#f3f4f6" : accent,
            color: avatarUrl ? undefined : "#fff",
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name || "avatar"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold md:text-2xl">
              {getInitials(name)}
            </div>
          )}
        </div>

        <div
          className="pointer-events-none absolute -inset-6 rounded-3xl blur-2xl"
          style={{
            background: `radial-gradient(circle, ${accent} 0%, transparent 60%)`,
            opacity: isDarkWorld ? 0.18 : 0.14,
          }}
        />
      </div>

      <div className="min-w-0">
        {name ? (
          <div className="text-lg font-bold leading-tight md:text-xl">
            {name}
          </div>
        ) : (
          <div className="text-sm" style={{ color: muted }}>
            {getDefaultNameLabel(languageMode)}
          </div>
        )}

        {role ? (
          <div className="mt-1 text-sm font-medium" style={{ color: muted }}>
            {role}
          </div>
        ) : (
          <div className="mt-1 text-xs" style={{ color: muted }}>
            {getDefaultRoleLabel(languageMode)}
          </div>
        )}
      </div>
    </div>
  );

  const bodyAlignClass = aboutLayout === "center" ? "text-center" : "text-left";
  const bodyInsetClass = aboutLayout === "center" ? "" : "pl-2 md:pl-4";

  const BodyBlock = (
    <div
      className={[
        `space-y-3 ${bodyAlignClass} max-w-prose`,
        bodyInsetClass,
        "text-[15px] leading-[1.9] md:text-[16px]",
      ].join(" ")}
      style={{ color: bodyColor }}
    >
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );

  // ✅ About 背景（sectionThemeがあればそれを優先して合成）
  const aboutBg = useMemo(
    () => buildSectionBackgroundStyle(theme, variant, sectionType),
    [theme, variant, sectionType],
  );

  const bgOverlayOpacity = useMemo(() => {
    if (overallStrength <= 20) return isDarkWorld ? 0.55 : 0.72;
    if (overallStrength <= 60) return isDarkWorld ? 0.5 : 0.68;
    return isDarkWorld ? 0.46 : 0.64;
  }, [overallStrength, isDarkWorld]);

  // ✅ 背景アクセントは「強い強度のみ」
  // ✅ 40〜：アクセントON（グロー） / 70〜：プラスα（ただし minimal/business は抑制）
  const ACCENT_AT = 40;
  const PLUS_AT = 70;

  const worldview = String((variant as any)?.worldview ?? "");
  const isMinimalLike = worldview === "minimal" || worldview === "business";

  const useAccentBg = overallStrength >= ACCENT_AT;
  const usePlus = overallStrength >= PLUS_AT && !isMinimalLike;

  const SectionBackground = (
    <div
      className="pointer-events-none absolute inset-x-0 -top-10 -bottom-14 z-0 md:-top-14 md:-bottom-20"
      style={aboutBg}
    >
      {/* 1) 可読性 overlay（フラットの土台） */}
      <div
        className="absolute inset-0"
        style={{
          background: isDarkWorld ? "rgba(2,6,23,0.72)" : "rgba(255,255,255,0.78)",
          opacity: bgOverlayOpacity,
        }}
      />

      {/* 2) 40〜：アクセントの薄いグロー */}
      {useAccentBg ? (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 20% 10%, ${accent} 0%, transparent 48%)`,
            opacity: isDarkWorld ? 0.14 : 0.1,
          }}
        />
      ) : null}

      {/* 3) 70〜：プラスα（minimal/business は基本オフ） */}
      {usePlus ? (
        <>
          {/* A: セカンドグロー（逆側に薄く） */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 100% 100%, ${accent} 0%, transparent 55%)`,
              opacity: isDarkWorld ? 0.1 : 0.07,
            }}
          />

          {/* B: エッジハイライト（“質感”だけ足す） */}
          <div
            className="absolute inset-0"
            style={{
              background: isDarkWorld
                ? "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 30%)"
                : "linear-gradient(180deg, rgba(15,23,42,0.06) 0%, transparent 28%)",
              opacity: 0.55,
            }}
          />
        </>
      ) : null}
    </div>
  );

  const CardsBlock = hasCards ? (
    <div className="pt-4">
      <div className="md:hidden">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {cards.map((c, i) => {
            const title = safeStr(c?.title);
            const body = safeStr(c?.body);
            if (!title && !body) return null;

            return (
              <div
                key={i}
                className="min-w-[78%] snap-start rounded-2xl border p-4"
                style={{
                  borderColor: v.borderColor,
                  background: isDarkWorld
                    ? "rgba(2,6,23,0.22)"
                    : "rgba(255,255,255,0.72)",
                }}
              >
                <div className="text-sm font-bold" style={{ color: textColor }}>
                  {title || "—"}
                </div>
                {body ? (
                  <div
                    className="mt-2 text-[13px] leading-[1.85]"
                    style={{ color: muted }}
                  >
                    {body}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {cards.map((c, i) => {
          const title = safeStr(c?.title);
          const body = safeStr(c?.body);
          if (!title && !body) return null;

          return (
            <div
              key={i}
              className="rounded-2xl border p-4"
              style={{
                borderColor: v.borderColor,
                background: isDarkWorld
                  ? "rgba(2,6,23,0.18)"
                  : "rgba(255,255,255,0.68)",
              }}
            >
              <div className="text-sm font-bold" style={{ color: textColor }}>
                {title || "—"}
              </div>
              {body ? (
                <div
                  className="mt-2 text-[13px] leading-[1.85]"
                  style={{ color: muted }}
                >
                  {body}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  const NoCardShell = (
    <div className="pt-2">
      {aboutLayout === "center" ? (
        <div className="space-y-4">
          {ProfileBlock}
          {BodyBlock}
        </div>
      ) : (
        <div className={gridClass}>
          <div className={`${textColOrder} space-y-4 md:pr-6`}>{BodyBlock}</div>
          <div className={`${profileColOrder} flex md:justify-center`}>
            {ProfileBlock}
          </div>
        </div>
      )}

      <div
        className="mt-8 h-px w-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${v.borderColor} 18%, ${v.borderColor} 82%, transparent 100%)`,
          opacity: isDarkWorld ? 0.45 : 0.7,
        }}
      />
    </div>
  );

  const CardShell = (
    <div
      className="border px-6 py-6 md:px-8 md:py-8"
      style={{
        borderColor: v.borderColor,
        borderRadius: v.radius,
        boxShadow: v.shadow,
        background: surfaceBG,
        color: textColor,
      }}
    >
      <div className={gridClass}>
        <div className={`${textColOrder} space-y-4 md:pr-6`}>
          {aboutLayout === "center" ? ProfileBlock : null}
          {BodyBlock}
          {CardsBlock}
        </div>

        {aboutLayout === "center" ? null : (
          <div className={`${profileColOrder} flex md:justify-center`}>
            {ProfileBlock}
          </div>
        )}
      </div>

      {!hasCards ? (
        <div
          className="mt-7 h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${v.borderColor} 18%, ${v.borderColor} 82%, transparent 100%)`,
            opacity: isDarkWorld ? 0.35 : 0.55,
          }}
        />
      ) : null}
    </div>
  );

  return (
    <section
      className="relative overflow-hidden px-3 pt-10 pb-24 md:px-4 md:pt-14 md:pb-16"
      aria-label="About"
    >
      {SectionBackground}

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <AiPortfolioSectionPillHeader
          label={heading}
          theme={theme}
          variant={variant}
          className="mb-3"
        />
        {hasCards ? CardShell : NoCardShell}
      </div>
    </section>
  );
};
