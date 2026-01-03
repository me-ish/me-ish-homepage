"use client";

// ============================================
// AiPortfolioGalleryGrid（showcase ＋ Lightbox＋SP横スクロール版）
// - imageUrl / url 両対応
// - description対応
// - showcase(gallery/masonry/card/textRich)でレイアウト切替
// - スマホは横スクロール / PCはグリッド
// - ✅ 1〜3枚のとき “枚数に応じた見せ方” を自動適用（masonry/textRichは除外）
// - ✅ item内のどのキーに入っていても画像参照を拾う（強制救済）
// - ✅ 見出し中央ズレ完全解消（grid 3cols）
// - ✅ セクションコンテナ幅を統一（max-w）
// ============================================

import React, { CSSProperties, useMemo, useState } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

/* ✅ Storage path → proxy URL */
import { auraAssetProxyUrl } from "@/lib/aiPortfolio/storage/auraAssets";
import { AiPortfolioSectionPillHeader } from "./_shared/AiPortfolioSectionPillHeader";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

function isStoragePathLike(v: string): boolean {
  const s = (v ?? "").toString().trim();
  if (!s) return false;
  if (s.startsWith("works/") || s.startsWith("avatars/")) return true;
  if (s.startsWith("/works/") || s.startsWith("/avatars/")) return true;
  return false;
}

function isHttpUrl(v: string): boolean {
  const s = (v ?? "").toString().trim();
  return /^https?:\/\//i.test(s);
}

/**
 * item から「画像参照っぽい文字列」を総当たりで拾う
 * - 直下の string 値
 * - 1階層ネスト（object の中の string 値）
 */
function collectStringValuesShallow(obj: any): string[] {
  const out: string[] = [];
  if (!obj || typeof obj !== "object") return out;

  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];

    if (typeof v === "string") {
      const s = v.trim();
      if (s) out.push(s);
      continue;
    }

    // 1階層ネストだけ拾う（image:{...} / file:{...} などの救済）
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const kk of Object.keys(v)) {
        const vv = (v as any)[kk];
        if (typeof vv === "string") {
          const ss = vv.trim();
          if (ss) out.push(ss);
        }
      }
    }
  }

  return out;
}

/**
 * 作品アイテムから表示用の画像URLを解決する（最重要）
 * 優先:
 * 1) 明示キー（imageUrl/url/src/...）
 * 2) パス系キー（storagePath/path/...）
 * 3) それでも無ければ item内の文字列を総当たりして「works/...」「http(s)」を探す
 */
function resolveImageSrc(item: any): string {
  if (!item) return "";

  // 1) 明示キー（最優先）
  const explicitCandidates: Array<string | undefined | null> = [
    item.imageUrl,
    item.url,
    item.src,
    item.image,
    item.thumbnailUrl,
    item.thumbnail,
  ];

  for (const c of explicitCandidates) {
    const s = (c ?? "").toString().trim();
    if (!s) continue;

    if (isStoragePathLike(s)) {
      const p = s.startsWith("/") ? s.slice(1) : s;
      return auraAssetProxyUrl(p);
    }
    if (isHttpUrl(s)) return s;

    // data URL なども許容
    return s;
  }

  // 2) パス系キー
  const pathCandidates: Array<string | undefined | null> = [
    item.storagePath,
    item.storage_path,
    item.path,
    item.filePath,
    item.file_path,
  ];

  for (const c of pathCandidates) {
    const p0 = (c ?? "").toString().trim();
    if (!p0) continue;
    const p = p0.startsWith("/") ? p0.slice(1) : p0;
    return auraAssetProxyUrl(p);
  }

  // 3) 総当たり救済（ここが“最後の砦”）
  const allStrings = collectStringValuesShallow(item);

  // 3-1) works/... / avatars/... を優先して拾う
  for (const s0 of allStrings) {
    if (isStoragePathLike(s0)) {
      const p = s0.startsWith("/") ? s0.slice(1) : s0;
      return auraAssetProxyUrl(p);
    }
  }

  // 3-2) http(s) URL を拾う
  for (const s0 of allStrings) {
    if (isHttpUrl(s0)) return s0;
  }

  return "";
}

export const AiPortfolioGalleryGrid: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  const rawSection = section as any;

  const v = applyVariantStyle(variant, theme);
  const mode = variant.showcase ?? "gallery";
  const isDarkWorld = v.isDark;

  // items を“描画前”に正規化（imageUrl を強制注入）
  const items: any[] = useMemo(() => {
    const arr: any[] = Array.isArray(rawSection?.items) ? rawSection.items : [];
    return arr.map((it) => {
      const resolved = resolveImageSrc(it);
      return resolved ? { ...it, imageUrl: resolved } : it;
    });
  }, [rawSection]);

  const headings: string[] | undefined = rawSection.headings;
  const paragraphs: string[] | undefined = rawSection.paragraphs;

  // Lightbox state
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex != null ? items[activeIndex] : null;
  const activeSrc = activeItem ? resolveImageSrc(activeItem) : "";

  let cardClass =
    "flex flex-col overflow-hidden border transition-shadow cursor-zoom-in";
  const cardStyle: CSSProperties = {
    borderColor: v.borderColor,
    borderRadius: v.radius,
    boxShadow: v.shadow,
    background: v.surfaceBG,
    color: v.textColor,
  };

  /**
   * ✅ 重要：ここで surface を見て “背景色を上書きしない”
   * applyVariantStyle（=SurfaceRegistry）が単一の正。
   * works だけローカル補正すると、他セクションとズレる。
   *
   * ただし glass だけは「ぼかし」を入れたい場合があるので、
   * 背景は触らず class だけ付与する（任意）。
   */
  if (variant.surface === "glass") {
    cardClass += " backdrop-blur-md";
  }

  // PC grid (通常)
  let gridClassDesktop = "grid gap-4 md:grid";
  if (mode === "gallery") gridClassDesktop += " md:grid-cols-3";
  else if (mode === "masonry") gridClassDesktop += " md:grid-cols-3 lg:grid-cols-4";
  else if (mode === "card") gridClassDesktop += " md:grid-cols-2";

  const headerLabel = headings?.[0] ?? "WORKS";

  const rightBadge =
    items.length > 0 ? (
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
    ) : null;

  const getTitle = (item: any, i: number) =>
    item.title ?? item.name ?? `作品 ${i + 1}`;

  const getDesc = (item: any) => item.description ?? item.desc ?? "";

   // ✅ 追加：制作年（year）の表示用整形
  const getYearText = (item: any): string | null => {
    const raw = item?.year ?? item?.createdYear ?? item?.productionYear ?? null;
    if (raw === null || raw === undefined) return null;

    const s = String(raw).trim();
    if (!s) return null;

    // "2024" のような4桁だけなら「2024年」に寄せる（すでに年が付いてるならそのまま）
    if (/^\d{4}$/.test(s)) return `${s}年`;
    return s;
  };

  /**
   * カード描画（共通）
   * - aspect を変えたい時だけ引数で指定
   */
  function WorkCard({
    item,
    i,
    aspectClass = "aspect-[4/3]",
    className = "",
  }: {
    item: any;
    i: number;
    aspectClass?: string;
    className?: string;
  }) {
    const src = resolveImageSrc(item);

    return (
      <button
        type="button"
        className={[cardClass, className].join(" ")}
        style={cardStyle}
        onClick={() => src && setActiveIndex(i)}
        aria-label={`Open work ${i + 1}`}
      >
        <div className={[aspectClass, "w-full bg-gray-200"].join(" ")}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={item.title ?? `work-${i + 1}`}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

                <div className="flex flex-1 flex-col px-3 py-2 text-left">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold">{getTitle(item, i)}</p>

            {getYearText(item) ? (
              <span
                className="mt-[1px] shrink-0 rounded-full border px-2 py-[2px] text-[10px] opacity-80"
                style={{
                  borderColor: v.borderColor,
                  background: "transparent",
                  color: v.textColor,
                }}
              >
                {getYearText(item)}
              </span>
            ) : null}
          </div>

          {getDesc(item) ? (
            <p className="mt-1 line-clamp-3 text-[11px] opacity-80">
              {getDesc(item)}
            </p>
          ) : null}
        </div>

      </button>
    );
  }

  /**
   * ✅ 枚数で“見せ方”を変える対象か？
   * - textRich: 文章主導なので対象外
   * - masonry: 破綻しやすいので対象外
   */
  const enableCountLayout =
    mode !== "textRich" && mode !== "masonry";

  const count = items.length;

  return (
    <section className="relative px-3 pb-6 md:px-4 md:pb-8" aria-label="Works">
      {/* 中央基準を統一 */}
      <div className="mx-auto w-full max-w-5xl">
        {/* ======= 見出し（中央厳密） ======= */}
        <AiPortfolioSectionPillHeader
          label={headerLabel}
          theme={theme}
          variant={variant}
          rightSlot={rightBadge}
          className="mb-3"
        />

        {/* ======= 説明 ======= */}
        {paragraphs?.length ? (
          <div className="mt-2 space-y-1 text-xs" style={{ color: v.textColor }}>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}

        {/* ======= 空状態 ======= */}
        {items.length === 0 ? (
          <div
            className="mt-4 border px-6 py-8 text-center text-sm shadow-inner"
            style={{
              borderColor: v.borderColor,
              borderRadius: v.radius,
              background: v.surfaceBG,
              color: v.textColor,
            }}
          >
            <p className="font-medium">作品はまだ登録されていません。</p>
            <p className="mt-1 text-[11px] opacity-80">
              作品をアップロードするとここに表示されます。
            </p>
          </div>
        ) : mode === "textRich" ? (
          // ===============================
          // textRich（既存）
          // ===============================
          <div className="mt-4 space-y-4">
            {items.map((item: any, i: number) => {
              const src = resolveImageSrc(item);
              return (
                <div
                  key={i}
                  className="flex gap-3 rounded-xl border px-3 py-3 text-sm"
                  style={cardStyle}
                >
                  {src ? (
                    <button
                      type="button"
                      className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200 cursor-zoom-in"
                      onClick={() => setActiveIndex(i)}
                      aria-label={`Open work ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={item.title ?? `work-${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : null}

                  <div className="flex flex-1 flex-col">
                    <p className="text-xs font-semibold">{getTitle(item, i)}</p>
                    {getDesc(item) ? (
                      <p className="mt-1 text-[11px] leading-relaxed opacity-80">
                        {getDesc(item)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ===============================
          // gallery / card / masonry（SP＋PC）
          // ===============================
          <>
            {/* ===============================
             * SP（枚数に関わらず “見やすい” に寄せる）
             * - 1枚：横スクロールをやめて大きく表示
             * - 2枚以上：従来通り横スクロール（スナップで気持ちよく）
             * =============================== */}
            {enableCountLayout && count === 1 ? (
              <div className="mt-4 md:hidden">
                <div className="mx-auto w-full max-w-md">
                  <WorkCard
                    item={items[0]}
                    i={0}
                    aspectClass="aspect-[16/10]"
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 flex gap-4 overflow-x-auto pb-3 md:hidden snap-x snap-mandatory">
                {items.map((item: any, i: number) => (
                  <div key={i} className="snap-start">
                    <WorkCard
                      item={item}
                      i={i}
                      className="min-w-[240px] max-w-[280px] flex-shrink-0"
                      aspectClass="aspect-[4/3]"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ===============================
             * PC（枚数に応じてレイアウトを自動切替）
             * - enableCountLayout=true の時のみ適用
             * =============================== */}
            <div className="mt-4 hidden w-full md:block">
              {enableCountLayout && count === 1 ? (
                // 1枚：大きく、余白を活かして“代表作”にする
                <div className="mx-auto w-full max-w-4xl">
                  <WorkCard
                    item={items[0]}
                    i={0}
                    aspectClass="aspect-[16/9]"
                    className="w-full"
                  />
                </div>
              ) : enableCountLayout && count === 2 ? (
                // 2枚：2カラム（対で見せる）
                <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-4">
                  <WorkCard item={items[0]} i={0} />
                  <WorkCard item={items[1]} i={1} />
                </div>
              ) : enableCountLayout && count === 3 ? (
                // 3枚：編集レイアウト（1枚目を大、2-3枚目を小で“雑誌感”）
                <div className="mx-auto grid w-full max-w-5xl grid-cols-3 gap-4">
                  <div className="col-span-2 row-span-2">
                    <WorkCard
                      item={items[0]}
                      i={0}
                      aspectClass="aspect-[16/10]"
                      className="h-full"
                    />
                  </div>
                  <div className="col-span-1">
                    <WorkCard item={items[1]} i={1} />
                  </div>
                  <div className="col-span-1">
                    <WorkCard item={items[2]} i={2} />
                  </div>
                </div>
              ) : (
                // 4枚以上（または enableCountLayout=false）：既存の通常グリッド
                <div className={`${gridClassDesktop} mx-auto w-full`}>
                  {items.map((item: any, i: number) => (
                    <WorkCard key={i} item={item} i={i} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Lightbox */}
        {activeItem && activeSrc ? (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-10"
            onClick={() => setActiveIndex(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative max-h-full max-w-full"
              onClick={(e) => e.stopPropagation()}
            >
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

                            {activeItem.title || activeItem.description || getYearText(activeItem) ? (
                <div className="mt-3 text-center text-[11px] text-gray-100">
                  {activeItem.title ? (
                    <p className="font-semibold">{activeItem.title}</p>
                  ) : null}

                  {getYearText(activeItem) ? (
                    <p className="mt-1 opacity-80">{getYearText(activeItem)}</p>
                  ) : null}

                  {activeItem.description ? (
                    <p className="mt-1 opacity-80">{activeItem.description}</p>
                  ) : null}
                </div>
              ) : null}

            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
