// src/components/aiPortfolio/sections/aiPortfolioServices.tsx
// （セクション見出しを Contact / CTA と統一＋価格フォーマット対応）

import React, { CSSProperties } from "react";
import type { Content, Design } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

// ラベル文言
function getLabel(languageMode?: string) {
  switch (languageMode) {
    case "ja":
      return "サービス内容";
    case "jaEn":
      return "SERVICES / サービス内容";
    case "en":
    default:
      return "SERVICES";
  }
}

// 価格表示を「20,000円〜」形式に揃える
function formatPrice(raw: any): string | null {
  if (raw === undefined || raw === null) return null;

  // 数字部分だけ抽出（「円」「¥」「,」などは無視）
  const num = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return null;

  const formatted = num.toLocaleString("ja-JP");
  return `${formatted}円〜`;
}

export const AiPortfolioServices: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  const rawSection = section as any;

  const items: any[] = rawSection.items ?? [];
  const headings: string[] | undefined = rawSection.headings;
  const paragraphs: string[] | undefined = rawSection.paragraphs;

  const headingText = headings?.[0] ?? getLabel(theme.languageMode);

  const v = applyVariantStyle(variant, theme);
  const alignClass =
    variant.layout === "split" ? "text-left" : "text-center";

  const isDarkWorld =
    variant.worldview === "dark" ||
    variant.worldview === "cyber" ||
    variant.worldview === "luxury";

  const sectionHeadingColor = isDarkWorld
    ? "rgba(249,250,251,0.96)"
    : "rgba(31,41,55,0.8)";

  const paragraphColor = isDarkWorld
    ? "rgba(226,232,240,0.9)"
    : "rgba(55,65,81,0.9)";

  const cardTitleColor = isDarkWorld
    ? "rgba(248,250,252,0.98)"
    : "rgba(17,24,39,0.96)";

  const cardPriceColor = isDarkWorld
    ? "rgba(244,244,245,0.95)"
    : "rgba(30,64,175,0.95)";

  const cardDescColor = paragraphColor;

  const accent =
    v.accentColor || theme.colorAccent || theme.colorPrimary;

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const cardBaseStyle: CSSProperties = {
    borderColor: v.borderColor,
    borderRadius: v.radius,
    boxShadow: v.shadow,
    background: surfaceBG,
    color: paragraphColor,
  };

  let cardClass = "border transition-shadow";
  if (variant.surface === "glass") {
    cardClass += " backdrop-blur-md";
  }
  if (variant.surface === "dark" || variant.surface === "neon") {
    cardClass += " text-gray-100";
  }

  return (
    <section
      className={`px-3 pb-6 md:px-4 md:pb-8 ${alignClass}`}
      aria-label="Services"
    >
      {/* ======= セクション見出し（WORKS / Contact / CTA と統一） ======= */}
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
              {headingText.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* ======= 説明テキスト ======= */}
      {paragraphs?.length ? (
        <div
          className="mt-2 space-y-1 text-xs"
          style={{ color: paragraphColor }}
        >
          {paragraphs.map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      {/* ======= カード群 ======= */}
      {items.length === 0 ? (
        <p className="mt-3 text-xs" style={{ color: v.mutedText }}>
          現在、公開中のサービスはありません。
        </p>
      ) : (
        <div className="mt-4 flex justify-center">
          {/* 中央寄せ用のコンテナ（幅を絞って mx-auto） */}
          <div className="flex w-full max-w-3xl flex-wrap justify-center gap-4 md:gap-5">
            {items.map((item: any, i: number) => {
              const title = item.title ?? item.name ?? `サービス ${i + 1}`;
              const price = item.price ?? item.priceHint;
              const desc = item.description ?? item.desc;
              const formattedPrice = formatPrice(price);

              return (
                <div
                  key={i}
                  className={
                    cardClass +
                    " w-full max-w-xs rounded-xl px-3 py-3 text-sm sm:w-auto sm:max-w-sm"
                  }
                  style={cardBaseStyle}
                >
                  <p
                    className="font-semibold"
                    style={{ color: cardTitleColor }}
                  >
                    {title}
                  </p>

                  {formattedPrice && (
                    <p
                      className="mt-1 text-xs font-semibold"
                      style={{ color: cardPriceColor }}
                    >
                      {formattedPrice}
                    </p>
                  )}

                  {desc && (
                    <p
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: cardDescColor }}
                    >
                      {desc}
                    </p>
                  )}

                  <div
                    className="mt-2 h-[2px] w-10 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}


    </section>
  );
};
