// src/components/aura/sections/AuraSkills.tsx
// ============================================
// Skills セクション（販売レベル改修版）
// ============================================

"use client";

import React, { CSSProperties, useMemo } from "react";
import type { Design, Content } from "@/lib/aura/aura.schema";
import type { VariantSpec } from "@/lib/aura/aura.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

import { AuraSectionPillHeader } from "./_shared/AuraSectionPillHeader";
import { SectionBackground } from "./_shared/SectionBackground";
import {
  SPACING,
  TYPOGRAPHY,
  TRANSITION,
  getWorldviewOverride,
} from "@/lib/aura/aura.designSystem";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

function getDefaultHeading(languageMode?: string) {
  switch (languageMode) {
    case "ja":
      return "スキル";
    case "jaEn":
      return "SKILLS / スキル";
    case "en":
    default:
      return "SKILLS";
  }
}

/* ===== skill normalize ===== */
type SkillItem = {
  label: string;
  level?: number | null; // 0-100 or 1-5 など（任意）
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeLevel(raw: any): number | null {
  if (raw === undefined || raw === null || raw === "") return null;

  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;

  // 1-5 なら 0-100 に寄せる
  if (n > 0 && n <= 5) return clamp(Math.round((n / 5) * 100), 0, 100);

  // 0-100想定
  if (n >= 0 && n <= 100) return clamp(Math.round(n), 0, 100);

  // それ以外は扱わない（暴れ防止）
  return null;
}

function pickLabel(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  const v =
    (item.label ?? item.title ?? item.name ?? item.text ?? item.value ?? "")
      .toString()
      .trim();
  return v;
}

function toSkillItems(items: any[]): SkillItem[] {
  const out: SkillItem[] = [];
  for (const it of items ?? []) {
    const label = pickLabel(it);
    if (!label) continue;

    const level = normalizeLevel(
      (it as any)?.level ?? (it as any)?.strength ?? (it as any)?.score
    );
    out.push({ label, level });
  }

  // 重複排除（順序維持）
  const seen = new Set<string>();
  return out.filter((s) => {
    const key = s.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const AuraSkills: React.FC<Props> = ({ section, theme, variant }) => {
  const rawSection = section as any;

  const headings: string[] | undefined = rawSection.headings;
  const items: any[] = rawSection.items ?? [];
  const paragraphs: string[] | undefined = rawSection.paragraphs;

  const sectionType = (rawSection.type ?? "skills") as string;

  const heading =
    headings?.[0] ?? getDefaultHeading((theme as any)?.languageMode ?? (theme as any)?.language);

  const skills = useMemo(() => toSkillItems(items), [items]);

  // 世界観オーバーライド
  const worldview = String((variant as any)?.worldview ?? "business");
  const override = getWorldviewOverride(worldview);
  const isNeon = override.decorations.neonBorder;
  const isGold = override.decorations.goldAccent;

  const v = applyVariantStyle(variant, theme);
  const isDarkWorld = v.isDark;

  // ✅ セクション別アクセント（About/Services と同じ思想）
const accent =
  v.accentColor || (theme as any)?.colorAccent || (theme as any)?.colorPrimary;


  // 任意：説明文があれば表示（なければ“薄さ”が出るので軽くリッチ化）
  const descLines =
    Array.isArray(paragraphs) && paragraphs.filter(Boolean).length > 0
      ? paragraphs.filter(Boolean)
      : null;

  // タグ列/カードの寄せ（layoutに追従）
  const justifyClass = (variant as any)?.layout === "split" ? "justify-start" : "justify-center";

  // カード surface
  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const metaTextColor = isDarkWorld ? "rgba(226,232,240,0.78)" : "rgba(55,65,81,0.75)";
  const bodyTextColor = isDarkWorld ? "rgba(226,232,240,0.90)" : "rgba(55,65,81,0.90)";
  const titleTextColor = isDarkWorld ? "rgba(248,250,252,0.98)" : "rgba(17,24,39,0.96)";

  // ===== 背景（About/Services と同等の強度連動） =====
  const overallStrength = useMemo(() => {
    const raw = (variant as any)?.overallStrength;
    const n = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [variant]);

  if (skills.length === 0) return null;

  // 背景は共通コンポーネントに委譲

  // ===== UI parts =====
  const cardBaseStyle: CSSProperties = {
    borderRadius: v.radius,
    borderColor: v.borderColor,
    boxShadow: v.shadow,
    background: surfaceBG,
  };

  const chipBaseStyle: CSSProperties = {
    borderRadius: 999,
    border: `1px solid ${accent}26`,
    background: isDarkWorld ? "rgba(15,23,42,0.78)" : "rgba(255,255,255,0.96)",
    color: isDarkWorld ? "rgba(226,232,240,0.92)" : "rgba(17,24,39,0.92)",
    boxShadow: isDarkWorld
      ? "0 1px 0 rgba(255,255,255,0.06)"
      : "0 1px 2px rgba(15,23,42,0.10), 0 0 0 1px rgba(255,255,255,0.75)",
  };

  return (
    <section
      className={`relative overflow-hidden ${SPACING.section.paddingY} ${SPACING.section.paddingX}`}
      aria-label="Skills"
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

      {/* 前面 */}
      <div className={`relative z-10 mx-auto w-full ${SPACING.maxWidth.section}`}>
        {/* ✅ About/Services と同じ見出し（ズレ根絶） */}
        <AuraSectionPillHeader
          label={heading}
          theme={theme}
          variant={variant}
          className="mb-3"
        />

        {/* ======= リッチ化：メタ行（件数など） ======= */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs" style={{ color: metaTextColor }}>
            Skill set{" "}
            <span style={{ color: titleTextColor, fontWeight: 600 }}>{skills.length}</span>
          </div>

          {/* 右上アクセント（小さく世界観を足す） */}
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-10 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)`,
                opacity: isDarkWorld ? 0.55 : 0.7,
              }}
              aria-hidden
            />
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: accent, opacity: isDarkWorld ? 0.9 : 0.85 }}
              aria-hidden
            />
          </div>
        </div>

        {/* ======= 説明文（あれば表示：薄さ対策） ======= */}
        {descLines ? (
          <div className="mb-4 space-y-1 text-xs leading-relaxed" style={{ color: bodyTextColor }}>
            {descLines.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}

        {/* ======= カード（土台） ======= */}
        <div className="border px-4 py-4 md:px-5 md:py-5" style={cardBaseStyle}>
          {/* 中に薄い区切り線（情報量感） */}
          <div
            className="mb-3 h-px w-full"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${v.borderColor} 18%, ${v.borderColor} 82%, transparent 100%)`,
              opacity: isDarkWorld ? 0.35 : 0.55,
            }}
            aria-hidden
          />

          {/* スキル：チップ（任意でレベルバー） */}
          <div className={`flex flex-wrap gap-2 ${justifyClass}`}>
            {skills.map((s, i) => {
              const hasLevel = typeof s.level === "number" && Number.isFinite(s.level);
              const level = hasLevel ? clamp(s.level as number, 0, 100) : null;

              return (
                <span
                  key={`${s.label}-${i}`}
                  className={[
                    "group",
                    "inline-flex items-center gap-2",
                    "px-3 py-1.5",
                    "text-xs font-medium",
                    "transition-transform",
                    "hover:-translate-y-[1px]",
                  ].join(" ")}
                  style={chipBaseStyle}
                >
                  {/* 左のアクセント点 */}
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: accent, opacity: isDarkWorld ? 0.85 : 0.75 }}
                    aria-hidden
                  />

                  <span style={{ color: titleTextColor }}>{s.label}</span>

                  {/* 任意：レベル表示（ある場合のみ） */}
                  {level !== null ? (
                    <span className="ml-1 inline-flex items-center gap-1">
                      <span
                        className="h-1.5 w-12 overflow-hidden rounded-full"
                        style={{
                          background: isDarkWorld
                            ? "rgba(148,163,184,0.25)"
                            : "rgba(15,23,42,0.10)",
                          border: `1px solid ${accent}1a`,
                        }}
                        aria-hidden
                      >
                        <span
                          className="block h-full"
                          style={{
                            width: `${level}%`,
                            background: accent,
                            opacity: isDarkWorld ? 0.75 : 0.7,
                          }}
                        />
                      </span>
                      <span className="text-[10px]" style={{ color: metaTextColor }}>
                        {level}
                      </span>
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
