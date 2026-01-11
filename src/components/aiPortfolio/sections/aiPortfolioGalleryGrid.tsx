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
// - ✅ 追加：About/Services/Contact と同等の「世界観ごとの背景（bgGradient + pattern + texture + overlay）」を適用
// - ✅ 追加：sectionTheme.works（または section.type）を参照し、そのセクション専用背景を反映
// - ✅ 方針：ビネットは無し。グローは accentUser（好きな色）。
// - ✅ 背景幅も他セクション同様に拡張（上下に余白）
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

/** ✅ theme の bgGradient / patternLayers / textureLayers / bgStyle を合成して背景を作る（About/Services/Contactと同等） */
function buildSectionBackgroundStyle(theme: Design["theme"]) {
  const bgStyle = (theme as any)?.bgStyle ?? undefined;

  const bgGradient =
    typeof (theme as any)?.bgGradient === "string" ? (theme as any).bgGradient : "";
  const patternLayers = Array.isArray((theme as any)?.patternLayers)
    ? (theme as any).patternLayers
    : [];
  const textureLayers = Array.isArray((theme as any)?.textureLayers)
    ? (theme as any).textureLayers
    : [];

  const images: string[] = [];
  if (bgGradient) images.push(bgGradient);
  if (patternLayers.length > 0) images.push(...patternLayers);
  if (textureLayers.length > 0) images.push(...textureLayers);

  const backgroundImage = images.length > 0 ? images.join(", ") : undefined;

  return {
    ...(bgStyle ?? {}),
    ...(backgroundImage ? { backgroundImage } : {}),
  } as React.CSSProperties;
}

export const AiPortfolioGalleryGrid: React.FC<Props> = ({ section, theme, variant }) => {
  const rawSection = section as any;

  // ✅ sectionTheme（セクション別背景）を拾って、そのセクション用の theme を作る
  // - type が無い場合、WORKS セクション想定で "works" にフォールバック
  const sectionType = (rawSection.type ?? "works") as string;
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

  let cardClass = "flex flex-col overflow-hidden border transition-shadow cursor-zoom-in";
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
          backgroundColor: isDarkWorld ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)",
          color: isDarkWorld ? "rgba(209,213,219,0.9)" : "rgba(75,85,99,0.9)",
          border: "1px solid rgba(148,163,184,0.5)",
        }}
      >
        {items.length} items
      </span>
    ) : null;

  const getTitle = (item: any, i: number) => item.title ?? item.name ?? `作品 ${i + 1}`;
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
            <img src={src} alt={item.title ?? `work-${i + 1}`} className="h-full w-full object-cover" />
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

          {getDesc(item) ? <p className="mt-1 line-clamp-3 text-[11px] opacity-80">{getDesc(item)}</p> : null}
        </div>
      </button>
    );
  }

  /**
   * ✅ 枚数で“見せ方”を変える対象か？
   * - textRich: 文章主導なので対象外
   * - masonry: 破綻しやすいので対象外
   */
  const enableCountLayout = mode !== "textRich" && mode !== "masonry";
  const count = items.length;

  // ✅ 背景（About/Services/Contact と同一方針）
  // - ビネット無し
  // - グローは accentUser（好きな色）
  // - 40〜：アクセントON / 70〜：プラスα
  const accentUser = v.accentColor || theme.colorAccent || theme.colorPrimary;

  const overallStrength = useMemo(() => {
    const rawStrength = (variant as any)?.overallStrength;
    const n = typeof rawStrength === "string" ? Number(rawStrength) : Number(rawStrength);
    return Number.isFinite(n) ? n : 0;
  }, [variant]);

  const worksBg = useMemo(() => buildSectionBackgroundStyle(themeForSection as any), [themeForSection]);

  const bgOverlayOpacity = useMemo(() => {
    if (overallStrength <= 20) return isDarkWorld ? 0.55 : 0.72;
    if (overallStrength <= 60) return isDarkWorld ? 0.5 : 0.68;
    return isDarkWorld ? 0.46 : 0.64;
  }, [overallStrength, isDarkWorld]);

  const ACCENT_AT = 40;
  const PLUS_AT = 70;

  const useAccentBg = overallStrength >= ACCENT_AT;
  const usePlus = overallStrength >= PLUS_AT;

  const SectionBackground = (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={worksBg}
    >
      {/* 1) 可読性 overlay（常時） */}
      <div
        className="absolute inset-0"
        style={{
          background: isDarkWorld ? "rgba(2,6,23,0.72)" : "rgba(255,255,255,0.78)",
          opacity: bgOverlayOpacity,
        }}
      />

      {/* 2) 40〜：アクセントの薄いグロー（accentUser） */}
      {useAccentBg ? (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 20% 10%, ${accentUser} 0%, transparent 48%)`,
            opacity: isDarkWorld ? 0.14 : 0.10,
          }}
        />
      ) : null}

      {/* 3) 70〜：プラスα（質感だけ足す / ビネット無し） */}
      {usePlus ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 100% 100%, ${accentUser} 0%, transparent 55%)`,
              opacity: isDarkWorld ? 0.10 : 0.07,
            }}
          />
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

  return (
<section
  className="relative overflow-hidden px-3 pt-6 pb-8 md:px-4 md:pt-14 md:pb-16"
  aria-label="Works"
>
      {/* ✅ 背景 */}
      {SectionBackground}

      {/* 中央基準を統一 */}
      <div className="relative z-10 mx-auto w-full max-w-5xl">
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
            <p className="mt-1 text-[11px] opacity-80">作品をアップロードするとここに表示されます。</p>
          </div>
        ) : mode === "textRich" ? (
          // ===============================
          // textRich
          // ===============================
          <div className="mt-4 space-y-4">
            {items.map((item: any, i: number) => {
              const src = resolveImageSrc(item);
              return (
                <div key={i} className="flex gap-3 rounded-xl border px-3 py-3 text-sm" style={cardStyle}>
                  {src ? (
                    <button
                      type="button"
                      className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200 cursor-zoom-in"
                      onClick={() => setActiveIndex(i)}
                      aria-label={`Open work ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={item.title ?? `work-${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ) : null}

                  <div className="flex flex-1 flex-col">
                    <p className="text-xs font-semibold">{getTitle(item, i)}</p>
                    {getDesc(item) ? (
                      <p className="mt-1 text-[11px] leading-relaxed opacity-80">{getDesc(item)}</p>
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
             * SP
             * - 1枚：横スクロールをやめて大きく表示
             * - 2枚以上：横スクロール（スナップ）
             * =============================== */}
            {enableCountLayout && count === 1 ? (
              <div className="mt-4 md:hidden">
                <div className="mx-auto w-full max-w-md">
                  <WorkCard item={items[0]} i={0} aspectClass="aspect-[16/10]" className="w-full" />
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
             * =============================== */}
            <div className="mt-4 hidden w-full md:block">
              {enableCountLayout && count === 1 ? (
                <div className="mx-auto w-full max-w-4xl">
                  <WorkCard item={items[0]} i={0} aspectClass="aspect-[16/9]" className="w-full" />
                </div>
              ) : enableCountLayout && count === 2 ? (
                <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-4">
                  <WorkCard item={items[0]} i={0} />
                  <WorkCard item={items[1]} i={1} />
                </div>
              ) : enableCountLayout && count === 3 ? (
                <div className="mx-auto grid w-full max-w-5xl grid-cols-3 gap-4">
                  <div className="col-span-2 row-span-2">
                    <WorkCard item={items[0]} i={0} aspectClass="aspect-[16/10]" className="h-full" />
                  </div>
                  <div className="col-span-1">
                    <WorkCard item={items[1]} i={1} />
                  </div>
                  <div className="col-span-1">
                    <WorkCard item={items[2]} i={2} />
                  </div>
                </div>
              ) : (
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
            <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
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
                  {activeItem.title ? <p className="font-semibold">{activeItem.title}</p> : null}
                  {getYearText(activeItem) ? <p className="mt-1 opacity-80">{getYearText(activeItem)}</p> : null}
                  {activeItem.description ? <p className="mt-1 opacity-80">{activeItem.description}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
