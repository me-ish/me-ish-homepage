// src/components/aiPortfolio/sections/aiPortfolioServices.tsx
// ============================================
// Services セクション（販売レベル改修版）
// ============================================

"use client";

import React, { CSSProperties, useMemo } from "react";
import type { Content, Design } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

import { AiPortfolioSectionPillHeader } from "./_shared/AiPortfolioSectionPillHeader";
import { SectionBackground } from "./_shared/SectionBackground";
import { sectionAccentColor } from "@/lib/aiPortfolio/aiPortfolio.sectionAccent";
import {
  SPACING,
  TYPOGRAPHY,
  TRANSITION,
  getWorldviewOverride,
} from "@/lib/aiPortfolio/aiPortfolio.designSystem";

import {
  BookOpen,
  Image as ImageIcon,
  Megaphone,
  Palette,
  PenTool,
  Sparkles,
  Users,
  Shapes,
  Brush,
  Camera,
  PenLine,
  Layers,
} from "lucide-react";

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

/* ---------------------------------------------------------
 * Icon inference (deterministic, low-risk)
 * - svc.iconKey / svc.icon があればそれを優先
 * - なければ title/description/section paragraphs を参照して推定
 * --------------------------------------------------------- */
function normalizeText(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

function inferIconKeyFromText(raw: string): string {
  const t = normalizeText(raw);

  // 出版・編集・書籍
  if (
    includesAny(t, [
      "出版",
      "編集",
      "書籍",
      "雑誌",
      "挿絵",
      "装画",
      "カバー",
      "book",
      "editorial",
      "magazine",
    ])
  ) {
    return "bookOpen";
  }

  // 広告・プロモーション・sns運用
  if (
    includesAny(t, [
      "広告",
      "プロモーション",
      "sns",
      "web広告",
      "キャンペーン",
      "バナー",
      "lp",
      "promo",
      "promotion",
      "banner",
      "campaign",
    ])
  ) {
    return "megaphone";
  }

  // ブランド・ビジュアルアイデンティティ・ロゴ
  if (
    includesAny(t, [
      "ブランド",
      "ブランディング",
      "ロゴ",
      "vi",
      "ビジュアルアイデンティティ",
      "identity",
      "branding",
      "logo",
    ])
  ) {
    return "palette";
  }

  // キャラクター・人物・マスコット
  if (
    includesAny(t, [
      "キャラクター",
      "キャラ",
      "人物",
      "マスコット",
      "立ち絵",
      "trpg",
      "character",
      "mascot",
      "avatar",
    ])
  ) {
    return "users";
  }

  // 写真・撮影・レタッチ
  if (includesAny(t, ["撮影", "写真", "レタッチ", "photo", "camera", "retouch"])) {
    return "camera";
  }

  // デザイン・レイアウト・図解
  if (
    includesAny(t, [
      "図解",
      "レイアウト",
      "デザイン",
      "layout",
      "diagram",
      "infographic",
    ])
  ) {
    return "layers";
  }

  // アイコン・ピクト
  if (includesAny(t, ["アイコン", "ピクト", "pict", "icon"])) {
    return "shapes";
  }

  // アート・イラスト全般
  if (includesAny(t, ["イラスト", "illustration", "アート", "art"])) {
    return "brush";
  }

  // それ以外
  return "sparkles";
}

export const AiPortfolioServices: React.FC<Props> = ({ section, theme, variant }) => {
  const rawSection = section as any;

  const items: any[] = rawSection.items ?? [];
  const isSingle = items.length === 1;

  const headings: string[] | undefined = rawSection.headings;
  const paragraphs: string[] | undefined = rawSection.paragraphs;

  const sectionType = (rawSection.type ?? "services") as string;

  const headingText =
    headings?.[0] ?? getLabel((theme as any)?.languageMode ?? (theme as any)?.language);

  // 世界観オーバーライド
  const worldview = String((variant as any)?.worldview ?? "business");
  const override = getWorldviewOverride(worldview);
  const isNeon = override.decorations.neonBorder;
  const isGold = override.decorations.goldAccent;

  const v = applyVariantStyle(variant, theme);

  // テキストブロックの基本整列（split は左、center は中央）
  const alignClass = (variant as any)?.layout === "split" ? "text-left" : "text-center";

  const isDarkWorld = v.isDark;

  const paragraphColor = isDarkWorld ? "rgba(226,232,240,0.90)" : "rgba(55,65,81,0.90)";
  const cardTitleColor = isDarkWorld ? "rgba(248,250,252,0.98)" : "rgba(17,24,39,0.96)";
  const cardPriceColor = isDarkWorld ? "rgba(244,244,245,0.95)" : "rgba(30,64,175,0.95)";
  const cardDescColor = paragraphColor;

  // ✅ セクションごとにアクセントを微調整（About と同じ思想）
  const accentBase = (theme as any)?.colorAccent || (theme as any)?.colorPrimary;
  const accent = sectionAccentColor(accentBase, sectionType);

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

  let cardClass =
    "border transition-shadow hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]";
  if ((variant as any)?.surface === "glass") cardClass += " backdrop-blur-md";
  if ((variant as any)?.surface === "dark" || (variant as any)?.surface === "neon") {
    cardClass += " text-gray-100";
  }

  const ICON_MAP: Record<string, React.ComponentType<any>> = useMemo(() => {
    return {
      palette: Palette,
      bookOpen: BookOpen,
      users: Users,
      megaphone: Megaphone,
      image: ImageIcon,
      penTool: PenTool,
      sparkles: Sparkles,
      shapes: Shapes,
      brush: Brush,
      camera: Camera,
      penLine: PenLine,
      layers: Layers,
    };
  }, []);

  // 「トップに書いた文」を参照するためのテキスト（services セクションの説明文）
  const sectionContextText = useMemo(() => {
    const ps = Array.isArray(paragraphs) ? paragraphs.filter(Boolean).join("\n") : "";
    const hs = Array.isArray(headings) ? headings.filter(Boolean).join(" / ") : "";
    return `${headingText}\n${hs}\n${ps}`.trim();
  }, [paragraphs, headings, headingText]);

  const overallStrength = useMemo(() => {
    const raw = (variant as any)?.overallStrength;
    const n = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [variant]);

  // 背景は共通コンポーネントに委譲

  return (
    <section
      className={`relative overflow-hidden ${SPACING.section.paddingY} ${SPACING.section.paddingX} ${alignClass}`}
      aria-label="Services"
    >
      {/* 背景レイヤー */}
      <SectionBackground
        theme={theme}
        variant={variant}
        sectionType={sectionType}
        isDark={isDarkWorld}
        accentColor={accent}
        overallStrength={overallStrength}
      />

      {/* 中央基準コンテナ */}
      <div className={`relative z-10 mx-auto w-full ${SPACING.maxWidth.section}`}>
        {/* ✅ About と同じ見出し（ズレ根絶） */}
        <AiPortfolioSectionPillHeader
          label={headingText}
          theme={theme}
          variant={variant}
          className="mb-3"
        />

        {/* ======= 説明文 ======= */}
        {paragraphs?.length ? (
          <div className="mt-2 space-y-1 text-xs" style={{ color: paragraphColor }}>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}

        {/* ======= カード一覧 ======= */}
        {items.length > 0 ? (
          <div className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((svc: any, idx: number) => {
                const title =
                  (svc.title ?? svc.label ?? svc.name ?? "").toString().trim() ||
                  `Service ${idx + 1}`;

                const rawPrice = svc.priceHint ?? svc.price;
                const priceHint =
                  formatPrice(rawPrice) ??
                  (typeof rawPrice === "string" && rawPrice.trim()
                    ? rawPrice.trim()
                    : null);

                const description = (svc.description ?? svc.desc ?? "").toString().trim();

                // ✅ iconKey 優先 → なければ「サービス文言 + セクション説明文」から推定
                const iconKeyRaw = (svc.iconKey ?? svc.icon ?? "").toString().trim();
                const inferred = inferIconKeyFromText(
                  `${title}\n${description}\n${sectionContextText}`
                );
                const iconKey = iconKeyRaw || inferred;

                const Icon = ICON_MAP[iconKey] ?? Sparkles;

                return (
                  <div
                    key={idx}
                    className={[
                      "w-full",
                      "rounded-2xl px-6 py-6",
                      // ✅ B案：カード内の基本は中央（タイトル＆価格）
                      "text-center",
                      "relative",
                      cardClass,
                      // ✅ 1件のときは幅を絞って中央に
                      isSingle ? "md:col-span-2 md:justify-self-center md:max-w-xl" : "",
                    ].join(" ")}
                    style={cardBaseStyle}
                  >
                    {/* 右上アクセント点（absolute でレイアウトを押さない） */}
                    <span
                      className="absolute right-5 top-5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    />

                    {/* アイコン（中央） */}
                    <div
                      className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border"
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
                        style={{ color: isDarkWorld ? "rgba(226,232,240,0.92)" : accent }}
                      />
                    </div>

                    {/* タイトル/価格（中央） */}
                    <div className="text-center">
                      <div
                        className="text-[15px] font-semibold leading-snug"
                        style={{ color: cardTitleColor }}
                      >
                        {title}
                      </div>

                      {priceHint ? (
                        <div className="mt-1 text-xs font-medium" style={{ color: cardPriceColor }}>
                          {priceHint}
                        </div>
                      ) : null}
                    </div>

                    {/* ✅ B案：説明文だけ左寄せ（可読性担保） */}
                    {description ? (
                      <p
                        className="mt-3 text-left text-[13px] leading-7"
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
              background: isDarkWorld ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.9)",
              color: isDarkWorld ? "rgba(229,231,235,0.9)" : "rgba(55,65,81,0.9)",
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
