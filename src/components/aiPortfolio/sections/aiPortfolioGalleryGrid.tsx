// ============================================
// aiPortfolioGalleryGrid.tsx（showcase ＋ Lightbox＋SP横スクロール版）
// - imageUrl / url 両対応
// - description対応
// - showcase(gallery/masonry/card/textRich)でレイアウト切替
// - 作品クリックでフルスクリーン表示
// - スマホは横スクロール / PCはグリッド
// - 見出し＆空状態の視認性アップ版
// - 1〜2枚のとき PC で中央寄せ表示
// ============================================

import React, { CSSProperties, useState } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

export const AiPortfolioGalleryGrid: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  // union 型のため、ここは any 経由で安全に読む
  const rawSection = section as any;

  const items: any[] = rawSection.items ?? [];
  const headings: string[] | undefined = rawSection.headings;
  const paragraphs: string[] | undefined = rawSection.paragraphs;

  const v = applyVariantStyle(variant, theme);
  const mode = variant.showcase ?? "gallery";

  const isDarkWorld =
    variant.worldview === "dark" ||
    variant.worldview === "cyber" ||
    variant.worldview === "luxury";

  // ★ クリック時のフルスクリーン用 state
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex != null ? items[activeIndex] : null;
  const activeSrc = activeItem?.imageUrl ?? activeItem?.url ?? "";

  let cardClass =
    "flex flex-col overflow-hidden border bg-white transition-shadow cursor-zoom-in";
  const cardStyle: CSSProperties = {
    borderColor: v.borderColor,
    borderRadius: v.radius,
    boxShadow: v.shadow,
    background: v.surfaceBG,
    color: v.textColor,
  };

  if (variant.surface === "glass") {
    cardClass += " bg-white/80 backdrop-blur-md";
    cardStyle.background = "rgba(255,255,255,0.8)";
  }
  if (variant.surface === "dark" || variant.surface === "neon") {
    cardClass += " bg-black/70 text-gray-100";
    cardStyle.background = "rgba(2,6,23,0.9)";
  }

  // PC 用のグリッドレイアウト（md以上で使用）
  let gridClassDesktop = "grid gap-4 md:grid";
  if (mode === "gallery") {
    gridClassDesktop += " md:grid-cols-3";
  } else if (mode === "masonry") {
    gridClassDesktop += " md:grid-cols-3 lg:grid-cols-4";
  } else if (mode === "card") {
    gridClassDesktop += " md:grid-cols-2";
  }

  // ★ 1〜2件のときは PC で flex 中央寄せにする（masonry は除外）
  const fewDesktopItems = items.length <= 2 && mode !== "masonry";

  return (
    <section className="relative">
      {/* ======= セクション見出し（視認性アップ版） ======= */}
      <div className="mb-3 flex items-center justify-between">
        <div
          className={`flex ${
            variant.layout === "split" ? "justify-start" : "justify-center"
          } flex-1`}
        >
          <div className="inline-flex items-center gap-2">
            {/* アクセントライン（PCのみ表示） */}
            <span
              className="hidden h-px w-6 md:block"
              style={{
                backgroundColor: theme.colorAccent || theme.colorPrimary,
              }}
            />

            {/* ラベルチップ */}
            <div
              className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.30em] md:text-xs"
              style={{
                backgroundColor: isDarkWorld
                  ? "rgba(15,23,42,0.75)" // dark系: slate-900/75
                  : "rgba(255,255,255,0.9)", // light系: 白寄り
                color: isDarkWorld
                  ? "rgba(249,250,251,0.96)" // slate-50
                  : "rgba(15,23,42,0.9)", // slate-900
                borderColor: isDarkWorld
                  ? "rgba(148,163,184,0.7)" // slate-400
                  : "rgba(148,163,184,0.5)", // slate-400/50
              }}
            >
              {headings?.[0] ?? "WORKS"}
            </div>
          </div>
        </div>

        {/* 作品数バッジ（ある場合のみ） */}
        {items.length > 0 && (
          <div className="ml-2 flex items-center justify-end">
            <span
              className="rounded-full px-2 py-1 text-[10px] md:text-xs"
              style={{
                backgroundColor: isDarkWorld
                  ? "rgba(15,23,42,0.7)"
                  : "rgba(255,255,255,0.85)",
                color: isDarkWorld
                  ? "rgba(209,213,219,0.9)"
                  : "rgba(75,85,99,0.9)",
                border: "1px solid rgba(148,163,184,0.5)",
              }}
            >
              {items.length} items
            </span>
          </div>
        )}
      </div>

      {/* ======= 説明文 ======= */}
      {paragraphs?.length ? (
        <div
          className="mt-2 space-y-1 text-xs"
          style={{ color: v.textColor }}
        >
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      {/* ======= 空状態 ======= */}
      {items.length === 0 ? (
        <div
          className="mt-4 rounded-xl border px-6 py-8 text-center text-sm shadow-inner"
          style={{
            borderColor: v.borderColor,
            background: isDarkWorld
              ? "rgba(15,23,42,0.65)" // dark
              : "rgba(255,255,255,0.9)", // light
            color: isDarkWorld
              ? "rgba(229,231,235,0.9)" // gray-200
              : "rgba(55,65,81,0.9)", // gray-700
          }}
        >
          <p className="font-medium">作品はまだ登録されていません。</p>
          <p className="mt-1 text-[11px] opacity-80">
            作品をアップロードするとここに表示されます。
          </p>
        </div>
      ) : mode === "textRich" ? (
        // 文章重視：1カラムのリスト表示（SP/PC共通）
        <div className="mt-4 space-y-4">
          {items.map((item: any, i: number) => {
            const src = item?.imageUrl ?? item?.url ?? "";
            return (
              <div
                key={i}
                className="flex gap-3 rounded-xl border px-3 py-3 text-sm"
                style={cardStyle}
              >
                {src && (
                  <button
                    type="button"
                    className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200 cursor-zoom-in"
                    onClick={() => setActiveIndex(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={item.title ?? `work-${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                )}
                <div className="flex flex-1 flex-col">
                  <p className="text-xs font-semibold">
                    {item.title ?? item.name ?? `作品 ${i + 1}`}
                  </p>
                  {(item.description || item.desc) && (
                    <p className="mt-1 text-[11px] leading-relaxed opacity-80">
                      {item.description ?? item.desc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* ▼ スマホ：横スクロールカード（md未満のみ表示） */}
          <div className="mt-4 flex gap-4 overflow-x-auto pb-3 md:hidden">
            {items.map((item: any, i: number) => {
              const src = item?.imageUrl ?? item?.url ?? "";
              return (
                <button
                  key={i}
                  type="button"
                  className={`${cardClass} min-w-[220px] max-w-[260px] flex-shrink-0`}
                  style={cardStyle}
                  onClick={() => src && setActiveIndex(i)}
                >
                  {src ? (
                    <div className="aspect-[4/3] w-full bg-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={item.title ?? `work-${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] w-full bg-gray-200" />
                  )}

                  <div className="flex flex-1 flex-col px-3 py-2 text-left">
                    <p className="text-xs font-semibold">
                      {item.title ?? item.name ?? `作品 ${i + 1}`}
                    </p>
                    {(item.description || item.desc) && (
                      <p className="mt-1 line-clamp-3 text-[11px] opacity-80">
                        {item.description ?? item.desc}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ▼ PC / タブレット：レイアウト（md以上のみ表示） */}
          {fewDesktopItems ? (
            // 1〜2枚のとき：中央寄せでふわっと並べる
            <div className="mt-4 hidden w-full md:flex md:justify-center">
              <div className="flex max-w-3xl flex-wrap justify-center gap-4">
                {items.map((item: any, i: number) => {
                  const src = item?.imageUrl ?? item?.url ?? "";
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cardClass}
                      style={{
                        ...cardStyle,
                        maxWidth: "280px",
                        width: "100%",
                      }}
                      onClick={() => src && setActiveIndex(i)}
                    >
                      {src ? (
                        <div className="aspect-[4/3] w-full bg-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={item.title ?? `work-${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] w-full bg-gray-200" />
                      )}

                      <div className="flex flex-1 flex-col px-3 py-2 text-left">
                        <p className="text-xs font-semibold">
                          {item.title ?? item.name ?? `作品 ${i + 1}`}
                        </p>
                        {(item.description || item.desc) && (
                          <p className="mt-1 line-clamp-3 text-[11px] opacity-80">
                            {item.description ?? item.desc}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // 3枚以上のとき：通常グリッド（中央寄せコンテナ）
            <div className="mt-4 hidden w-full md:block">
              <div className={gridClassDesktop + " mx-auto w-full max-w-5xl"}>
                {items.map((item: any, i: number) => {
                  const src = item?.imageUrl ?? item?.url ?? "";

                  return (
                    <button
                      key={i}
                      type="button"
                      className={cardClass}
                      style={cardStyle}
                      onClick={() => src && setActiveIndex(i)}
                    >
                      {src ? (
                        <div className="aspect-[4/3] w-full bg-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={item.title ?? `work-${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] w-full bg-gray-200" />
                      )}

                      <div className="flex flex-1 flex-col px-3 py-2 text-left">
                        <p className="text-xs font-semibold">
                          {item.title ?? item.name ?? `作品 ${i + 1}`}
                        </p>
                        {(item.description || item.desc) && (
                          <p className="mt-1 line-clamp-3 text-[11px] opacity-80">
                            {item.description ?? item.desc}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ★ フルスクリーン Lightbox */}
      {activeItem && activeSrc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-10"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              type="button"
              className="absolute -right-2 -top-2 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white shadow"
              onClick={() => setActiveIndex(null)}
            >
              CLOSE
            </button>

            <div className="overflow-hidden rounded-xl bg-black/90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeSrc}
                alt={activeItem.title ?? "work-full"}
                className="max-h-[80vh] max-w-[90vw] object-contain"
              />
            </div>

            {(activeItem.title || activeItem.description) && (
              <div className="mt-3 text-center text-[11px] text-gray-100">
                {activeItem.title && (
                  <p className="font-semibold">{activeItem.title}</p>
                )}
                {activeItem.description && (
                  <p className="mt-1 opacity-80">
                    {activeItem.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
