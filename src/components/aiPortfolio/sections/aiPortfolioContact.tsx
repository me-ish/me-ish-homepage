// src/components/aiPortfolio/sections/aiPortfolioContact.tsx
// ============================================
// Contact セクション（販売レベル改修版）
// ============================================

"use client";

import React, { useMemo } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";
import { AiPortfolioSectionPillHeader } from "./_shared/AiPortfolioSectionPillHeader";
import { SectionBackground } from "./_shared/SectionBackground";
import {
  SPACING,
  TYPOGRAPHY,
  TRANSITION,
  getWorldviewOverride,
} from "@/lib/aiPortfolio/aiPortfolio.designSystem";

import {
  Mail,
  Globe,
  Link as LinkIcon,
  Instagram,
  Twitter,
  Brush,
  ShoppingBag,
  PenTool,
  ExternalLink,
} from "lucide-react";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

type LinkPill = { label: string; href: string };

function isProbablyUrl(s: string) {
  return /^https?:\/\//i.test(s) || /^mailto:/i.test(s);
}

function withHttpsIfNeeded(s: string) {
  if (!s) return s;
  if (isProbablyUrl(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  return `https://${s}`;
}

function cleanHandle(s: string) {
  return s.trim().replace(/^@/, "");
}

function buildSnsUrl(kind: "x" | "instagram" | "behance", rawValue: string) {
  const v = rawValue.trim();
  if (!v) return null;
  if (isProbablyUrl(v)) return v;
  if (v.includes("/")) return withHttpsIfNeeded(v);

  const handle = cleanHandle(v);
  if (!handle) return null;

  switch (kind) {
    case "x":
      return `https://x.com/${handle}`;
    case "instagram":
      return `https://www.instagram.com/${handle}`;
    case "behance":
      return `https://www.behance.net/${handle}`;
  }
}

function normalizeLink(label: string, hrefRaw: string): LinkPill | null {
  const href = hrefRaw?.trim();
  if (!href) return null;

  if (/^mailto:/i.test(href)) return { label, href };

  if (label === "X") {
    const u = buildSnsUrl("x", href);
    return u ? { label, href: u } : null;
  }
  if (label === "Instagram") {
    const u = buildSnsUrl("instagram", href);
    return u ? { label, href: u } : null;
  }
  if (label === "Behance") {
    const u = buildSnsUrl("behance", href);
    return u ? { label, href: u } : null;
  }

  return { label, href: withHttpsIfNeeded(href) };
}

// 背景は共通コンポーネント（SectionBackground）に委譲

type ContactItem = {
  label: string;
  href: string;
  kind:
    | "email"
    | "x"
    | "instagram"
    | "behance"
    | "pixiv"
    | "skeb"
    | "booth"
    | "website"
    | "link";
  displayValue?: string;
};

function detectKind(label: string, href: string): ContactItem["kind"] {
  const L = (label || "").toLowerCase();
  if (href.startsWith("mailto:")) return "email";
  if (L === "x" || href.includes("x.com") || href.includes("twitter.com")) return "x";
  if (L.includes("instagram") || href.includes("instagram.com")) return "instagram";
  if (L.includes("behance") || href.includes("behance.net")) return "behance";
  if (L.includes("pixiv") || href.includes("pixiv")) return "pixiv";
  if (L.includes("skeb") || href.includes("skeb")) return "skeb";
  if (L.includes("booth") || href.includes("booth.pm")) return "booth";
  if (L.includes("website") || L.includes("site") || L.includes("portfolio")) return "website";
  return "link";
}

function pickIcon(kind: ContactItem["kind"]) {
  switch (kind) {
    case "email":
      return Mail;
    case "x":
      return Twitter;
    case "instagram":
      return Instagram;
    case "behance":
      return Brush;
    case "pixiv":
      return PenTool;
    case "skeb":
      return PenTool;
    case "booth":
      return ShoppingBag;
    case "website":
      return Globe;
    default:
      return LinkIcon;
  }
}

function shortValueFromHref(href: string) {
  try {
    if (href.startsWith("mailto:")) return href.replace(/^mailto:/i, "");
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    if (path && path !== "/") return `${host}${path}`;
    return host;
  } catch {
    return href;
  }
}

export const AiPortfolioContact: React.FC<Props> = ({ section, theme, variant }) => {
  const raw = section as any;

  // ✅ sectionTheme（セクション別背景）を拾って、そのセクション用の theme を作る
  const sectionType = (raw.type ?? "contact") as string;
  const st = (theme as any)?.sectionTheme?.[sectionType] as
    | {
        bgGradient?: string;
        patternLayers?: string[];
        textureLayers?: string[];
        bgStyle?: any;
      }
    | undefined;

  const themeForSection = st
    ? ({
        ...theme,
        bgGradient: st.bgGradient ?? (theme as any).bgGradient,
        patternLayers: st.patternLayers ?? (theme as any).patternLayers,
        textureLayers: st.textureLayers ?? (theme as any).textureLayers,
        bgStyle: st.bgStyle ?? (theme as any).bgStyle,
      } as any)
    : theme;

  const v = applyVariantStyle(variant, themeForSection);

  const [heading] = section.headings ?? [];
  const [body] = section.paragraphs ?? [];

  // ----------------------------------------
  // 連絡先（メール）
  // ----------------------------------------
  const email =
    (raw.email as string | undefined) ||
    (raw.contactEmail as string | undefined) ||
    (raw?.social?.email as string | undefined);

  // ----------------------------------------
  // links[] があれば最優先（旧互換）
  // ----------------------------------------
  const linksFromSection: { label: string; href: string }[] = (raw.links as any[]) ?? [];

  // ----------------------------------------
  // フォーム由来のSNS（socialネスト + 直下キー）を拾う
  // ----------------------------------------
  const social = (raw.social ?? {}) as Record<string, unknown>;

  const snsCandidates: { value?: string; label: string }[] = [
    {
      label: "X",
      value:
        (social.twitter as string | undefined) ||
        (social.x as string | undefined) ||
        (raw.xUrl as string | undefined) ||
        (raw.twitterUrl as string | undefined) ||
        (raw.twitter as string | undefined) ||
        (raw.tw as string | undefined),
    },
    {
      label: "Instagram",
      value:
        (social.instagram as string | undefined) ||
        (raw.instagramUrl as string | undefined) ||
        (raw.instagram as string | undefined) ||
        (raw.ig as string | undefined),
    },
    {
      label: "Behance",
      value:
        (social.behance as string | undefined) ||
        (raw.behanceUrl as string | undefined) ||
        (raw.behance as string | undefined) ||
        (raw.be as string | undefined),
    },
    {
      label: "pixiv",
      value:
        (social.pixiv as string | undefined) ||
        (raw.pixivUrl as string | undefined) ||
        (raw.pixiv as string | undefined),
    },
    {
      label: "Skeb",
      value:
        (social.skeb as string | undefined) ||
        (raw.skebUrl as string | undefined) ||
        (raw.skeb as string | undefined),
    },
    {
      label: "BOOTH",
      value:
        (social.booth as string | undefined) ||
        (raw.boothUrl as string | undefined) ||
        (raw.booth as string | undefined),
    },
    {
      label: "Website",
      value:
        (social.website as string | undefined) ||
        (raw.websiteUrl as string | undefined) ||
        (raw.siteUrl as string | undefined) ||
        (raw.portfolioUrl as string | undefined) ||
        (raw.site as string | undefined),
    },
  ];

  // links[] と SNS フィールドをマージ（重複除去しつつ、URLを正規化）
  const mergedLinks: LinkPill[] = [];
  for (const l of linksFromSection) {
    if (!l?.label || !l?.href) continue;
    const pill = normalizeLink(l.label, l.href);
    if (!pill) continue;
    const key = `${pill.label}__${pill.href}`;
    const exists = mergedLinks.some((x) => `${x.label}__${x.href}` === key);
    if (!exists) mergedLinks.push(pill);
  }
  for (const c of snsCandidates) {
    if (!c.value) continue;
    const pill = normalizeLink(c.label, c.value);
    if (!pill) continue;
    const exists = mergedLinks.some((x) => x.href === pill.href);
    if (!exists) mergedLinks.push(pill);
  }

  const items: ContactItem[] = useMemo(() => {
    const out: ContactItem[] = [];

    if (email) {
      out.push({
        label: "Email",
        href: `mailto:${email}`,
        kind: "email",
        displayValue: email,
      });
    }

    for (const link of mergedLinks) {
      if (!link?.href || !link?.label) continue;
      if (email && link.href === `mailto:${email}`) continue;

      const kind = detectKind(link.label, link.href);
      out.push({
        label: link.label,
        href: link.href,
        kind,
        displayValue: shortValueFromHref(link.href),
      });
    }

    // Emailは先頭、残りはラベル順（見た目安定）
    const head = out.find((x) => x.kind === "email");
    const rest = out.filter((x) => x.kind !== "email");
    const sortedRest = rest.sort((a, b) => (a.label || "").localeCompare(b.label || "", "ja"));
    return head ? [head, ...sortedRest] : sortedRest;
  }, [email, mergedLinks]);

  const isDarkWorld = v.isDark;

  // ✅ accentUser（好きな色）に統一
  const accentUser = v.accentColor || theme.colorAccent || theme.colorPrimary;

  const headingColor = isDarkWorld ? "#F9FAFB" : "#111827";
  const bodyColor = isDarkWorld ? "rgba(226,232,240,0.9)" : "rgba(55,65,81,0.9)";
  const metaColor = isDarkWorld ? "rgba(226,232,240,0.72)" : "rgba(55,65,81,0.72)";

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  // 世界観オーバーライド
  const worldview = String((variant as any)?.worldview ?? "business");
  const override = getWorldviewOverride(worldview);
  const isNeon = override.decorations.neonBorder;
  const isGold = override.decorations.goldAccent;

  // overallStrength
  const overallStrength = useMemo(() => {
    const rawStrength = (variant as any)?.overallStrength;
    const n = typeof rawStrength === "string" ? Number(rawStrength) : Number(rawStrength);
    return Number.isFinite(n) ? n : 0;
  }, [variant]);

  const sectionLabel = (heading || "Contact").toUpperCase();

  return (
    <section
      className={`relative overflow-hidden ${SPACING.section.paddingY} ${SPACING.section.paddingX}`}
      aria-label="Contact"
    >
      {/* 背景レイヤー */}
      <SectionBackground
        theme={themeForSection}
        variant={variant}
        sectionType={sectionType}
        isDark={isDarkWorld}
        accentColor={accentUser}
        overallStrength={overallStrength}
      />

      <div className={`relative z-10 mx-auto w-full ${SPACING.maxWidth.section}`}>
        <AiPortfolioSectionPillHeader
          label={sectionLabel}
          theme={theme}
          variant={variant}
          className="mb-3"
        />

        {/* ✅ Panel */}
        <div
          className="border px-5 py-5 md:px-7 md:py-6"
          style={{
            borderRadius: v.radius,
            borderColor: v.borderColor,
            boxShadow: v.shadow,
            background: surfaceBG,
            color: headingColor,
          }}
        >
          {/* 説明 */}
          {body ? (
            <p className="text-xs leading-relaxed md:text-sm" style={{ color: bodyColor }}>
              {body}
            </p>
          ) : null}

          {/* メタ（薄さ対策で“情報の箱感”を足す） */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] md:text-xs" style={{ color: metaColor }}>
              {items.length > 0 ? (
                <>
                  Available links:{" "}
                  <span style={{ color: headingColor, fontWeight: 600 }}>{items.length}</span>
                </>
              ) : (
                "No contact links set"
              )}
            </div>

            {/* ✅ 右上バー：accentUser（好きな色） */}
            <span
              className="h-1.5 w-10 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accentUser} 0%, transparent 100%)`,
                opacity: isDarkWorld ? 0.55 : 0.7,
              }}
              aria-hidden
            />
          </div>

          {/* 区切り */}
          <div
            className="my-4 h-px w-full"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${v.borderColor} 18%, ${v.borderColor} 82%, transparent 100%)`,
              opacity: isDarkWorld ? 0.35 : 0.55,
            }}
            aria-hidden
          />

          {/* ✅ 連絡先：ピルではなく “カード/行” */}
          {items.length > 0 ? (
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((it, i) => {
                const Icon = pickIcon(it.kind);
                const isMail = it.href.startsWith("mailto:");
                const rightLabel = isMail ? "Mail" : "Open";

                return (
                  <a
                    key={`${it.href}-${i}`}
                    href={it.href}
                    target={isMail ? undefined : "_blank"}
                    rel={isMail ? undefined : "noreferrer"}
                    className={[
                      "group",
                      "flex items-center gap-3",
                      "rounded-2xl border px-4 py-3",
                      "transition-transform hover:-translate-y-[1px]",
                    ].join(" ")}
                    style={{
                      borderColor: v.borderColor,
                      background: isDarkWorld ? "rgba(2,6,23,0.18)" : "rgba(255,255,255,0.72)",
                    }}
                  >
                    {/* 左：アイコン */}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl border"
                      style={{
                        borderColor: isDarkWorld
                          ? "rgba(148,163,184,0.55)"
                          : "rgba(203,213,225,0.9)",
                        background: isDarkWorld
                          ? "rgba(15,23,42,0.35)"
                          : "rgba(248,250,252,0.85)",
                      }}
                      aria-hidden
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: isDarkWorld ? "rgba(226,232,240,0.92)" : accentUser }}
                      />
                    </div>

                    {/* 中央：テキスト */}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold" style={{ color: headingColor }}>
                        {it.label}
                      </div>
                      <div className="truncate text-[11px] md:text-xs" style={{ color: metaColor }}>
                        {it.displayValue || shortValueFromHref(it.href)}
                      </div>
                    </div>

                    {/* 右：補助（ラベル＋アイコン） */}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: metaColor }}
                      >
                        {rightLabel}
                      </span>
                      <ExternalLink
                        className="h-4 w-4 transition-opacity"
                        style={{ color: metaColor, opacity: 0.85 }}
                        aria-hidden
                      />
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div
              className="rounded-2xl border px-5 py-6 text-sm"
              style={{
                borderColor: v.borderColor,
                background: isDarkWorld ? "rgba(2,6,23,0.14)" : "rgba(255,255,255,0.66)",
                color: metaColor,
              }}
            >
              <div className="font-medium" style={{ color: headingColor }}>
                連絡先リンクが未設定です
              </div>
              <div className="mt-1 text-[11px] leading-relaxed md:text-xs">
                フォームで Email / SNS / Website を入力すると、ここに表示されます。
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
