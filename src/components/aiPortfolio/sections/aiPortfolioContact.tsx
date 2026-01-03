//src/components/aiPortfolio/sections/aiPortfolioContact.tsx
"use client";

import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";
import { AiPortfolioSectionPillHeader } from "./_shared/AiPortfolioSectionPillHeader";

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

export const AiPortfolioContact: React.FC<Props> = ({ section, theme, variant }) => {
  const v = applyVariantStyle(variant, theme);
  const raw = section as any;

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
    { label: "pixiv", value: (social.pixiv as string | undefined) || (raw.pixivUrl as string | undefined) || (raw.pixiv as string | undefined) },
    { label: "Skeb", value: (social.skeb as string | undefined) || (raw.skebUrl as string | undefined) || (raw.skeb as string | undefined) },
    { label: "BOOTH", value: (social.booth as string | undefined) || (raw.boothUrl as string | undefined) || (raw.booth as string | undefined) },
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

  const pills: LinkPill[] = [];
  if (email) pills.push({ label: email, href: `mailto:${email}` });

  for (const link of mergedLinks) {
    if (!link?.href || !link?.label) continue;
    if (email && link.href === `mailto:${email}`) continue;
    pills.push(link);
  }

  const isDarkWorld = v.isDark;
  const accent = v.accentColor || theme.colorAccent || theme.colorPrimary;

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const headingColor = isDarkWorld ? "#F9FAFB" : "#111827";
  const bodyColor = isDarkWorld ? "rgba(226,232,240,0.9)" : "rgba(55,65,81,0.9)";

  const sectionLabel = (heading || "Contact").toUpperCase();

  return (
    <section className="px-3 pb-6 md:px-4 md:pb-8" aria-label="Contact">
      <div className="w-full">
        <AiPortfolioSectionPillHeader
          label={sectionLabel}
          theme={theme}
          variant={variant}
          className="mb-3"
        />

        <div
          className="flex flex-col gap-4 border px-5 py-5 md:px-7 md:py-6"
          style={{
            borderRadius: v.radius,
            borderColor: v.borderColor,
            boxShadow: v.shadow,
            background: surfaceBG,
            color: headingColor,
          }}
        >
          <div className="space-y-2 text-left">
            {body && (
              <p className="text-xs leading-relaxed md:text-sm" style={{ color: bodyColor }}>
                {body}
              </p>
            )}

            {pills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {pills.map((pill, i) => (
                  <a
                    key={i}
                    href={pill.href}
                    target={pill.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={pill.href.startsWith("mailto:") ? undefined : "noreferrer"}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium md:text-xs"
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${v.borderColor}`,
                      background: isDarkWorld ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.96)",
                      color: isDarkWorld ? "#E5E7EB" : "#111827",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.6) inset",
                    }}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                    <span>{pill.label}</span>
                  </a>
                ))}
              </div>
            )}

            {pills.length === 0 && (
              <p className="text-[11px] text-slate-500">
                連絡先リンクが未設定です（フォームでSNS/Websiteを入力するとここに表示されます）。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
