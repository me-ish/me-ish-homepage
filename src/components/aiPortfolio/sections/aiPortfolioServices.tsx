// src/components/aiPortfolio/sections/aiPortfolioServices.tsx
// （セクション見出しを中央ズレ防止で統一＋価格フォーマット対応＋カード中央寄せ）
// ✅ B案：タイトル＆価格は中央 / 説明文だけ左寄せ（可読性と見た目の両立）

"use client";

import React, { CSSProperties } from "react";
import type { Content, Design } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

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

function formatPrice(raw: any): string | null {
  if (raw === undefined || raw === null) return null;

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
  const isSingle = items.length === 1;

  const headings: string[] | undefined = rawSection.headings;
  const paragraphs: string[] | undefined = rawSection.paragraphs;

  const headingText = headings?.[0] ?? getLabel(theme.languageMode);

  const v = applyVariantStyle(variant, theme);

  // テキストブロックの基本整列（split は左、center は中央）
  const alignClass = variant.layout === "split" ? "text-left" : "text-center";

  // dark 判定は applyVariantStyle に一本化
  const isDarkWorld = v.isDark;

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

  const accent = v.accentColor || theme.colorAccent || theme.colorPrimary;

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
  if (variant.surface === "glass") cardClass += " backdrop-blur-md";
  if (variant.surface === "dark" || variant.surface === "neon")
    cardClass += " text-gray-100";

  return (
    <section
      className={`px-3 pb-6 md:px-4 md:pb-8 ${alignClass}`}
      aria-label="Services"
    >
      {/* ★ 中央基準コンテナ（見出し/文章/カード/空状態の基準を統一） */}
      <div className="mx-auto mt-4 w-full max-w-5xl">
        {/* ======= セクション見出し（中央ズレ防止版） ======= */}
        <div className="mb-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div aria-hidden />
            <div className="flex justify-center">
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
                  {headingText}
                </div>
              </div>
            </div>
            <div aria-hidden />
          </div>
        </div>

        {/* ======= 説明文 ======= */}
        {paragraphs?.length ? (
          <div
            className="mt-2 space-y-1 text-xs"
            style={{ color: paragraphColor }}
          >
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}

        {/* ======= カード一覧（中央寄せ対応） ======= */}
        {items.length > 0 ? (
          <div className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((svc: any, idx: number) => {
                const title =
                  (svc.title ?? svc.label ?? svc.name ?? "")
                    .toString()
                    .trim() || `Service ${idx + 1}`;

                const rawPrice = svc.priceHint ?? svc.price;
                const priceHint =
                  formatPrice(rawPrice) ??
                  (typeof rawPrice === "string" && rawPrice.trim()
                    ? rawPrice.trim()
                    : null);

                const description = (svc.description ?? svc.desc ?? "").trim();

                return (
                  <div
                    key={idx}
                    className={[
                      "w-full",
                      "rounded-2xl px-5 py-5",
                      // ✅ B案：カード内の基本は中央（タイトル＆価格）
                      "text-center",
                      cardClass,
                      // ✅ 1件のときは幅を絞って中央に
                      isSingle
                        ? "md:col-span-2 md:justify-self-center md:max-w-xl"
                        : "",
                    ].join(" ")}
                    style={cardBaseStyle}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="text-[15px] font-semibold leading-snug"
                          style={{ color: cardTitleColor }}
                        >
                          {title}
                        </div>

                        {priceHint ? (
                          <div
                            className="mt-1 text-xs font-medium"
                            style={{ color: cardPriceColor }}
                          >
                            {priceHint}
                          </div>
                        ) : null}
                      </div>

                      <span
                        className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                        aria-hidden
                      />
                    </div>

                    {/* ✅ B案：説明文だけ左寄せ（可読性担保） */}
                    {description ? (
                      <p
                        className="mt-3 text-left text-[13px] leading-relaxed"
                        style={{ color: cardDescColor }}
                      >
                        {description}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ======= 空状態 ======= */}
        {items.length === 0 ? (
          <div
            className="mt-4 rounded-xl border px-6 py-8 text-center text-sm shadow-inner"
            style={{
              borderColor: v.borderColor,
              background: isDarkWorld
                ? "rgba(15,23,42,0.65)"
                : "rgba(255,255,255,0.9)",
              color: isDarkWorld
                ? "rgba(229,231,235,0.9)"
                : "rgba(55,65,81,0.9)",
            }}
          >
            <p className="font-medium">サービスはまだ登録されていません。</p>
            <p className="mt-1 text-[11px] opacity-80">
              フォームでサービス情報を入力するとここに表示されます。
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
};
