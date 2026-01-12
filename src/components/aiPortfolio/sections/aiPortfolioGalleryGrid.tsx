"use client";

// ============================================
// AiPortfolioGalleryGrid（販売レベル改修版）
// ============================================
// - デザイントークン統一
// - ホバー演出強化（オーバーレイ + 拡大アイコン）
// - 作品が「主役」として見える視線誘導
// - 世界観ごとのカード装飾

import React, { CSSProperties, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

/* ✅ Storage path → proxy URL */
import { auraAssetProxyUrl } from "@/lib/aiPortfolio/storage/auraAssets";
import { AiPortfolioSectionPillHeader } from "./_shared/AiPortfolioSectionPillHeader";
import { SectionBackground } from "./_shared/SectionBackground";
import {
  SPACING,
  TYPOGRAPHY,
  TRANSITION,
  getWorldviewOverride,
} from "@/lib/aiPortfolio/aiPortfolio.designSystem";
import { ZoomIn } from "lucide-react";

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
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

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

  useEffect(() => {
  if (!activeItem || !activeSrc) return;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setActiveIndex(null);
  };

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  window.addEventListener("keydown", onKeyDown);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = prevOverflow;
  };
}, [activeItem, activeSrc]);

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

  // 世界観のオーバーライド
  const worldview = String((variant as any)?.worldview ?? "business");
  const override = getWorldviewOverride(worldview);
  const isNeon = override.decorations.neonBorder;
  const isGold = override.decorations.goldAccent;

  /**
   * カード描画（共通）
   * - aspect を変えたい時だけ引数で指定
   * - ホバー演出追加（オーバーレイ + 拡大アイコン）
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

    // 世界観ごとのカードシャドウ
    const cardShadowStyle = isNeon
      ? `${v.shadow}, 0 0 12px ${accentUser}30`
      : isGold
        ? `${v.shadow}, 0 0 0 1px rgba(212,175,55,0.2)`
        : v.shadow;

    return (
      <button
        type="button"
        className={`group ${cardClass} ${className} ${TRANSITION.base}`}
        style={{ ...cardStyle, boxShadow: cardShadowStyle }}
        onClick={() => src && setActiveIndex(i)}
        aria-label={`Open work ${i + 1}`}
      >
        {/* 画像エリア */}
        <div className={`relative overflow-hidden ${aspectClass} w-full bg-gray-200`}>
          {src ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={item.title ?? `work-${i + 1}`}
                className={`h-full w-full object-cover ${TRANSITION.slow} group-hover:scale-105`}
              />
              {/* ホバーオーバーレイ */}
              <div
                className={`absolute inset-0 flex items-center justify-center bg-black/0 ${TRANSITION.base} group-hover:bg-black/40`}
              >
                <ZoomIn
                  className={`h-8 w-8 text-white opacity-0 ${TRANSITION.base} group-hover:opacity-100`}
                  strokeWidth={1.5}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* テキストエリア */}
        <div className="flex flex-1 flex-col px-4 py-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <p className={TYPOGRAPHY.heading.cardSub}>{getTitle(item, i)}</p>

            {getYearText(item) ? (
              <span
                className={`mt-[1px] shrink-0 rounded-full border px-2 py-[2px] ${TYPOGRAPHY.body.caption} opacity-80`}
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
            <p className={`mt-2 line-clamp-3 ${TYPOGRAPHY.body.small} opacity-75`}>
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
  const enableCountLayout = mode !== "textRich" && mode !== "masonry";
  const count = items.length;

  // アクセント色
  const accentUser = v.accentColor || theme.colorAccent || theme.colorPrimary;

  const overallStrength = useMemo(() => {
    const rawStrength = (variant as any)?.overallStrength;
    const n = typeof rawStrength === "string" ? Number(rawStrength) : Number(rawStrength);
    return Number.isFinite(n) ? n : 0;
  }, [variant]);

  // 背景は共通コンポーネントに委譲

  return (
    <section
      className={`relative overflow-hidden ${SPACING.section.paddingY} ${SPACING.section.paddingX}`}
      aria-label="Works"
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

      {/* 中央基準を統一 */}
      <div className={`relative z-10 mx-auto w-full ${SPACING.maxWidth.section}`}>
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

{/* Lightbox (Portal: header/sectionsより常に最前面) */}
{mounted && activeItem && activeSrc
  ? createPortal(
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 px-4 py-10"
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
      </div>,
      document.body
    )
  : null}
      </div>
    </section>
  );
};
