// src/components/aiPortfolio/sections/aiPortfolioContact.tsx
import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

export const AiPortfolioContact: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  const v = applyVariantStyle(variant, theme);

  const raw = section as any;

  const [heading] = section.headings ?? [];
  const [body] = section.paragraphs ?? [];

  // ----------------------------------------
  // 連絡先まわり（メール + SNS）
  // ----------------------------------------
  const email =
    (raw.email as string | undefined) ||
    (raw.contactEmail as string | undefined);

  // すでに 'links' があれば最優先で使う
  const linksFromSection: { label: string; href: string }[] =
    (raw.links as any[]) ?? [];

  // フォームが「個別の SNS 項目」を持っている場合の拾い上げ
  // （実際のキー名はかなりカバー広めにしておく）
  const snsCandidates: { key: string; label: string }[] = [
    { key: "xUrl", label: "X" },
    { key: "twitterUrl", label: "X" },
    { key: "twitter", label: "X" },
    { key: "instagramUrl", label: "Instagram" },
    { key: "instagram", label: "Instagram" },
    { key: "pixivUrl", label: "pixiv" },
    { key: "pixiv", label: "pixiv" },
    { key: "skebUrl", label: "Skeb" },
    { key: "skeb", label: "Skeb" },
    { key: "boothUrl", label: "BOOTH" },
    { key: "booth", label: "BOOTH" },
    { key: "websiteUrl", label: "Website" },
    { key: "siteUrl", label: "Website" },
    { key: "portfolioUrl", label: "Portfolio" },
  ];

  const snsLinksFromFields: { label: string; href: string }[] = [];
  for (const { key, label } of snsCandidates) {
    const value = raw[key] as string | undefined;
    if (!value) continue;

    // すでに links[] に同じ href があれば二重登録しない
    const alreadyInLinks = linksFromSection.some(
      (l) => l.href === value || l.href === `https://${value}`,
    );
    if (alreadyInLinks) continue;

    snsLinksFromFields.push({ label, href: value });
  }

  // links[] と SNS フィールドをマージ
  const mergedLinks: { label: string; href: string }[] = [
    ...linksFromSection,
    ...snsLinksFromFields,
  ];

  // pill 用にまとめる（メールアドレスもここに含める）
  const pills: { label: string; href: string }[] = [];

  if (email) {
    pills.push({ label: email, href: `mailto:${email}` });
  }

  for (const link of mergedLinks) {
    if (!link?.href || !link?.label) continue;
    // mailto が links 側にも入っていた場合は重複除去
    if (email && link.href === `mailto:${email}`) continue;
    pills.push({ label: link.label, href: link.href });
  }

  const cta = section.cta;

  const isDarkWorld =
    variant.worldview === "dark" ||
    variant.worldview === "cyber" ||
    variant.worldview === "luxury";

  const accent =
    v.accentColor || theme.colorAccent || theme.colorPrimary;

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const headingColor = isDarkWorld ? "#F9FAFB" : "#111827";

  const bodyColor = isDarkWorld
    ? "rgba(226,232,240,0.9)"
    : "rgba(55,65,81,0.9)";

  // セクション見出し用ラベル（カプセルだけで表示）
  const sectionLabel = (heading || "Contact").toUpperCase();

  return (
    <section className="px-3 pb-6 md:px-4 md:pb-8" aria-label="Contact">
      {/* ======= セクション見出し（WORKSと統一） ======= */}
      <div className="mb-3 flex items-center justify-between">
        <div
          className={`flex flex-1 ${
            variant.layout === "split" ? "justify-start" : "justify-center"
          }`}
        >
          <div className="inline-flex items-center gap-2">
            <span
              className="hidden h-px w-6 md:block"
              style={{
                backgroundColor: theme.colorAccent || theme.colorPrimary,
              }}
            />
            <div
              className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.30em] md:text-xs"
              style={{
                backgroundColor: isDarkWorld
                  ? "rgba(15,23,42,0.75)"
                  : "rgba(255,255,255,0.9)",
                color: isDarkWorld
                  ? "rgba(249,250,251,0.96)"
                  : "rgba(15,23,42,0.9)",
                borderColor: isDarkWorld
                  ? "rgba(148,163,184,0.7)"
                  : "rgba(148,163,184,0.5)",
              }}
            >
              {sectionLabel}
            </div>
          </div>
        </div>
      </div>

      {/* ======= 本体カード：説明＋pill＋CTA ======= */}
      <div
        className="flex flex-col gap-4 border px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7 md:py-6"
        style={{
          borderRadius: v.radius,
          borderColor: v.borderColor,
          boxShadow: v.shadow,
          background: surfaceBG,
          color: headingColor,
        }}
      >
        {/* 左側：説明＋pillリンク */}
        <div className="space-y-2 text-left md:max-w-lg">
          {body && (
            <p
              className="text-xs leading-relaxed md:text-sm"
              style={{ color: bodyColor }}
            >
              {body}
            </p>
          )}

          {pills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {pills.map((pill, i) => (
                <a
                  key={i}
                  href={pill.href}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium md:text-xs"
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${v.borderColor}`,
                    background: isDarkWorld
                      ? "rgba(15,23,42,0.9)"
                      : "rgba(255,255,255,0.96)",
                    color: isDarkWorld ? "#E5E7EB" : "#111827",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.6) inset",
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: accent }}
                  />
                  <span>{pill.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 右側：メイン CTA ボタン（1つだけ） */}
        {cta && cta.label && cta.href && (
          <div className="flex justify-start md:justify-end">
            <a
              href={cta.href}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold md:text-sm"
              style={{
                borderRadius: 999,
                border: `1px solid ${accent}`,
                background: isDarkWorld
                  ? "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.98))"
                  : "linear-gradient(135deg, #ffffff, rgba(255,255,255,0.94))",
                color: isDarkWorld ? "#E5E7EB" : accent,
                boxShadow: v.shadow,
              }}
            >
              {cta.label}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};
